import { env } from "cloudflare:workers";
import { GenerationFailure, PERSISTENCE_DEADLINE_MS, generateAppWithAgents, type GenerationMeta, type StageProgress } from "./ai-generator";
import { validateCodeBundle } from "./code-bundle";
import { cleanPrompt, InputError, validateAppSpec } from "./generator";
import type { AgentStep, AppSpec, CodeBundleV1, ProjectSnapshot, VersionSnapshot, WorkspaceSnapshot } from "./types";

const COOKIE_NAME = "atoms_workspace";
const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, owner_key TEXT NOT NULL, title TEXT NOT NULL, prompt TEXT NOT NULL, status TEXT NOT NULL, current_version_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS projects_owner_updated_idx ON projects(owner_key, updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS workspace_requests (owner_key TEXT NOT NULL, request_id TEXT NOT NULL, project_id TEXT NOT NULL, run_id TEXT NOT NULL, status TEXT NOT NULL, error_code TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(owner_key, request_id))`,
  `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS messages_project_created_idx ON messages(project_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, request_id TEXT NOT NULL, base_version_id TEXT, attempt_token TEXT, runner_claimed_at TEXT, attempt_expires_at INTEGER, status TEXT NOT NULL, error_code TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(project_id, request_id))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS runs_project_running_idx ON runs(project_id) WHERE status = 'RUNNING'`,
  `CREATE UNIQUE INDEX IF NOT EXISTS runs_project_active_idx ON runs(project_id) WHERE status IN ('RUNNING','COMPLETING','FAILING')`,
  `CREATE TABLE IF NOT EXISTS run_steps (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, ordinal INTEGER NOT NULL, role TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL, summary TEXT NOT NULL, source TEXT, model TEXT, duration_ms INTEGER, attempt_no INTEGER, artifact_json TEXT, error_code TEXT, shared_call_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(run_id, ordinal))`,
  `CREATE TABLE IF NOT EXISTS versions (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, parent_version_id TEXT, version_no INTEGER NOT NULL, app_spec_json TEXT NOT NULL, artifact_kind TEXT NOT NULL DEFAULT 'app_spec', change_summary TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(project_id, version_no))`,
  `CREATE TABLE IF NOT EXISTS rate_limits (bucket_key TEXT NOT NULL, window_start TEXT NOT NULL, action TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(bucket_key, window_start, action))`,
  `CREATE TABLE IF NOT EXISTS generation_events (run_id TEXT PRIMARY KEY, source TEXT NOT NULL, model TEXT NOT NULL, outcome TEXT NOT NULL, failure_code TEXT, fallback_reason TEXT, duration_ms INTEGER NOT NULL, artifact_kind TEXT, artifact_bytes INTEGER, validator_json TEXT, input_tokens INTEGER, output_tokens INTEGER, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS run_deadline_audit (run_id TEXT PRIMARY KEY, model_deadline_at INTEGER NOT NULL, persistence_deadline_at INTEGER NOT NULL, response_deadline_at INTEGER NOT NULL, model_deadline_exceeded INTEGER NOT NULL DEFAULT 0, persistence_deadline_exceeded INTEGER NOT NULL DEFAULT 0, response_budget_exceeded INTEGER NOT NULL DEFAULT 0, lease_expired INTEGER NOT NULL DEFAULT 0, observed_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS app_state (owner_key TEXT NOT NULL, project_id TEXT NOT NULL, state_key TEXT NOT NULL, value_json TEXT NOT NULL, value_bytes INTEGER NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(owner_key,project_id,state_key))`,
  `CREATE INDEX IF NOT EXISTS app_state_project_updated_idx ON app_state(project_id,updated_at)`,
  `CREATE TABLE IF NOT EXISTS storage_rate_events (id TEXT PRIMARY KEY, owner_key TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS storage_rate_owner_created_idx ON storage_rate_events(owner_key,created_at)`,
  `CREATE INDEX IF NOT EXISTS storage_rate_created_idx ON storage_rate_events(created_at)`,
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
    await ensureColumns("runs", { attempt_token: "TEXT", runner_claimed_at: "TEXT", attempt_expires_at: "INTEGER" });
    await ensureColumns("run_steps", { source: "TEXT", model: "TEXT", duration_ms: "INTEGER", attempt_no: "INTEGER", artifact_json: "TEXT", error_code: "TEXT", shared_call_id: "TEXT" });
    await ensureColumns("versions", { artifact_kind: "TEXT NOT NULL DEFAULT 'app_spec'" });
    await ensureColumns("generation_events", { fallback_reason: "TEXT", artifact_kind: "TEXT", artifact_bytes: "INTEGER", validator_json: "TEXT", input_tokens: "INTEGER", output_tokens: "INTEGER" });
    await d1().prepare("CREATE UNIQUE INDEX IF NOT EXISTS runs_project_active_idx ON runs(project_id) WHERE status IN ('RUNNING','COMPLETING','FAILING')").run();
  })().catch((error) => { schemaPromise = null; throw error; });
  return schemaPromise;
}

async function ensureColumns(table: "runs" | "run_steps" | "versions" | "generation_events", columns: Record<string, string>) {
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
    const result = await d1().prepare(
      "INSERT INTO rate_limits(bucket_key,window_start,action,count) VALUES(?,?,?,1) ON CONFLICT(bucket_key,window_start,action) DO UPDATE SET count=count+1 WHERE count<?",
    ).bind(bucket, windowStart, action, limit).run();
    if (result.meta.changes !== 1) throw new InputError("RATE_LIMITED", "操作太频繁，请稍等一分钟再试。", 429);
  }
}

async function recoverStaleRuns() {
  const cutoff = new Date(Date.now() - 120_000).toISOString();
  const nowEpoch = Date.now();
  const stale = await queryAll("SELECT id,project_id FROM runs WHERE status IN ('RUNNING','COMPLETING','FAILING') AND ((attempt_expires_at IS NOT NULL AND attempt_expires_at<=?) OR updated_at<?)", nowEpoch, cutoff);
  for (const row of stale) {
    const now = new Date().toISOString();
    await d1().batch([
      d1().prepare("UPDATE runs SET status='FAILED',error_code='RUN_TIMEOUT',attempt_token=NULL,attempt_expires_at=NULL,updated_at=? WHERE id=? AND status IN ('RUNNING','COMPLETING','FAILING') AND ((attempt_expires_at IS NOT NULL AND attempt_expires_at<=?) OR updated_at<?)").bind(now, row.id, nowEpoch, cutoff),
      d1().prepare("UPDATE workspace_requests SET status='FAILED',error_code='RUN_TIMEOUT',updated_at=? WHERE run_id=? AND status='RUNNING'").bind(now, row.id),
      d1().prepare("UPDATE run_steps SET status='FAILED',summary='生成任务超时，请重新提交。',error_code='RUN_TIMEOUT',updated_at=? WHERE run_id=? AND status IN ('PENDING','RUNNING')").bind(now, row.id),
      d1().prepare("UPDATE projects SET status=CASE WHEN current_version_id IS NULL THEN 'FAILED' ELSE 'READY' END,updated_at=? WHERE id=? AND status='BUILDING'").bind(now, row.project_id),
    ]);
  }
}

function versionFromRow(row: Row): VersionSnapshot {
  const common = {
    id: String(row.id),
    versionNo: Number(row.version_no),
    parentVersionId: row.parent_version_id ? String(row.parent_version_id) : null,
    changeSummary: String(row.change_summary),
    createdAt: String(row.created_at),
  };
  const artifactKind = row.artifact_kind === "code_bundle" ? "code_bundle" : "app_spec";
  const value = JSON.parse(String(row.app_spec_json));
  if (artifactKind === "code_bundle") return { ...common, artifactKind, appSpec: null, codeBundle: validateCodeBundle(value) };
  validateAppSpec(value as AppSpec);
  return { ...common, artifactKind, appSpec: value as AppSpec, codeBundle: null };
}

export async function getProject(ownerKey: string, projectId: string, recover = true): Promise<ProjectSnapshot> {
  await ensureSchema();
  if (recover) await recoverStaleRuns();
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
    steps: stepRows.map((row: Row) => ({ role: row.role, name: String(row.name), summary: String(row.summary), status: row.status, source: row.source ? String(row.source) : null, model: row.model ? String(row.model) : null, durationMs: row.duration_ms === null || row.duration_ms === undefined ? null : Number(row.duration_ms), attemptNo: row.attempt_no === null || row.attempt_no === undefined ? null : Number(row.attempt_no), artifact: row.artifact_json ? JSON.parse(String(row.artifact_json)) : null, errorCode: row.error_code ? String(row.error_code) : null, sharedCallId: row.shared_call_id ? String(row.shared_call_id) : null })) as AgentStep[],
    generation: generation ? {
      source: String(generation.source) as "workers_ai" | "deterministic",
      model: String(generation.model),
      outcome: String(generation.outcome) as "SUCCESS" | "FALLBACK",
      failureCode: generation.failure_code ? String(generation.failure_code) : null,
      fallbackReason: generation.fallback_reason ? String(generation.fallback_reason) : null,
      durationMs: Number(generation.duration_ms),
      artifactKind: generation.artifact_kind === "code_bundle" ? "code_bundle" : generation.artifact_kind === "app_spec" ? "app_spec" : null,
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

function projectTitle(artifact: AppSpec | CodeBundleV1) {
  return artifact.title.replace(/看板|发布清单/g, "").trim().slice(0, 40) || "未命名应用";
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
  await rateReservation(ownerKey, "create_project");
  try {
    await d1().batch([
      d1().prepare("INSERT INTO workspace_requests(owner_key,request_id,project_id,run_id,status,error_code,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").bind(ownerKey, requestId, projectId, runId, "RUNNING", null, now, now),
      d1().prepare("INSERT INTO projects(id,owner_key,title,prompt,status,current_version_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").bind(projectId, ownerKey, "正在构建", prompt, "BUILDING", null, now, now),
      d1().prepare("INSERT INTO runs(id,project_id,request_id,base_version_id,attempt_token,status,error_code,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(runId, projectId, requestId, null, attemptToken, "RUNNING", null, now, now),
      d1().prepare("INSERT INTO messages(id,project_id,role,content,created_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(), projectId, "user", prompt, now),
      ...["product", "architecture", "design", "engineering"].map((role, index) => d1().prepare("INSERT INTO run_steps(id,run_id,ordinal,role,name,status,summary,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), runId, index, role, ["Emma · Product", "Bob · Architect", "Iris · Designer", "Alex · Engineer"][index], "PENDING", "等待生成…", now, now)),
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
  output: { bundle: CodeBundleV1; summary: string; steps: AgentStep[]; generation: GenerationMeta };
  firstProject: boolean;
  startedEpoch: number;
}) {
  const { ownerKey, projectId, runId, attemptToken, baseVersionId, versionNo, output, firstProject, startedEpoch } = input;
  const now = new Date().toISOString();
  const nowEpoch = Date.now();
  const versionId = crypto.randomUUID();
  const completionClaim = await d1().prepare("UPDATE runs SET status='COMPLETING',updated_at=? WHERE id=? AND project_id=? AND attempt_token=? AND status='RUNNING' AND attempt_expires_at>? AND EXISTS(SELECT 1 FROM projects p WHERE p.id=? AND p.owner_key=? AND p.current_version_id IS runs.base_version_id)").bind(now, runId, projectId, attemptToken, nowEpoch, projectId, ownerKey).run();
  if (completionClaim.meta.changes !== 1) throw new InputError("STALE_RUN", "生成任务已失效或基础版本已经变化。", 409);
  const bundleJson = JSON.stringify(output.bundle);
  const artifactBytes = new TextEncoder().encode(output.bundle.files["index.html"] + output.bundle.files["styles.css"] + output.bundle.files["app.js"]).byteLength;
  const validatorJson = JSON.stringify({ code: "VALID", sha256: output.steps.at(-1)?.artifact?.sha256 ?? null, capabilities: output.bundle.capabilities });
  const statements = [
    d1().prepare("INSERT INTO versions(id,project_id,parent_version_id,version_no,app_spec_json,artifact_kind,change_summary,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM runs r JOIN projects p ON p.id=r.project_id WHERE r.id=? AND r.project_id=? AND r.attempt_token=? AND r.status='COMPLETING' AND r.attempt_expires_at>? AND p.owner_key=? AND p.current_version_id IS r.base_version_id)").bind(versionId, projectId, baseVersionId, versionNo, bundleJson, "code_bundle", output.summary, now, runId, projectId, attemptToken, nowEpoch, ownerKey),
    ...output.steps.map((step, index) => d1().prepare("UPDATE run_steps SET status='COMPLETED',summary=?,source=?,model=?,duration_ms=?,attempt_no=?,artifact_json=?,error_code=?,updated_at=? WHERE run_id=? AND ordinal=? AND EXISTS(SELECT 1 FROM versions WHERE id=? AND project_id=?)").bind(step.summary, step.source ?? output.generation.source, step.model ?? output.generation.model, step.durationMs ?? 0, step.attemptNo ?? 1, step.artifact ? JSON.stringify(step.artifact) : null, step.errorCode ?? null, now, runId, index, versionId, projectId)),
    d1().prepare("INSERT INTO messages(id,project_id,role,content,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM versions WHERE id=? AND project_id=?)").bind(crypto.randomUUID(), projectId, "assistant", output.summary, now, versionId, projectId),
    d1().prepare("INSERT INTO generation_events(run_id,source,model,outcome,failure_code,fallback_reason,duration_ms,artifact_kind,artifact_bytes,validator_json,input_tokens,output_tokens,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM versions WHERE id=? AND project_id=?)").bind(runId, output.generation.source, output.generation.model, output.generation.outcome, output.generation.failureCode, output.generation.fallbackReason, output.generation.durationMs, "code_bundle", artifactBytes, validatorJson, output.generation.inputTokens ?? null, output.generation.outputTokens ?? null, now, versionId, projectId),
    d1().prepare("INSERT INTO run_deadline_audit(run_id,model_deadline_at,persistence_deadline_at,response_deadline_at,model_deadline_exceeded,persistence_deadline_exceeded,response_budget_exceeded,lease_expired,observed_at) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM versions WHERE id=? AND project_id=?)").bind(runId, startedEpoch + 52_000, startedEpoch + 62_000, startedEpoch + 65_000, nowEpoch > startedEpoch + 52_000 ? 1 : 0, 0, 0, 0, nowEpoch, versionId, projectId),
    d1().prepare("UPDATE projects SET title=?,current_version_id=?,status='READY',updated_at=? WHERE id=? AND owner_key=? AND current_version_id IS ? AND EXISTS(SELECT 1 FROM versions WHERE id=? AND project_id=?)").bind(projectTitle(output.bundle), versionId, now, projectId, ownerKey, baseVersionId, versionId, projectId),
    ...(firstProject ? [d1().prepare("UPDATE workspace_requests SET status='COMPLETED',error_code=NULL,updated_at=? WHERE run_id=? AND status='RUNNING' AND EXISTS(SELECT 1 FROM projects WHERE id=? AND current_version_id=?)").bind(now, runId, projectId, versionId)] : []),
    d1().prepare("UPDATE runs SET status='COMPLETED',error_code=NULL,attempt_token=NULL,attempt_expires_at=NULL,updated_at=? WHERE id=? AND attempt_token=? AND status='COMPLETING' AND EXISTS(SELECT 1 FROM generation_events WHERE run_id=?) AND EXISTS(SELECT 1 FROM projects WHERE id=? AND current_version_id=?)").bind(now, runId, attemptToken, runId, projectId, versionId),
  ];
  try {
    await d1().batch(statements);
  } catch (error) {
    await failGeneration(projectId, runId, attemptToken, "COMPLETION_FAILED", firstProject, startedEpoch);
    throw error;
  }
  const [version, run, event, project] = await Promise.all([
    queryFirst("SELECT id FROM versions WHERE id=? AND project_id=?", versionId, projectId),
    queryFirst("SELECT status FROM runs WHERE id=?", runId),
    queryFirst("SELECT outcome FROM generation_events WHERE run_id=?", runId),
    queryFirst("SELECT current_version_id FROM projects WHERE id=? AND owner_key=?", projectId, ownerKey),
  ]);
  if (!version || run?.status !== "COMPLETED" || !event || project?.current_version_id !== versionId) {
    await failGeneration(projectId, runId, attemptToken, "COMPLETION_INCONSISTENT", firstProject, startedEpoch);
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
  const running = await queryFirst("SELECT id FROM runs WHERE project_id=? AND status IN ('RUNNING','COMPLETING','FAILING')", projectId);
  if (running) throw new InputError("PROJECT_BUSY", "项目正在生成中，请稍后再试。", 409);
  const base = await queryFirst("SELECT * FROM versions WHERE id=? AND project_id=?", baseVersionId, projectId);
  if (!base) throw new InputError("NOT_FOUND", "基础版本不存在。", 404);
  const now = new Date().toISOString();
  const runId = crypto.randomUUID();
  const attemptToken = crypto.randomUUID();
  await rateReservation(ownerKey, "generate");
  try {
    await d1().batch([
      d1().prepare("INSERT INTO runs(id,project_id,request_id,base_version_id,attempt_token,status,error_code,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(runId, projectId, requestId, baseVersionId, attemptToken, "RUNNING", null, now, now),
      d1().prepare("UPDATE projects SET status='BUILDING',updated_at=? WHERE id=? AND owner_key=? AND current_version_id=?").bind(now, projectId, ownerKey, baseVersionId),
      d1().prepare("INSERT INTO messages(id,project_id,role,content,created_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(), projectId, "user", prompt, now),
      ...["product", "architecture", "design", "engineering"].map((role, index) => d1().prepare("INSERT INTO run_steps(id,run_id,ordinal,role,name,status,summary,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), runId, index, role, ["Emma · Product", "Bob · Architect", "Iris · Designer", "Alex · Engineer"][index], "PENDING", "等待生成…", now, now)),
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
    : await d1().prepare("UPDATE run_steps SET status='COMPLETED',summary=?,source=?,model=?,duration_ms=?,attempt_no=?,artifact_json=?,error_code=?,shared_call_id=?,updated_at=? WHERE run_id=? AND ordinal=? AND status IN ('PENDING','RUNNING','COMPLETED') AND EXISTS(SELECT 1 FROM runs WHERE id=? AND attempt_token=? AND status='RUNNING')").bind(stage.summary ?? "阶段完成", stage.source ?? null, stage.model ?? null, stage.durationMs ?? 0, stage.attemptNo ?? 1, stage.artifact ? JSON.stringify(stage.artifact) : null, stage.errorCode ?? null, stage.sharedCallId ?? null, now, runId, ordinal, runId, attemptToken).run();
  if (result.meta.changes !== 1) throw new InputError("STALE_RUN", "生成任务已经失效。", 409);
  await d1().prepare("UPDATE runs SET updated_at=? WHERE id=? AND attempt_token=? AND status='RUNNING'").bind(now, runId, attemptToken).run();
}

export async function executeGeneration(ownerKey: string, projectId: string, input: { requestId?: unknown }) {
  const startedEpoch = Date.now();
  await ensureSchema();
  await recoverStaleRuns();
  const requestId = typeof input.requestId === "string" ? input.requestId : "";
  const run = await queryFirst("SELECT r.* FROM runs r JOIN projects p ON p.id=r.project_id WHERE r.project_id=? AND r.request_id=? AND p.owner_key=?", projectId, requestId, ownerKey);
  if (!run) throw new InputError("NOT_FOUND", "这个生成任务不存在。", 404);
  if (run.status === "COMPLETED") return getProject(ownerKey, projectId);
  if (run.status === "FAILED") throw new InputError(String(run.error_code ?? "GENERATION_FAILED"), "上一次生成没有完成，请重新提交。", 409);
  if (run.status === "COMPLETING" || run.status === "FAILING") return getProject(ownerKey, projectId);
  const claimedAt = new Date().toISOString();
  const attemptExpiresAt = startedEpoch + PERSISTENCE_DEADLINE_MS;
  const claim = await d1().prepare("UPDATE runs SET runner_claimed_at=?,attempt_expires_at=?,updated_at=? WHERE id=? AND status='RUNNING' AND runner_claimed_at IS NULL AND attempt_token IS NOT NULL").bind(claimedAt, attemptExpiresAt, claimedAt, run.id).run();
  if (claim.meta.changes !== 1) return getProject(ownerKey, projectId);

  const attemptToken = String(run.attempt_token);
  const baseVersionId = run.base_version_id ? String(run.base_version_id) : null;
  const firstProject = baseVersionId === null;
  const message = await queryFirst("SELECT content FROM messages WHERE project_id=? AND role='user' ORDER BY created_at DESC LIMIT 1", projectId);
  const prompt = String(message?.content ?? "");
  const base = baseVersionId ? await queryFirst("SELECT app_spec_json,artifact_kind FROM versions WHERE id=? AND project_id=?", baseVersionId, projectId) : null;
  const max = await queryFirst("SELECT MAX(version_no) AS max_no FROM versions WHERE project_id=?", projectId);
  const work = (async () => {
    let previous: AppSpec | CodeBundleV1 | undefined;
    if (base) {
      const parsed = JSON.parse(String(base.app_spec_json));
      if (base.artifact_kind === "code_bundle") previous = validateCodeBundle(parsed);
      else { validateAppSpec(parsed as AppSpec); previous = parsed as AppSpec; }
    }
    const output = await generateAppWithAgents(prompt, previous, env.AI, { onStage: (stage) => persistStage(String(run.id), attemptToken, stage) });
    await completeGeneration({ ownerKey, projectId, runId: String(run.id), requestId, attemptToken, baseVersionId, versionNo: Number(max?.max_no ?? 0) + 1, output, firstProject, startedEpoch });
  })();
  let watchdogTimer: ReturnType<typeof setTimeout> | undefined;
  const watchdog = new Promise<never>((_resolve, reject) => {
    watchdogTimer = setTimeout(async () => {
      try {
        const won = await timeoutFailureBatch(projectId, String(run.id), attemptToken, firstProject, startedEpoch);
        if (won) reject(new InputError("PERSISTENCE_TIMEOUT", "生成任务超时，已安全停止，请重新提交。", 500));
      } catch (error) { reject(error); }
    }, 60_000);
  });
  try {
    await Promise.race([work, watchdog]);
  } catch (error) {
    void work.catch(() => undefined);
    const code = error instanceof InputError || error instanceof GenerationFailure ? error.code : "GENERATION_FAILED";
    await failGeneration(projectId, String(run.id), attemptToken, code, firstProject, startedEpoch);
    if (error instanceof InputError) throw error;
    throw new InputError(code, "AI 没有生成可安全运行的应用，请调整需求后重试。", 500);
  } finally {
    if (watchdogTimer) clearTimeout(watchdogTimer);
  }
  return getProject(ownerKey, projectId);
}

async function timeoutFailureBatch(projectId: string, runId: string, attemptToken: string, firstProject: boolean, startedEpoch: number) {
  const now = new Date().toISOString(); const observedAt = Date.now();
  const results = await d1().batch([
    d1().prepare("UPDATE runs SET status='FAILED',error_code='PERSISTENCE_TIMEOUT',attempt_token=NULL,attempt_expires_at=NULL,updated_at=? WHERE id=? AND attempt_token=? AND status='RUNNING'").bind(now, runId, attemptToken),
    ...(firstProject ? [d1().prepare("UPDATE workspace_requests SET status='FAILED',error_code='PERSISTENCE_TIMEOUT',updated_at=? WHERE run_id=? AND status='RUNNING' AND EXISTS(SELECT 1 FROM runs WHERE id=? AND status='FAILED' AND error_code='PERSISTENCE_TIMEOUT')").bind(now, runId, runId)] : []),
    d1().prepare("UPDATE run_steps SET status='FAILED',summary='生成任务超时，请重新提交。',error_code='PERSISTENCE_TIMEOUT',updated_at=? WHERE run_id=? AND status IN ('PENDING','RUNNING') AND EXISTS(SELECT 1 FROM runs WHERE id=? AND status='FAILED' AND error_code='PERSISTENCE_TIMEOUT')").bind(now, runId, runId),
    d1().prepare("UPDATE projects SET status=CASE WHEN current_version_id IS NULL THEN 'FAILED' ELSE 'READY' END,updated_at=? WHERE id=? AND status='BUILDING' AND EXISTS(SELECT 1 FROM runs WHERE id=? AND status='FAILED' AND error_code='PERSISTENCE_TIMEOUT')").bind(now, projectId, runId),
    d1().prepare("INSERT OR IGNORE INTO run_deadline_audit(run_id,model_deadline_at,persistence_deadline_at,response_deadline_at,model_deadline_exceeded,persistence_deadline_exceeded,response_budget_exceeded,lease_expired,observed_at) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM runs WHERE id=? AND status='FAILED' AND error_code='PERSISTENCE_TIMEOUT')").bind(runId, startedEpoch + 52_000, startedEpoch + 62_000, startedEpoch + 65_000, 1, 0, 0, 0, observedAt, runId),
  ]);
  return results[0]?.meta.changes === 1;
}

async function failGeneration(projectId: string, runId: string, attemptToken: string, code: string, firstProject: boolean, startedEpoch = Date.now()) {
  const now = new Date().toISOString();
  const observedAt = Date.now();
  await d1().batch([
    d1().prepare("UPDATE runs SET status='FAILED',error_code=?,attempt_token=NULL,attempt_expires_at=NULL,updated_at=? WHERE id=? AND attempt_token=? AND status IN ('RUNNING','COMPLETING','FAILING')").bind(code, now, runId, attemptToken),
    ...(firstProject ? [d1().prepare("UPDATE workspace_requests SET status='FAILED',error_code=?,updated_at=? WHERE run_id=? AND status='RUNNING'").bind(code, now, runId)] : []),
    d1().prepare("UPDATE run_steps SET status='FAILED',summary='生成失败，请重新提交。',error_code=?,updated_at=? WHERE run_id=? AND status IN ('PENDING','RUNNING')").bind(code, now, runId),
    d1().prepare("UPDATE projects SET status=CASE WHEN current_version_id IS NULL THEN 'FAILED' ELSE 'READY' END,updated_at=? WHERE id=? AND status='BUILDING'").bind(now, projectId),
    d1().prepare("INSERT OR IGNORE INTO run_deadline_audit(run_id,model_deadline_at,persistence_deadline_at,response_deadline_at,model_deadline_exceeded,persistence_deadline_exceeded,response_budget_exceeded,lease_expired,observed_at) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM runs WHERE id=? AND status='FAILED')").bind(runId, startedEpoch + 52_000, startedEpoch + 62_000, startedEpoch + 65_000, observedAt > startedEpoch + 52_000 ? 1 : 0, 0, 0, 0, observedAt, runId),
  ]);
}

export async function finalizeDeadlineAudit(ownerKey: string, projectId: string, requestId: string, startedEpoch: number) {
  await ensureSchema();
  const run = await queryFirst("SELECT r.id FROM runs r JOIN projects p ON p.id=r.project_id WHERE r.project_id=? AND r.request_id=? AND p.owner_key=?", projectId, requestId, ownerKey);
  if (!run) return;
  const observedAt = Date.now();
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await d1().prepare("UPDATE run_deadline_audit SET model_deadline_exceeded=MAX(model_deadline_exceeded,?),persistence_deadline_exceeded=MAX(persistence_deadline_exceeded,?),response_budget_exceeded=MAX(response_budget_exceeded,?),lease_expired=MAX(lease_expired,CASE WHEN EXISTS(SELECT 1 FROM runs WHERE id=? AND error_code IN ('PERSISTENCE_TIMEOUT','RUN_TIMEOUT')) THEN 1 ELSE 0 END),observed_at=MAX(observed_at,?) WHERE run_id=?").bind(observedAt > startedEpoch + 52_000 ? 1 : 0, observedAt > startedEpoch + 62_000 ? 1 : 0, observedAt > startedEpoch + 64_500 ? 1 : 0, run.id, observedAt, run.id).run();
      if (result.meta.changes === 1) return;
      throw new Error("Deadline audit row is missing");
    } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error("Deadline audit finalization failed");
}

export async function activateVersion(ownerKey: string, projectId: string, versionId: string, expectedCurrentVersionId: unknown) {
  await ensureSchema();
  if (typeof expectedCurrentVersionId !== "string") throw new InputError("INVALID_REQUEST", "缺少当前版本信息。", 400);
  const version = await queryFirst("SELECT id FROM versions WHERE id=? AND project_id=?", versionId, projectId);
  if (!version) throw new InputError("NOT_FOUND", "版本不存在。", 404);
  const result = await d1().prepare("UPDATE projects SET current_version_id=?,updated_at=? WHERE id=? AND owner_key=? AND current_version_id=? AND NOT EXISTS(SELECT 1 FROM runs WHERE project_id=? AND status IN ('RUNNING','COMPLETING','FAILING'))").bind(versionId, new Date().toISOString(), projectId, ownerKey, expectedCurrentVersionId, projectId).run();
  if (result.meta.changes !== 1) throw new InputError("STALE_VERSION", "项目版本已经变化，请刷新后重试。", 409);
  return getProject(ownerKey, projectId);
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type StorageInput =
  | { requestId: string; op: "get"; key: string }
  | { requestId: string; op: "set"; key: string; value: JsonValue }
  | { requestId: string; op: "delete"; key: string }
  | { requestId: string; op: "list" }
  | { requestId: string; op: "clear" };

function storageRequest(value: unknown): StorageInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InputError("INVALID_REQUEST", "存储请求格式无效。", 400);
  const record = value as Record<string, unknown>;
  if (typeof record.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(record.requestId)) throw new InputError("INVALID_REQUEST", "存储请求编号无效。", 400);
  if (!(["get", "set", "delete", "list", "clear"] as const).includes(record.op as never)) throw new InputError("INVALID_REQUEST", "存储操作无效。", 400);
  const op = record.op as StorageInput["op"];
  const expected = op === "set" ? ["requestId", "op", "key", "value"] : op === "get" || op === "delete" ? ["requestId", "op", "key"] : ["requestId", "op"];
  const actual = Object.keys(record).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== [...expected].sort()[index])) throw new InputError("INVALID_REQUEST", "存储请求包含额外字段。", 400);
  if (op === "get" || op === "set" || op === "delete") {
    if (typeof record.key !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(record.key) || record.key.startsWith("__atoms.")) throw new InputError("INVALID_STATE_KEY", "状态 key 不符合规则。", 400);
  }
  if (op === "set") return { requestId: record.requestId, op, key: record.key as string, value: validateJsonValue(record.value) };
  if (op === "get" || op === "delete") return { requestId: record.requestId, op, key: record.key as string };
  return { requestId: record.requestId, op };
}

function validateJsonValue(value: unknown): JsonValue {
  let nodes = 0;
  const visit = (item: unknown, depth: number): JsonValue => {
    nodes += 1;
    if (nodes > 500 || depth > 8) throw new InputError("INVALID_STATE_VALUE", "状态数据结构过深或过大。", 400);
    if (item === null || typeof item === "boolean" || typeof item === "string") return item;
    if (typeof item === "number") {
      if (!Number.isFinite(item)) throw new InputError("INVALID_STATE_VALUE", "状态数字必须是有限值。", 400);
      return item;
    }
    if (Array.isArray(item)) return item.map((entry) => visit(entry, depth + 1));
    if (item && typeof item === "object" && Object.getPrototypeOf(item) === Object.prototype) {
      return Object.fromEntries(Object.entries(item as Record<string, unknown>).map(([key, entry]) => [key, visit(entry, depth + 1)]));
    }
    throw new InputError("INVALID_STATE_VALUE", "状态值必须是 JSON。", 400);
  };
  const result = visit(value, 0);
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > 8 * 1024) throw new InputError("INVALID_STATE_VALUE", "单个状态值不能超过 8 KiB。", 400);
  return result;
}

async function reserveStorageWrite(ownerKey: string) {
  const now = Date.now();
  const cutoff = now - 60_000;
  const result = await d1().prepare("INSERT INTO storage_rate_events(id,owner_key,created_at) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM storage_rate_events WHERE owner_key=? AND created_at>=?)<60 AND (SELECT COUNT(*) FROM storage_rate_events WHERE created_at>=?)<1000").bind(crypto.randomUUID(), ownerKey, now, ownerKey, cutoff, cutoff).run();
  if (result.meta.changes !== 1) throw new InputError("RATE_LIMITED", "应用保存过于频繁，请稍后再试。", 429);
  await d1().prepare("DELETE FROM storage_rate_events WHERE created_at<?").bind(now - 300_000).run();
}

export async function handleStorage(ownerKey: string, projectId: string, rawInput: unknown) {
  await ensureSchema();
  const input = storageRequest(rawInput);
  const owned = await queryFirst("SELECT 1 AS ok FROM projects WHERE id=? AND owner_key=?", projectId, ownerKey);
  if (!owned) throw new InputError("NOT_FOUND", "项目不存在。", 404);
  if (input.op === "get") {
    const row = await queryFirst("SELECT value_json FROM app_state WHERE owner_key=? AND project_id=? AND state_key=?", ownerKey, projectId, input.key);
    return { op: "get" as const, found: Boolean(row), value: row ? JSON.parse(String(row.value_json)) as JsonValue : null };
  }
  if (input.op === "list") {
    const rows = await queryAll("SELECT state_key,value_json FROM app_state WHERE owner_key=? AND project_id=? ORDER BY state_key", ownerKey, projectId);
    return { op: "list" as const, items: rows.map((row) => ({ key: String(row.state_key), value: JSON.parse(String(row.value_json)) as JsonValue })) };
  }
  await reserveStorageWrite(ownerKey);
  if (input.op === "set") {
    const json = JSON.stringify(input.value); const valueBytes = new TextEncoder().encode(json).byteLength; const now = new Date().toISOString();
    const result = await d1().prepare("INSERT INTO app_state(owner_key,project_id,state_key,value_json,value_bytes,updated_at) SELECT p.owner_key,p.id,?,?,?,? FROM projects p WHERE p.id=? AND p.owner_key=? AND (EXISTS(SELECT 1 FROM app_state s WHERE s.owner_key=p.owner_key AND s.project_id=p.id AND s.state_key=?) OR (SELECT COUNT(*) FROM app_state s WHERE s.owner_key=p.owner_key AND s.project_id=p.id)<50) AND ((SELECT COALESCE(SUM(value_bytes),0) FROM app_state s WHERE s.owner_key=p.owner_key AND s.project_id=p.id)-COALESCE((SELECT value_bytes FROM app_state s WHERE s.owner_key=p.owner_key AND s.project_id=p.id AND s.state_key=?),0)+?)<=65536 ON CONFLICT(owner_key,project_id,state_key) DO UPDATE SET value_json=excluded.value_json,value_bytes=excluded.value_bytes,updated_at=excluded.updated_at").bind(input.key, json, valueBytes, now, projectId, ownerKey, input.key, input.key, valueBytes).run();
    if (result.meta.changes !== 1) {
      const stats = await queryFirst("SELECT COUNT(*) AS total,COALESCE(SUM(value_bytes),0) AS bytes FROM app_state WHERE owner_key=? AND project_id=?", ownerKey, projectId);
      const existing = await queryFirst("SELECT value_bytes FROM app_state WHERE owner_key=? AND project_id=? AND state_key=?", ownerKey, projectId, input.key);
      if (!existing && Number(stats?.total ?? 0) >= 50) throw new InputError("STATE_KEY_LIMIT", "这个应用最多保存 50 个状态 key。", 409);
      const projected = Number(stats?.bytes ?? 0) - Number(existing?.value_bytes ?? 0) + valueBytes;
      if (projected > 65_536) throw new InputError("STATE_BYTES_LIMIT", "这个应用的状态总量不能超过 64 KiB。", 409);
      throw new InputError("PERSISTENCE_ERROR", "状态没有保存成功。", 500);
    }
    return { op: "set" as const, stored: true as const };
  }
  if (input.op === "delete") {
    const result = await d1().prepare("DELETE FROM app_state WHERE owner_key=? AND project_id=? AND state_key=? AND EXISTS(SELECT 1 FROM projects WHERE id=? AND owner_key=?)").bind(ownerKey, projectId, input.key, projectId, ownerKey).run();
    return { op: "delete" as const, deleted: result.meta.changes === 1 };
  }
  const existing = await queryFirst("SELECT COUNT(*) AS total FROM app_state WHERE owner_key=? AND project_id=?", ownerKey, projectId);
  await d1().prepare("DELETE FROM app_state WHERE owner_key=? AND project_id=? AND EXISTS(SELECT 1 FROM projects WHERE id=? AND owner_key=?)").bind(ownerKey, projectId, projectId, ownerKey).run();
  return { op: "clear" as const, cleared: Number(existing?.total ?? 0) };
}
