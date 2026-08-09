import { env } from "cloudflare:workers";
import { cleanPrompt, generateAppSpec, InputError } from "./generator";
import type { AgentStep, AppSpec, ProjectSnapshot, VersionSnapshot, WorkspaceSnapshot } from "./types";

const COOKIE_NAME = "atoms_workspace";
const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, owner_key TEXT NOT NULL, title TEXT NOT NULL, prompt TEXT NOT NULL, status TEXT NOT NULL, current_version_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS projects_owner_updated_idx ON projects(owner_key, updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS workspace_requests (owner_key TEXT NOT NULL, request_id TEXT NOT NULL, project_id TEXT NOT NULL, run_id TEXT NOT NULL, status TEXT NOT NULL, error_code TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(owner_key, request_id))`,
  `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS messages_project_created_idx ON messages(project_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, request_id TEXT NOT NULL, base_version_id TEXT, status TEXT NOT NULL, error_code TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(project_id, request_id))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS runs_project_running_idx ON runs(project_id) WHERE status = 'RUNNING'`,
  `CREATE TABLE IF NOT EXISTS run_steps (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, ordinal INTEGER NOT NULL, role TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL, summary TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(run_id, ordinal))`,
  `CREATE TABLE IF NOT EXISTS versions (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, parent_version_id TEXT, version_no INTEGER NOT NULL, app_spec_json TEXT NOT NULL, change_summary TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(project_id, version_no))`,
  `CREATE TABLE IF NOT EXISTS rate_limits (bucket_key TEXT NOT NULL, window_start TEXT NOT NULL, action TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(bucket_key, window_start, action))`,
];

type Row = Record<string, unknown>;
let schemaPromise: Promise<void> | null = null;

function d1() {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  return env.DB;
}

export function ensureSchema() {
  schemaPromise ??= d1().batch(SCHEMA_STATEMENTS.map((sql) => d1().prepare(sql))).then(() => undefined);
  return schemaPromise;
}

function parseCookie(header: string | null, name: string) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function resolveOwner(request: Request) {
  const userId = request.headers.get("oai-authenticated-user-id");
  let token = parseCookie(request.headers.get("cookie"), COOKIE_NAME);
  let setCookie: string | null = null;
  if (!userId && (!token || !/^[A-Za-z0-9_-]{20,80}$/.test(token))) {
    token = toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    setCookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax${secure}`;
  }
  const raw = userId ? `user:${userId}` : `anon:${token}`;
  return { ownerKey: await sha256(`atoms-demo:v1:${raw}`), setCookie };
}

export function jsonResponse(data: unknown, status = 200, setCookie?: string | null) {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  if (setCookie) headers.set("set-cookie", setCookie);
  return new Response(JSON.stringify(data), { status, headers });
}

export function errorResponse(error: unknown, setCookie?: string | null) {
  const known = error instanceof InputError;
  const status = known ? error.status : 500;
  const code = known ? error.code : "INTERNAL_ERROR";
  const message = known ? error.message : "暂时无法完成这次操作，请稍后重试。";
  return jsonResponse({ data: null, error: { code, message } }, status, setCookie);
}

async function queryAll(sql: string, ...values: unknown[]) {
  const result = await d1().prepare(sql).bind(...values).all<Row>();
  return result.results ?? [];
}

async function queryFirst(sql: string, ...values: unknown[]) {
  return d1().prepare(sql).bind(...values).first<Row>();
}

async function enforceRate(ownerKey: string, action: "generate" | "create_project") {
  const now = new Date();
  const windowStart = now.toISOString().slice(0, 16);
  const buckets = action === "create_project"
    ? [[ownerKey, 20], ["global", 30]] as const
    : [[ownerKey, 6], ["global", 120]] as const;
  for (const [bucket, limit] of buckets) {
    const row = await queryFirst("SELECT count FROM rate_limits WHERE bucket_key=? AND window_start=? AND action=?", bucket, windowStart, action);
    if (Number(row?.count ?? 0) >= limit) throw new InputError("RATE_LIMITED", "操作太频繁，请稍等一分钟再试。", 429);
  }
  await d1().batch(buckets.map(([bucket]) => d1().prepare(
    "INSERT INTO rate_limits(bucket_key,window_start,action,count) VALUES(?,?,?,1) ON CONFLICT(bucket_key,window_start,action) DO UPDATE SET count=count+1",
  ).bind(bucket, windowStart, action)));
}

function versionFromRow(row: Row): VersionSnapshot {
  return {
    id: String(row.id),
    versionNo: Number(row.version_no),
    parentVersionId: row.parent_version_id ? String(row.parent_version_id) : null,
    changeSummary: String(row.change_summary),
    appSpec: JSON.parse(String(row.app_spec_json)) as AppSpec,
    createdAt: String(row.created_at),
  };
}

export async function getProject(ownerKey: string, projectId: string): Promise<ProjectSnapshot> {
  await ensureSchema();
  const project = await queryFirst("SELECT * FROM projects WHERE id=? AND owner_key=?", projectId, ownerKey);
  if (!project) throw new InputError("NOT_FOUND", "这个项目不存在，或不属于当前工作区。", 404);
  const [messages, versions, stepRows] = await Promise.all([
    queryAll("SELECT * FROM messages WHERE project_id=? ORDER BY created_at ASC", projectId),
    queryAll("SELECT * FROM versions WHERE project_id=? ORDER BY version_no DESC", projectId),
    queryAll("SELECT rs.* FROM run_steps rs JOIN runs r ON r.id=rs.run_id WHERE r.project_id=? ORDER BY r.created_at DESC, rs.ordinal ASC LIMIT 4", projectId),
  ]);
  return {
    id: String(project.id),
    title: String(project.title),
    prompt: String(project.prompt),
    status: String(project.status),
    currentVersionId: project.current_version_id ? String(project.current_version_id) : null,
    createdAt: String(project.created_at),
    updatedAt: String(project.updated_at),
    messages: messages.map((row: Row) => ({ id: String(row.id), role: String(row.role), content: String(row.content), createdAt: String(row.created_at) })),
    steps: stepRows.map((row: Row) => ({ role: row.role, name: String(row.name), summary: String(row.summary), status: row.status })) as AgentStep[],
    versions: versions.map((row: Row) => versionFromRow(row)),
  };
}

export async function getWorkspace(ownerKey: string): Promise<WorkspaceSnapshot> {
  await ensureSchema();
  const rows = await queryAll("SELECT id FROM projects WHERE owner_key=? ORDER BY updated_at DESC LIMIT 20", ownerKey);
  const projects = await Promise.all(rows.map((row: Row) => getProject(ownerKey, String(row.id))));
  return { projects, activeProjectId: projects[0]?.id ?? null };
}

function projectTitle(spec: AppSpec) {
  return spec.title.replace(/看板|发布清单/g, "").trim().slice(0, 40) || "未命名应用";
}

export async function createProject(ownerKey: string, input: { prompt?: unknown; requestId?: unknown }) {
  await ensureSchema();
  const prompt = cleanPrompt(input.prompt);
  const requestId = typeof input.requestId === "string" && input.requestId.length >= 8 ? input.requestId : crypto.randomUUID();
  const ledger = await queryFirst("SELECT project_id,status,error_code FROM workspace_requests WHERE owner_key=? AND request_id=?", ownerKey, requestId);
  if (ledger) return getProject(ownerKey, String(ledger.project_id));
  await enforceRate(ownerKey, "create_project");
  const count = await queryFirst("SELECT COUNT(*) AS total FROM projects WHERE owner_key=?", ownerKey);
  if (Number(count?.total ?? 0) >= 20) throw new InputError("PROJECT_LIMIT_REACHED", "当前工作区最多保存 20 个项目。", 409);
  const global = await queryFirst("SELECT COUNT(*) AS total FROM projects");
  if (Number(global?.total ?? 0) >= 5000) throw new InputError("SITE_CAPACITY_REACHED", "Demo 容量暂时已满。", 503);

  const { spec, summary, steps } = generateAppSpec(prompt);
  const now = new Date().toISOString();
  const projectId = crypto.randomUUID();
  const runId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const statements = [
    d1().prepare("INSERT INTO projects(id,owner_key,title,prompt,status,current_version_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").bind(projectId, ownerKey, projectTitle(spec), prompt, "READY", versionId, now, now),
    d1().prepare("INSERT INTO workspace_requests(owner_key,request_id,project_id,run_id,status,error_code,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").bind(ownerKey, requestId, projectId, runId, "COMPLETED", null, now, now),
    d1().prepare("INSERT INTO runs(id,project_id,request_id,base_version_id,status,error_code,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").bind(runId, projectId, requestId, null, "COMPLETED", null, now, now),
    d1().prepare("INSERT INTO versions(id,project_id,parent_version_id,version_no,app_spec_json,change_summary,created_at) VALUES(?,?,?,?,?,?,?)").bind(versionId, projectId, null, 1, JSON.stringify(spec), summary, now),
    d1().prepare("INSERT INTO messages(id,project_id,role,content,created_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(), projectId, "user", prompt, now),
    d1().prepare("INSERT INTO messages(id,project_id,role,content,created_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(), projectId, "assistant", summary, now),
    ...steps.map((step, index) => d1().prepare("INSERT INTO run_steps(id,run_id,ordinal,role,name,status,summary,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), runId, index, step.role, step.name, step.status, step.summary, now, now)),
  ];
  await d1().batch(statements);
  return getProject(ownerKey, projectId);
}

export async function generateVersion(ownerKey: string, projectId: string, input: { prompt?: unknown; requestId?: unknown; baseVersionId?: unknown }) {
  await ensureSchema();
  const prompt = cleanPrompt(input.prompt);
  const requestId = typeof input.requestId === "string" && input.requestId.length >= 8 ? input.requestId : crypto.randomUUID();
  const existing = await queryFirst("SELECT id,status FROM runs WHERE project_id=? AND request_id=?", projectId, requestId);
  if (existing) return getProject(ownerKey, projectId);
  const project = await queryFirst("SELECT * FROM projects WHERE id=? AND owner_key=?", projectId, ownerKey);
  if (!project) throw new InputError("NOT_FOUND", "这个项目不存在，或不属于当前工作区。", 404);
  const baseVersionId = typeof input.baseVersionId === "string" ? input.baseVersionId : null;
  if (!baseVersionId || baseVersionId !== project.current_version_id) throw new InputError("STALE_VERSION", "项目版本已经变化，请刷新后再修改。", 409);
  const running = await queryFirst("SELECT id FROM runs WHERE project_id=? AND status='RUNNING'", projectId);
  if (running) throw new InputError("PROJECT_BUSY", "项目正在生成中，请稍后再试。", 409);
  await enforceRate(ownerKey, "generate");
  const base = await queryFirst("SELECT * FROM versions WHERE id=? AND project_id=?", baseVersionId, projectId);
  if (!base) throw new InputError("NOT_FOUND", "基础版本不存在。", 404);
  const { spec, summary, steps } = generateAppSpec(prompt, JSON.parse(String(base.app_spec_json)) as AppSpec);
  const max = await queryFirst("SELECT MAX(version_no) AS max_no FROM versions WHERE project_id=?", projectId);
  const now = new Date().toISOString();
  const runId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  await d1().batch([
    d1().prepare("INSERT INTO runs(id,project_id,request_id,base_version_id,status,error_code,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").bind(runId, projectId, requestId, baseVersionId, "COMPLETED", null, now, now),
    d1().prepare("INSERT INTO versions(id,project_id,parent_version_id,version_no,app_spec_json,change_summary,created_at) VALUES(?,?,?,?,?,?,?)").bind(versionId, projectId, baseVersionId, Number(max?.max_no ?? 0) + 1, JSON.stringify(spec), summary, now),
    d1().prepare("UPDATE projects SET current_version_id=?,status='READY',updated_at=? WHERE id=? AND owner_key=? AND current_version_id=?").bind(versionId, now, projectId, ownerKey, baseVersionId),
    d1().prepare("INSERT INTO messages(id,project_id,role,content,created_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(), projectId, "user", prompt, now),
    d1().prepare("INSERT INTO messages(id,project_id,role,content,created_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(), projectId, "assistant", summary, now),
    ...steps.map((step, index) => d1().prepare("INSERT INTO run_steps(id,run_id,ordinal,role,name,status,summary,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), runId, index, step.role, step.name, step.status, step.summary, now, now)),
  ]);
  return getProject(ownerKey, projectId);
}

export async function activateVersion(ownerKey: string, projectId: string, versionId: string, expectedCurrentVersionId: unknown) {
  await ensureSchema();
  if (typeof expectedCurrentVersionId !== "string") throw new InputError("INVALID_REQUEST", "缺少当前版本信息。", 400);
  const version = await queryFirst("SELECT id FROM versions WHERE id=? AND project_id=?", versionId, projectId);
  if (!version) throw new InputError("NOT_FOUND", "版本不存在。", 404);
  const result = await d1().prepare("UPDATE projects SET current_version_id=?,updated_at=? WHERE id=? AND owner_key=? AND current_version_id=? AND NOT EXISTS(SELECT 1 FROM runs WHERE project_id=? AND status='RUNNING')").bind(versionId, new Date().toISOString(), projectId, ownerKey, expectedCurrentVersionId, projectId).run();
  if (result.meta.changes !== 1) throw new InputError("STALE_VERSION", "项目版本已经变化，请刷新后重试。", 409);
  return getProject(ownerKey, projectId);
}
