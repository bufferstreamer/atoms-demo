import { env } from "cloudflare:workers";
import { generateAppWithAgents, type GenerationMeta, type StageProgress } from "./ai-generator";
import { cleanPrompt, InputError } from "./generator";
import type { AgentStep, AppSpec, ProjectSnapshot, VersionSnapshot, WorkspaceSnapshot } from "./types";

const COOKIE_NAME = "atoms_workspace";
const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, owner_key TEXT NOT NULL, title TEXT NOT NULL, prompt TEXT NOT NULL, status TEXT NOT NULL, current_version_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS projects_owner_updated_idx ON projects(owner_key, updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS workspace_requests (owner_key TEXT NOT NULL, request_id TEXT NOT NULL, project_id TEXT NOT NULL, run_id TEXT NOT NULL, status TEXT NOT NULL, error_code TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(owner_key, request_id))`,
  `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS messages_project_created_idx ON messages(project_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, request_id TEXT NOT NULL, base_version_id TEXT, attempt_token TEXT, runner_claimed_at TEXT, status TEXT NOT NULL, error_code TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(project_id, request_id))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS runs_project_running_idx ON runs(project_id) WHERE status = 'RUNNING'`,
  `CREATE TABLE IF NOT EXISTS run_steps (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, ordinal INTEGER NOT NULL, role TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL, summary TEXT NOT NULL, source TEXT, model TEXT, duration_ms INTEGER, attempt_no INTEGER, artifact_json TEXT, error_code TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(run_id, ordinal))`,
  `CREATE TABLE IF NOT EXISTS versions (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, parent_version_id TEXT, version_no INTEGER NOT NULL, app_spec_json TEXT NOT NULL, change_summary TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(project_id, version_no))`,
  `CREATE TABLE IF NOT EXISTS rate_limits (bucket_key TEXT NOT NULL, window_start TEXT NOT NULL, action TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(bucket_key, window_start, action))`,
  `CREATE TABLE IF NOT EXISTS generation_events (run_id TEXT PRIMARY KEY, source TEXT NOT NULL, model TEXT NOT NULL, outcome TEXT NOT NULL, failure_code TEXT, duration_ms INTEGER NOT NULL, created_at TEXT NOT NULL)`,
];

type Row = Record<string, unknown>;
let schemaPromise: Promise<void> | null = null;

function d1() {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  return env.DB;
}

export function ensureSchema() {
  schemaPromise ??= (async () => {
    await d1().batch(SCHEMA_STATEMENTS.map((sql) => d1().prepare(sql)));
    await ensureColumns("runs", { attempt_token: "TEXT", runner_claimed_at: "TEXT" });
    await ensureColumns("run_steps", { source: "TEXT", model: "TEXT", duration_ms: "INTEGER", attempt_no: "INTEGER", artifact_json: "TEXT", error_code: "TEXT" });
  })().catch((error) => { schemaPromise = null; throw error; });
  return schemaPromise;
}

async function ensureColumns(table: "runs" | "run_steps", columns: Record<string, string>) {
  const present = new Set((await queryAll(`PRAGMA table_info(${table})`)).map((row) => String(row.name)));
  for (const [name, type] of Object.entries(columns)) {
    if (present.has(name)) continue;
    try { await d1().prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`).run(); }
    catch (error) {
      const afterRace = new Set((await queryAll(`PRAGMA table_info(${table})`)).map((row) => String(row.name)));
      if (!afterRace.has(name)) throw error;
    }
  }
  const final = new Set((await queryAll(`PRAGMA table_info(${table})`)).map((row) => String(row.name)));
  for (const name of Object.keys(columns)) if (!final.has(name)) throw new Error(`Schema migration missing ${table}.${name}`);
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

async function rateReservation(ownerKey: string, action: "generate" | "create_project") {
  const now = new Date();
  const windowStart = now.toISOString().slice(0, 16);
  const buckets = action === "create_project"
    ? [[ownerKey, 20], ["global", 30]] as const
    : [[ownerKey, 6], ["global", 120]] as const;
  for (const [bucket, limit] of buckets) {
    const row = await queryFirst("SELECT count FROM rate_limits WHERE bucket_key=? AND window_start=? AND action=?", bucket, windowStart, action);
    if (Number(row?.count ?? 0) >= limit) throw new InputError("RATE_LIMITED", "操作太频繁，请稍等一分钟再试。", 429);
  }
  return buckets.map(([bucket]) => d1().prepare(
    "INSERT INTO rate_limits(bucket_key,window_start,action,count) VALUES(?,?,?,1) ON CONFLICT(bucket_key,window_start,action) DO UPDATE SET count=count+1",
  ).bind(bucket, windowStart, action));
}

async function recoverStaleRuns() {
  const cutoff = new Date(Date.now() - 120_000).toISOString();
  const stale = await queryAll("SELECT id,project_id FROM runs WHERE status='RUNNING' AND updated_at<?", cutoff);
  for (const row of stale) {
    const now = new Date().toISOString();
    await d1().batch([
      d1().prepare("UPDATE runs SET status='FAILED',error_code='RUN_TIMEOUT',attempt_token=NULL,updated_at=? WHERE id=? AND status='RUNNING' AND updated_at<?").bind(now, row.id, cutoff),
      d1().prepare("UPDATE workspace_requests SET status='FAILED',error_code='RUN_TIMEOUT',updated_at=? WHERE run_id=? AND status='RUNNING'").bind(now, row.id),
      d1().prepare("UPDATE run_steps SET status='FAILED',summary='生成任务超时，请重新提交。',error_code='RUN_TIMEOUT',updated_at=? WHERE run_id=? AND status IN ('PENDING','RUNNING')").bind(now, row.id),
      d1().prepare("UPDATE projects SET status=CASE WHEN current_version_id IS NULL THEN 'FAILED' ELSE 'READY' END,updated_at=? WHERE id=? AND status='BUILDING'").bind(now, row.project_id),
    ]);
  }
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
  await recoverStaleRuns();
  const project = await queryFirst("SELECT * FROM projects WHERE id=? AND owner_key=?", projectId, ownerKey);
  if (!project) throw new InputError("NOT_FOUND", "这个项目不存在，或不属于当前工作区。", 404);
  const [messages, versions, stepRows, generation, latestRun] = await Promise.all([
    queryAll("SELECT * FROM messages WHERE project_id=? ORDER BY created_at ASC", projectId),
    queryAll("SELECT * FROM versions WHERE project_id=? ORDER BY version_no DESC", projectId),
    queryAll("SELECT rs.* FROM run_steps rs JOIN runs r ON r.id=rs.run_id WHERE r.project_id=? ORDER BY r.created_at DESC, rs.ordinal ASC LIMIT 4", projectId),
    queryFirst("SELECT ge.* FROM generation_events ge JOIN runs r ON r.id=ge.run_id WHERE r.project_id=? ORDER BY ge.created_at DESC LIMIT 1", projectId),
    queryFirst("SELECT id,request_id,status,error_code FROM runs WHERE project_id=? ORDER BY created_at DESC LIMIT 1", projectId),
  ]);
  return {
    id: String(project.id),
    title: String(project.title),
    prompt: String(project.prompt),
    status: String(project.status),
    errorCode: latestRun?.error_code ? String(latestRun.error_code) : null,
    currentVersionId: project.current_version_id ? String(project.current_version_id) : null,
    createdAt: String(project.created_at),
    updatedAt: String(project.updated_at),
    latestRunId: latestRun?.id ? String(latestRun.id) : null,
    latestRequestId: latestRun?.request_id ? String(latestRun.request_id) : null,
    messages: messages.map((row: Row) => ({ id: String(row.id), role: String(row.role), content: String(row.content), createdAt: String(row.created_at) })),
    steps: stepRows.map((row: Row) => ({ role: row.role, name: String(row.name), summary: String(row.summary), status: row.status, source: row.source ? String(row.source) : null, model: row.model ? String(row.model) : null, durationMs: row.duration_ms === null || row.duration_ms === undefined ? null : Number(row.duration_ms), attemptNo: row.attempt_no === null || row.attempt_no === undefined ? null : Number(row.attempt_no), artifact: row.artifact_json ? JSON.parse(String(row.artifact_json)) : null, errorCode: row.error_code ? String(row.error_code) : null })) as AgentStep[],
    generation: generation ? {
      source: String(generation.source) as "workers_ai" | "deterministic",
      model: String(generation.model),
      outcome: String(generation.outcome) as "SUCCESS" | "FALLBACK",
      failureCode: generation.failure_code ? String(generation.failure_code) : null,
      durationMs: Number(generation.duration_ms),
    } : null,
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
  await recoverStaleRuns();
  const prompt = cleanPrompt(input.prompt);
  const requestId = typeof input.requestId === "string" && input.requestId.length >= 8 ? input.requestId : crypto.randomUUID();
  const ledger = await queryFirst("SELECT project_id,status,error_code FROM workspace_requests WHERE owner_key=? AND request_id=?", ownerKey, requestId);
  if (ledger) {
    if (ledger.status === "FAILED") throw new InputError(String(ledger.error_code ?? "GENERATION_FAILED"), "上一次生成没有完成，请重新提交。", 409);
    return getProject(ownerKey, String(ledger.project_id));
  }
  const count = await queryFirst("SELECT COUNT(*) AS total FROM projects WHERE owner_key=?", ownerKey);
  if (Number(count?.total ?? 0) >= 20) throw new InputError("PROJECT_LIMIT_REACHED", "当前工作区最多保存 20 个项目。", 409);
  const global = await queryFirst("SELECT COUNT(*) AS total FROM projects");
  if (Number(global?.total ?? 0) >= 5000) throw new InputError("SITE_CAPACITY_REACHED", "Demo 容量暂时已满。", 503);

  const now = new Date().toISOString();
  const projectId = crypto.randomUUID();
  const runId = crypto.randomUUID();
  const attemptToken = crypto.randomUUID();
  const rates = await rateReservation(ownerKey, "create_project");
  try {
    await d1().batch([
      d1().prepare("INSERT INTO workspace_requests(owner_key,request_id,project_id,run_id,status,error_code,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").bind(ownerKey, requestId, projectId, runId, "RUNNING", null, now, now),
      d1().prepare("INSERT INTO projects(id,owner_key,title,prompt,status,current_version_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").bind(projectId, ownerKey, "正在构建", prompt, "BUILDING", null, now, now),
      d1().prepare("INSERT INTO runs(id,project_id,request_id,base_version_id,attempt_token,status,error_code,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(runId, projectId, requestId, null, attemptToken, "RUNNING", null, now, now),
      d1().prepare("INSERT INTO messages(id,project_id,role,content,created_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(), projectId, "user", prompt, now),
      ...["product", "architecture", "design", "engineering"].map((role, index) => d1().prepare("INSERT INTO run_steps(id,run_id,ordinal,role,name,status,summary,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), runId, index, role, ["Emma · Product", "Bob · Architect", "Iris · Designer", "Alex · Engineer"][index], "PENDING", "等待生成…", now, now)),
      ...rates,
    ]);
  } catch (error) {
    const raced = await queryFirst("SELECT project_id,status,error_code FROM workspace_requests WHERE owner_key=? AND request_id=?", ownerKey, requestId);
    if (raced) {
      if (raced.status === "FAILED") throw new InputError(String(raced.error_code ?? "GENERATION_FAILED"), "上一次生成没有完成，请重新提交。", 409);
      return getProject(ownerKey, String(raced.project_id));
    }
    throw error;
  }

  return getProject(ownerKey, projectId);
}

async function completeGeneration(input: {
  ownerKey: string;
  projectId: string;
  runId: string;
  requestId: string;
  attemptToken: string;
  baseVersionId: string | null;
  versionNo: number;
  output: { spec: AppSpec; summary: string; steps: AgentStep[]; generation: GenerationMeta };
  firstProject: boolean;
}) {
  const { ownerKey, projectId, runId, attemptToken, baseVersionId, versionNo, output, firstProject } = input;
  const now = new Date().toISOString();
  const versionId = crypto.randomUUID();
  const baseGuard = baseVersionId === null
    ? "p.current_version_id IS NULL"
    : "p.current_version_id=?";
  const versionValues = baseVersionId === null
    ? [versionId, projectId, baseVersionId, versionNo, JSON.stringify(output.spec), output.summary, now, runId, attemptToken, projectId]
    : [versionId, projectId, baseVersionId, versionNo, JSON.stringify(output.spec), output.summary, now, runId, attemptToken, projectId, baseVersionId];
  const statements = [
    d1().prepare(`INSERT INTO versions(id,project_id,parent_version_id,version_no,app_spec_json,change_summary,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM runs r JOIN projects p ON p.id=r.project_id WHERE r.id=? AND r.attempt_token=? AND r.status='RUNNING' AND p.id=? AND ${baseGuard})`).bind(...versionValues),
    ...output.steps.map((step, index) => d1().prepare("UPDATE run_steps SET status='COMPLETED',summary=?,source=?,model=?,duration_ms=?,attempt_no=?,artifact_json=?,error_code=?,updated_at=? WHERE run_id=? AND ordinal=? AND EXISTS(SELECT 1 FROM versions WHERE id=? AND project_id=?)").bind(step.summary, step.source ?? output.generation.source, step.model ?? output.generation.model, step.durationMs ?? 0, step.attemptNo ?? 1, step.artifact ? JSON.stringify(step.artifact) : null, step.errorCode ?? null, now, runId, index, versionId, projectId)),
    d1().prepare("INSERT INTO messages(id,project_id,role,content,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM versions WHERE id=? AND project_id=?)").bind(crypto.randomUUID(), projectId, "assistant", output.summary, now, versionId, projectId),
    d1().prepare("UPDATE runs SET status='COMPLETED',error_code=NULL,updated_at=? WHERE id=? AND attempt_token=? AND status='RUNNING' AND EXISTS(SELECT 1 FROM versions WHERE id=? AND project_id=?)").bind(now, runId, attemptToken, versionId, projectId),
    d1().prepare("UPDATE projects SET title=?,current_version_id=?,status='READY',updated_at=? WHERE id=? AND owner_key=? AND EXISTS(SELECT 1 FROM runs WHERE id=? AND status='COMPLETED') AND EXISTS(SELECT 1 FROM versions WHERE id=? AND project_id=?)").bind(projectTitle(output.spec), versionId, now, projectId, ownerKey, runId, versionId, projectId),
    ...(firstProject ? [d1().prepare("UPDATE workspace_requests SET status='COMPLETED',error_code=NULL,updated_at=? WHERE run_id=? AND status='RUNNING' AND EXISTS(SELECT 1 FROM projects WHERE id=? AND current_version_id=?)").bind(now, runId, projectId, versionId)] : []),
    d1().prepare("INSERT INTO generation_events(run_id,source,model,outcome,failure_code,duration_ms,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM runs WHERE id=? AND status='COMPLETED') AND EXISTS(SELECT 1 FROM projects WHERE id=? AND current_version_id=?)").bind(runId, output.generation.source, output.generation.model, output.generation.outcome, output.generation.failureCode, output.generation.durationMs, now, runId, projectId, versionId),
    d1().prepare("UPDATE runs SET attempt_token=NULL WHERE id=? AND status='COMPLETED' AND EXISTS(SELECT 1 FROM generation_events WHERE run_id=?)").bind(runId, runId),
  ];
  try {
    await d1().batch(statements);
  } catch (error) {
    await failGeneration(projectId, runId, attemptToken, "COMPLETION_FAILED", firstProject);
    throw error;
  }
  const [version, run, event, project] = await Promise.all([
    queryFirst("SELECT id FROM versions WHERE id=? AND project_id=?", versionId, projectId),
    queryFirst("SELECT status FROM runs WHERE id=?", runId),
    queryFirst("SELECT outcome FROM generation_events WHERE run_id=?", runId),
    queryFirst("SELECT current_version_id FROM projects WHERE id=? AND owner_key=?", projectId, ownerKey),
  ]);
  if (!version || run?.status !== "COMPLETED" || !event || project?.current_version_id !== versionId) {
    await failGeneration(projectId, runId, attemptToken, "COMPLETION_INCONSISTENT", firstProject);
    throw new InputError("GENERATION_FAILED", "生成结果没有安全保存，请重新提交。", 500);
  }
}

export async function generateVersion(ownerKey: string, projectId: string, input: { prompt?: unknown; requestId?: unknown; baseVersionId?: unknown }) {
  await ensureSchema();
  await recoverStaleRuns();
  const prompt = cleanPrompt(input.prompt);
  const requestId = typeof input.requestId === "string" && input.requestId.length >= 8 ? input.requestId : crypto.randomUUID();
  const existing = await queryFirst("SELECT id,status FROM runs WHERE project_id=? AND request_id=?", projectId, requestId);
  if (existing) {
    if (existing.status === "FAILED") throw new InputError("GENERATION_FAILED", "上一次生成没有完成，请重新提交。", 409);
    return getProject(ownerKey, projectId);
  }
  const project = await queryFirst("SELECT * FROM projects WHERE id=? AND owner_key=?", projectId, ownerKey);
  if (!project) throw new InputError("NOT_FOUND", "这个项目不存在，或不属于当前工作区。", 404);
  const baseVersionId = typeof input.baseVersionId === "string" ? input.baseVersionId : null;
  if (!baseVersionId || baseVersionId !== project.current_version_id) throw new InputError("STALE_VERSION", "项目版本已经变化，请刷新后再修改。", 409);
  const running = await queryFirst("SELECT id FROM runs WHERE project_id=? AND status='RUNNING'", projectId);
  if (running) throw new InputError("PROJECT_BUSY", "项目正在生成中，请稍后再试。", 409);
  const base = await queryFirst("SELECT * FROM versions WHERE id=? AND project_id=?", baseVersionId, projectId);
  if (!base) throw new InputError("NOT_FOUND", "基础版本不存在。", 404);
  const now = new Date().toISOString();
  const runId = crypto.randomUUID();
  const attemptToken = crypto.randomUUID();
  const rates = await rateReservation(ownerKey, "generate");
  try {
    await d1().batch([
      d1().prepare("INSERT INTO runs(id,project_id,request_id,base_version_id,attempt_token,status,error_code,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(runId, projectId, requestId, baseVersionId, attemptToken, "RUNNING", null, now, now),
      d1().prepare("UPDATE projects SET status='BUILDING',updated_at=? WHERE id=? AND owner_key=? AND current_version_id=?").bind(now, projectId, ownerKey, baseVersionId),
      d1().prepare("INSERT INTO messages(id,project_id,role,content,created_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(), projectId, "user", prompt, now),
      ...["product", "architecture", "design", "engineering"].map((role, index) => d1().prepare("INSERT INTO run_steps(id,run_id,ordinal,role,name,status,summary,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), runId, index, role, ["Emma · Product", "Bob · Architect", "Iris · Designer", "Alex · Engineer"][index], "PENDING", "等待生成…", now, now)),
      ...rates,
    ]);
  } catch (error) {
    const raced = await queryFirst("SELECT status FROM runs WHERE project_id=? AND request_id=?", projectId, requestId);
    if (raced) return getProject(ownerKey, projectId);
    throw error;
  }
  return getProject(ownerKey, projectId);
}

async function persistStage(runId: string, attemptToken: string, stage: StageProgress) {
  const now = new Date().toISOString();
  const ordinal = ["product", "architecture", "design", "engineering"].indexOf(stage.role);
  const result = stage.status === "RUNNING"
    ? await d1().prepare("UPDATE run_steps SET status='RUNNING',attempt_no=?,updated_at=? WHERE run_id=? AND ordinal=? AND status IN ('PENDING','RUNNING') AND EXISTS(SELECT 1 FROM runs WHERE id=? AND attempt_token=? AND status='RUNNING')").bind(stage.attemptNo ?? 1, now, runId, ordinal, runId, attemptToken).run()
    : await d1().prepare("UPDATE run_steps SET status='COMPLETED',summary=?,source=?,model=?,duration_ms=?,attempt_no=?,artifact_json=?,error_code=?,updated_at=? WHERE run_id=? AND ordinal=? AND status IN ('PENDING','RUNNING','COMPLETED') AND EXISTS(SELECT 1 FROM runs WHERE id=? AND attempt_token=? AND status='RUNNING')").bind(stage.summary ?? "阶段完成", stage.source ?? null, stage.model ?? null, stage.durationMs ?? 0, stage.attemptNo ?? 1, stage.artifact ? JSON.stringify(stage.artifact) : null, stage.errorCode ?? null, now, runId, ordinal, runId, attemptToken).run();
  if (result.meta.changes !== 1) throw new InputError("STALE_RUN", "生成任务已经失效。", 409);
  await d1().prepare("UPDATE runs SET updated_at=? WHERE id=? AND attempt_token=? AND status='RUNNING'").bind(now, runId, attemptToken).run();
}

export async function executeGeneration(ownerKey: string, projectId: string, input: { requestId?: unknown }) {
  await ensureSchema();
  await recoverStaleRuns();
  const requestId = typeof input.requestId === "string" ? input.requestId : "";
  const run = await queryFirst("SELECT r.* FROM runs r JOIN projects p ON p.id=r.project_id WHERE r.project_id=? AND r.request_id=? AND p.owner_key=?", projectId, requestId, ownerKey);
  if (!run) throw new InputError("NOT_FOUND", "这个生成任务不存在。", 404);
  if (run.status === "COMPLETED") return getProject(ownerKey, projectId);
  if (run.status === "FAILED") throw new InputError(String(run.error_code ?? "GENERATION_FAILED"), "上一次生成没有完成，请重新提交。", 409);
  const claimedAt = new Date().toISOString();
  const claim = await d1().prepare("UPDATE runs SET runner_claimed_at=?,updated_at=? WHERE id=? AND status='RUNNING' AND runner_claimed_at IS NULL AND attempt_token IS NOT NULL").bind(claimedAt, claimedAt, run.id).run();
  if (claim.meta.changes !== 1) return getProject(ownerKey, projectId);

  const attemptToken = String(run.attempt_token);
  const baseVersionId = run.base_version_id ? String(run.base_version_id) : null;
  const firstProject = baseVersionId === null;
  const message = await queryFirst("SELECT content FROM messages WHERE project_id=? AND role='user' ORDER BY created_at DESC LIMIT 1", projectId);
  const prompt = String(message?.content ?? "");
  const base = baseVersionId ? await queryFirst("SELECT app_spec_json FROM versions WHERE id=? AND project_id=?", baseVersionId, projectId) : null;
  const max = await queryFirst("SELECT MAX(version_no) AS max_no FROM versions WHERE project_id=?", projectId);
  try {
    const output = await generateAppWithAgents(prompt, base ? JSON.parse(String(base.app_spec_json)) as AppSpec : undefined, env.AI, { onStage: (stage) => persistStage(String(run.id), attemptToken, stage) });
    await completeGeneration({ ownerKey, projectId, runId: String(run.id), requestId, attemptToken, baseVersionId, versionNo: Number(max?.max_no ?? 0) + 1, output, firstProject });
  } catch (error) {
    await failGeneration(projectId, String(run.id), attemptToken, error instanceof InputError ? error.code : "GENERATION_FAILED", firstProject);
    throw error;
  }
  return getProject(ownerKey, projectId);
}

async function failGeneration(projectId: string, runId: string, attemptToken: string, code: string, firstProject: boolean) {
  const now = new Date().toISOString();
  await d1().batch([
    d1().prepare("UPDATE runs SET status='FAILED',error_code=?,attempt_token=NULL,updated_at=? WHERE id=? AND attempt_token=? AND status='RUNNING'").bind(code, now, runId, attemptToken),
    ...(firstProject ? [d1().prepare("UPDATE workspace_requests SET status='FAILED',error_code=?,updated_at=? WHERE run_id=? AND status='RUNNING'").bind(code, now, runId)] : []),
    d1().prepare("UPDATE run_steps SET status='FAILED',summary='生成失败，请重新提交。',error_code=?,updated_at=? WHERE run_id=? AND status IN ('PENDING','RUNNING')").bind(code, now, runId),
    d1().prepare("UPDATE projects SET status=CASE WHEN current_version_id IS NULL THEN 'FAILED' ELSE 'READY' END,updated_at=? WHERE id=? AND status='BUILDING'").bind(now, projectId),
  ]);
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
