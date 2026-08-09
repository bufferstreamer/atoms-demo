import { generateAppSpec, validateAppSpec } from "./generator";
import type { AgentStep, AppSpec } from "./types";

export const WORKERS_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
export const MODEL_DEADLINE_MS = 52_000;
export const PERSISTENCE_DEADLINE_MS = 62_000;
export const API_DEADLINE_MS = 65_000;
export const STAGE_TIMEOUTS_MS = { product: 7_000, architecture: 9_000, design: 7_000, engineering: 22_000, repair: 7_000 } as const;
const MAX_STAGE_BYTES = 12 * 1024;
const MAX_ENGINEERING_BYTES = 48 * 1024;
const shortId = { type: "string", minLength: 1, maxLength: 60 } as const;
const label = { type: "string", minLength: 1, maxLength: 120 } as const;

export const APP_SPEC_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["schemaVersion", "kind", "title", "subtitle", "theme", "stats", "filters", "cards", "actions"],
  properties: {
    schemaVersion: { const: 1 }, kind: { enum: ["dashboard", "tracker", "landing"] },
    title: { type: "string", minLength: 1, maxLength: 60 }, subtitle: { type: "string", maxLength: 140 },
    theme: { type: "object", additionalProperties: false, required: ["accent", "density"], properties: { accent: { enum: ["violet", "coral", "mint", "blue"] }, density: { enum: ["comfortable", "compact"] } } },
    stats: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, required: ["id", "label", "value"], properties: { id: shortId, label, value: label, delta: { type: "string", maxLength: 120 } } } },
    filters: { type: "array", maxItems: 2, items: { type: "object", additionalProperties: false, required: ["id", "label", "options", "defaultValue"], properties: { id: shortId, label, options: { type: "array", minItems: 1, maxItems: 6, items: { type: "string", minLength: 1, maxLength: 80 } }, defaultValue: { type: "string", minLength: 1, maxLength: 80 }, allValue: { type: "string", minLength: 1, maxLength: 80 } } } },
    cards: { type: "array", minItems: 1, maxItems: 12, items: { type: "object", additionalProperties: false, required: ["id", "title", "description", "tag"], properties: { id: shortId, title: label, description: { type: "string", maxLength: 240 }, tag: { type: "string", maxLength: 80 }, filterValues: { type: "object", additionalProperties: { type: "string", maxLength: 80 } }, done: { type: "boolean" } } } },
    form: { type: "object", additionalProperties: false, required: ["id", "title", "fields", "submitLabel"], properties: { id: shortId, title: label, fields: { type: "array", minItems: 1, maxItems: 4, items: { type: "object", additionalProperties: false, required: ["id", "label", "placeholder", "required"], properties: { id: shortId, label, placeholder: { type: "string", maxLength: 160 }, required: { type: "boolean" } } } }, submitLabel: { type: "string", minLength: 1, maxLength: 80 } } },
    actions: { type: "array", minItems: 1, maxItems: 8, items: { oneOf: [
      { type: "object", additionalProperties: false, required: ["id", "label", "kind", "targetId", "value"], properties: { id: shortId, label, kind: { const: "set_filter" }, targetId: shortId, value: { type: "string", minLength: 1, maxLength: 80 } } },
      { type: "object", additionalProperties: false, required: ["id", "label", "kind", "targetId"], properties: { id: shortId, label, kind: { const: "toggle_item" }, targetId: shortId } },
      { type: "object", additionalProperties: false, required: ["id", "label", "kind", "targetId"], properties: { id: shortId, label, kind: { const: "add_item" }, targetId: shortId } },
      { type: "object", additionalProperties: false, required: ["id", "label", "kind", "message"], properties: { id: shortId, label, kind: { const: "show_toast" }, message: { type: "string", minLength: 1, maxLength: 180 } } },
    ] } },
  },
} as const;

const cap = { type: "string", enum: ["filter", "form", "toggle", "stats", "toast"] } as const;
export const STAGE_SCHEMAS = {
  product: { $schema: "https://json-schema.org/draft/2020-12/schema", type: "object", additionalProperties: false, required: ["summary", "audience", "goal", "requiredCapabilities", "forbiddenCapabilities"], properties: { summary: { type: "string", minLength: 1, maxLength: 180 }, audience: { type: "string", minLength: 1, maxLength: 120 }, goal: { type: "string", minLength: 1, maxLength: 180 }, requiredCapabilities: { type: "array", maxItems: 6, uniqueItems: true, items: cap }, forbiddenCapabilities: { type: "array", maxItems: 6, uniqueItems: true, items: { type: "string", enum: ["filter", "form", "toggle", "stats", "toast", "external_script"] } } } },
  architecture: { $schema: "https://json-schema.org/draft/2020-12/schema", type: "object", additionalProperties: false, required: ["summary", "kind", "components", "interactionPlan", "persistencePlan"], properties: { summary: { type: "string", minLength: 1, maxLength: 180 }, kind: { enum: ["dashboard", "tracker", "landing"] }, components: { type: "array", minItems: 1, maxItems: 8, uniqueItems: true, items: { enum: ["stats", "filters", "cards", "form", "actions"] } }, interactionPlan: { type: "array", minItems: 1, maxItems: 6, uniqueItems: true, items: { enum: ["set_filter", "toggle_item", "add_item", "show_toast"] } }, persistencePlan: { type: "string", minLength: 1, maxLength: 180 } } },
  design: { $schema: "https://json-schema.org/draft/2020-12/schema", type: "object", additionalProperties: false, required: ["summary", "visualDirection", "layout", "interactionStates", "accessibilityNotes"], properties: { summary: { type: "string", minLength: 1, maxLength: 180 }, visualDirection: { type: "string", minLength: 1, maxLength: 180 }, layout: { enum: ["dashboard-grid", "tracker-list", "landing-sections"] }, interactionStates: { type: "array", minItems: 1, maxItems: 6, uniqueItems: true, items: { enum: ["default", "filtered", "completed", "form-valid", "form-error", "toast"] } }, accessibilityNotes: { type: "array", minItems: 1, maxItems: 4, uniqueItems: true, items: { type: "string", minLength: 1, maxLength: 120 } } } },
  engineering: { $schema: "https://json-schema.org/draft/2020-12/schema", type: "object", additionalProperties: false, required: ["spec", "summary"], properties: { spec: APP_SPEC_SCHEMA, summary: { type: "string", minLength: 1, maxLength: 180 } } },
} as const;

export const APP_SPEC_ENVELOPE_SCHEMA = STAGE_SCHEMAS.engineering;
const ROLE_NAMES = { product: "Emma · Product", architecture: "Bob · Architect", design: "Iris · Designer", engineering: "Alex · Engineer" } as const;

export type AiRunner = { run(model: string, input: Record<string, unknown>): Promise<unknown> };
export type GenerationMeta = { source: "workers_ai" | "deterministic"; model: string; outcome: "SUCCESS" | "FALLBACK"; failureCode: string | null; durationMs: number };
export type GeneratedApp = { spec: AppSpec; summary: string; steps: AgentStep[]; generation: GenerationMeta };
export type StageRole = "product" | "architecture" | "design" | "engineering";
export type StageProgress = { role: StageRole; status: "RUNNING" | "COMPLETED"; summary?: string; artifact?: Record<string, unknown>; source?: "workers_ai" | "deterministic"; model?: string; durationMs?: number; attemptNo?: number; errorCode?: string | null };
export type GenerationOptions = { now?: () => number; onStage?: (progress: StageProgress) => Promise<void> };

class ModelOutputError extends Error { constructor(readonly code: string, readonly path = "") { super(code); } }
function record(value: unknown, code: string): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new ModelOutputError(code); return value as Record<string, unknown>; }
function exact(value: Record<string, unknown>, keys: string[], code: string) { const a = Object.keys(value).sort(); const b = [...keys].sort(); if (a.length !== b.length || a.some((key, i) => key !== b[i])) throw new ModelOutputError(code); }
function text(value: unknown, max: number, code: string) { if (typeof value !== "string") throw new ModelOutputError(code); const clean = Array.from(value, (character) => { const point = character.codePointAt(0) ?? 0; return point < 32 || point === 127 ? " " : character; }).join("").replace(/\s+/g, " ").trim(); if (!clean || clean.length > max) throw new ModelOutputError(code); return clean; }
function list(value: unknown, allowed: readonly string[], max: number, code: string, min = 0) { if (!Array.isArray(value) || value.length < min || value.length > max || new Set(value).size !== value.length || value.some((item) => typeof item !== "string" || !allowed.includes(item))) throw new ModelOutputError(code); return value as string[]; }
function assertBytes(value: unknown, max: number, code: string) { let json: string; try { json = JSON.stringify(value); } catch { throw new ModelOutputError(code); } if (new TextEncoder().encode(json).byteLength > max) throw new ModelOutputError(code); return json; }

function parseProduct(value: unknown) { const code = "INVALID_PRODUCT_ARTIFACT"; const v = record(value, code); exact(v, ["summary", "audience", "goal", "requiredCapabilities", "forbiddenCapabilities"], code); const artifact = { summary: text(v.summary, 180, code), audience: text(v.audience, 120, code), goal: text(v.goal, 180, code), requiredCapabilities: list(v.requiredCapabilities, ["filter", "form", "toggle", "stats", "toast"], 6, code), forbiddenCapabilities: list(v.forbiddenCapabilities, ["filter", "form", "toggle", "stats", "toast", "external_script"], 6, code) }; assertBytes(artifact, MAX_STAGE_BYTES, code); return artifact; }
function parseArchitecture(value: unknown) { const code = "INVALID_ARCHITECTURE_ARTIFACT"; const v = record(value, code); exact(v, ["summary", "kind", "components", "interactionPlan", "persistencePlan"], code); const kind = list([v.kind], ["dashboard", "tracker", "landing"], 1, code, 1)[0] as AppSpec["kind"]; const artifact = { summary: text(v.summary, 180, code), kind, components: list(v.components, ["stats", "filters", "cards", "form", "actions"], 8, code, 1), interactionPlan: list(v.interactionPlan, ["set_filter", "toggle_item", "add_item", "show_toast"], 6, code, 1), persistencePlan: text(v.persistencePlan, 180, code) }; assertBytes(artifact, MAX_STAGE_BYTES, code); return artifact; }
function parseDesign(value: unknown) { const code = "INVALID_DESIGN_ARTIFACT"; const v = record(value, code); exact(v, ["summary", "visualDirection", "layout", "interactionStates", "accessibilityNotes"], code); const layout = list([v.layout], ["dashboard-grid", "tracker-list", "landing-sections"], 1, code, 1)[0]; const artifact = { summary: text(v.summary, 180, code), visualDirection: text(v.visualDirection, 180, code), layout, interactionStates: list(v.interactionStates, ["default", "filtered", "completed", "form-valid", "form-error", "toast"], 6, code, 1), accessibilityNotes: Array.isArray(v.accessibilityNotes) ? v.accessibilityNotes.map((item) => text(item, 120, code)) : (() => { throw new ModelOutputError(code); })() }; if (artifact.accessibilityNotes.length < 1 || artifact.accessibilityNotes.length > 4 || new Set(artifact.accessibilityNotes).size !== artifact.accessibilityNotes.length) throw new ModelOutputError(code); assertBytes(artifact, MAX_STAGE_BYTES, code); return artifact; }

function assertAppSpec(value: unknown) {
  const code = "INVALID_APP_SPEC"; const spec = record(value, code);
  exact(spec, ["schemaVersion", "kind", "title", "subtitle", "theme", "stats", "filters", "cards", "actions", ...(spec.form === undefined ? [] : ["form"])], code);
  try { validateAppSpec(spec as AppSpec); } catch { throw new ModelOutputError(code); }
  return spec as AppSpec;
}
function parseEngineering(value: unknown) { const v = record(value, "INVALID_ENGINEERING_ARTIFACT"); exact(v, ["spec", "summary"], "INVALID_ENGINEERING_ARTIFACT"); assertBytes(v, MAX_ENGINEERING_BYTES, "RESPONSE_TOO_LARGE"); return { spec: assertAppSpec(v.spec), summary: text(v.summary, 180, "INVALID_ENGINEERING_ARTIFACT") }; }

function extract(raw: unknown, max: number) {
  let value = raw;
  if (typeof raw !== "string") { const wrapper = record(raw, "INVALID_ENVELOPE"); value = "response" in wrapper ? wrapper.response : wrapper; }
  if (typeof value === "string") { if (new TextEncoder().encode(value).byteLength > max) throw new ModelOutputError("RESPONSE_TOO_LARGE"); try { return JSON.parse(value); } catch { throw new ModelOutputError("INVALID_JSON"); } }
  assertBytes(value, max, "RESPONSE_TOO_LARGE"); return value;
}
function timeout<T>(promise: Promise<T>, ms: number): Promise<T> { return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new ModelOutputError("MODEL_TIMEOUT")), ms); promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); }); }); }
function errorCode(error: unknown) { return error instanceof ModelOutputError ? error.code : "MODEL_ERROR"; }

function abilityPresent(spec: AppSpec, ability: string) {
  if (ability === "filter") return spec.filters.length > 0 && spec.actions.some((a) => a.kind === "set_filter");
  if (ability === "form") return Boolean(spec.form) && spec.actions.some((a) => a.kind === "add_item");
  if (ability === "toggle") return spec.actions.some((a) => a.kind === "toggle_item");
  if (ability === "stats") return spec.stats.length > 0;
  if (ability === "toast") return spec.actions.some((a) => a.kind === "show_toast");
  return false;
}
function checkCapabilities(spec: AppSpec, product: ReturnType<typeof parseProduct>) { for (const ability of product.requiredCapabilities) if (!abilityPresent(spec, ability)) throw new ModelOutputError("MISSING_REQUIRED_CAPABILITY", ability); for (const ability of product.forbiddenCapabilities) if (ability !== "external_script" && abilityPresent(spec, ability)) throw new ModelOutputError("FORBIDDEN_CAPABILITY", ability); }

function stageSystem(role: StageRole, context: string) {
  const common = "只输出符合 JSON Schema 的 JSON，不要 Markdown、HTML、CSS、JavaScript、URL 或额外字段。使用用户的语言。";
  if (role === "product") return `你是产品 Agent。提炼受众、目标、必须和禁止的交互能力。${common}`;
  if (role === "architecture") return `你是架构 Agent。基于已验证产品简报规划 AppSpec 组件、交互与持久化。${common}\n上下文:${context}`;
  if (role === "design") return `你是设计 Agent。基于已验证产品与架构产物定义布局、视觉和交互状态。${common}\n上下文:${context}`;
  return `你是工程 Agent。基于全部已验证产物返回完整安全 AppSpec。所有 id 全局唯一，action target/value 必须存在；必须严格满足 Product required/forbidden capabilities。${common}\n上下文:${context}`;
}

export async function generateAppWithAgents(prompt: string, previous: AppSpec | undefined, runner: AiRunner | undefined, options: GenerationOptions = {}): Promise<GeneratedApp> {
  const now = options.now ?? Date.now; const started = now(); const artifacts: Record<string, Record<string, unknown>> = {}; const steps: AgentStep[] = [];
  const progress = async (item: StageProgress) => { await options.onStage?.(item); };
  if (!runner) return fallback("AI_UNAVAILABLE");
  const aiRunner = runner;

  async function call(role: StageRole, schema: unknown, maxTokens: number, parser: (value: unknown) => Record<string, unknown>, attemptNo = 1, repairReason?: string) {
    const stageStarted = now(); const configured = role === "engineering" && attemptNo === 2 ? STAGE_TIMEOUTS_MS.repair : STAGE_TIMEOUTS_MS[role]; const remaining = MODEL_DEADLINE_MS - (stageStarted - started);
    if (remaining <= 0) throw new ModelOutputError("MODEL_BUDGET_EXHAUSTED");
    await progress({ role, status: "RUNNING", attemptNo });
    const context = JSON.stringify({ ...artifacts, previous: previous ?? null, repair: repairReason ?? null });
    const raw = await timeout(aiRunner.run(WORKERS_AI_MODEL, { messages: [{ role: "system", content: stageSystem(role, context) }, { role: "user", content: prompt }], max_tokens: maxTokens, temperature: role === "engineering" ? 0.25 : 0.2, response_format: { type: "json_schema", json_schema: schema } }), Math.min(configured, remaining));
    if (now() - started >= MODEL_DEADLINE_MS) throw new ModelOutputError("MODEL_BUDGET_EXHAUSTED");
    const parsed = parser(extract(raw, role === "engineering" ? MAX_ENGINEERING_BYTES : MAX_STAGE_BYTES));
    return { parsed, durationMs: now() - stageStarted };
  }

  try {
    const productResult = await call("product", STAGE_SCHEMAS.product, 420, (value) => parseProduct(value)); const product = productResult.parsed as ReturnType<typeof parseProduct>; artifacts.product = product; await progress({ role: "product", status: "COMPLETED", summary: product.summary, artifact: product, source: "workers_ai", model: WORKERS_AI_MODEL, durationMs: productResult.durationMs, attemptNo: 1 }); steps.push({ role: "product", name: ROLE_NAMES.product, summary: product.summary, status: "COMPLETED", source: "workers_ai", model: WORKERS_AI_MODEL, durationMs: productResult.durationMs, attemptNo: 1, artifact: product });
    const architectureResult = await call("architecture", STAGE_SCHEMAS.architecture, 520, (value) => parseArchitecture(value)); const architecture = architectureResult.parsed as ReturnType<typeof parseArchitecture>; artifacts.architecture = architecture; await progress({ role: "architecture", status: "COMPLETED", summary: architecture.summary, artifact: architecture, source: "workers_ai", model: WORKERS_AI_MODEL, durationMs: architectureResult.durationMs, attemptNo: 1 }); steps.push({ role: "architecture", name: ROLE_NAMES.architecture, summary: architecture.summary, status: "COMPLETED", source: "workers_ai", model: WORKERS_AI_MODEL, durationMs: architectureResult.durationMs, attemptNo: 1, artifact: architecture });
    const designResult = await call("design", STAGE_SCHEMAS.design, 420, (value) => parseDesign(value)); const design = designResult.parsed as ReturnType<typeof parseDesign>; artifacts.design = design; await progress({ role: "design", status: "COMPLETED", summary: design.summary, artifact: design, source: "workers_ai", model: WORKERS_AI_MODEL, durationMs: designResult.durationMs, attemptNo: 1 }); steps.push({ role: "design", name: ROLE_NAMES.design, summary: design.summary, status: "COMPLETED", source: "workers_ai", model: WORKERS_AI_MODEL, durationMs: designResult.durationMs, attemptNo: 1, artifact: design });
    let engineering: ReturnType<typeof parseEngineering>; let engineeringDuration = 0; let repaired = false;
    try { const result = await call("engineering", STAGE_SCHEMAS.engineering, 2200, (value) => parseEngineering(value)); engineering = result.parsed as ReturnType<typeof parseEngineering>; engineeringDuration += result.durationMs; checkCapabilities(engineering.spec, product); }
    catch (firstError) { const code = errorCode(firstError); if (!["INVALID_ENGINEERING_ARTIFACT", "INVALID_APP_SPEC", "MISSING_REQUIRED_CAPABILITY", "FORBIDDEN_CAPABILITY"].includes(code)) throw firstError; const reason = `${code}${firstError instanceof ModelOutputError && firstError.path ? `:${firstError.path}` : ""}`; const result = await call("engineering", STAGE_SCHEMAS.engineering, 2200, (value) => parseEngineering(value), 2, reason); engineering = result.parsed as ReturnType<typeof parseEngineering>; engineeringDuration += result.durationMs; checkCapabilities(engineering.spec, product); repaired = true; }
    const engineeringArtifact = { summary: engineering.summary, repaired }; await progress({ role: "engineering", status: "COMPLETED", summary: engineering.summary, artifact: engineeringArtifact, source: "workers_ai", model: WORKERS_AI_MODEL, durationMs: engineeringDuration, attemptNo: repaired ? 2 : 1 }); steps.push({ role: "engineering", name: ROLE_NAMES.engineering, summary: engineering.summary, status: "COMPLETED", source: "workers_ai", model: WORKERS_AI_MODEL, durationMs: engineeringDuration, attemptNo: repaired ? 2 : 1, artifact: engineeringArtifact });
    return { spec: engineering.spec, summary: engineering.summary, steps, generation: { source: "workers_ai", model: WORKERS_AI_MODEL, outcome: "SUCCESS", failureCode: null, durationMs: now() - started } };
  } catch (error) { return fallback(errorCode(error)); }

  async function fallback(code: string): Promise<GeneratedApp> {
    const generated = generateAppSpec(prompt, previous); const fallbackSteps = generated.steps.map((step) => ({ ...step, source: "deterministic" as const, model: "deterministic-v1", durationMs: 0, attemptNo: 1, artifact: { summary: step.summary, fallback: true } }));
    for (const step of fallbackSteps) await progress({ role: step.role, status: "COMPLETED", summary: step.summary, artifact: step.artifact, source: "deterministic", model: "deterministic-v1", durationMs: 0, attemptNo: 1, errorCode: code });
    return { ...generated, steps: fallbackSteps, generation: { source: "deterministic", model: "deterministic-v1", outcome: "FALLBACK", failureCode: code, durationMs: now() - started } };
  }
}

export const generateAppWithAI = generateAppWithAgents;
