import { CodeBundleError, compileCounterBundle, parseCodeBundle } from "./code-bundle";
import type { AgentStep, AppSpec, CodeBundleV1 } from "./types";

export const PLANNING_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
export const ENGINEERING_MODEL = "@cf/qwen/qwen2.5-coder-32b-instruct";
export const MODEL_DEADLINE_MS = 52_000;
export const PERSISTENCE_DEADLINE_MS = 62_000;
export const API_DEADLINE_MS = 65_000;
export const STAGE_TIMEOUTS_MS = { planning: 12_000, engineering: 32_000, repair: 8_000 } as const;
const MAX_PLAN_BYTES = 32 * 1024;
const ROLE_NAMES = { product: "Emma · Product", architecture: "Bob · Architect", design: "Iris · Designer", engineering: "Alex · Engineer" } as const;

const textSchema = (maxLength: number) => ({ type: "string", minLength: 1, maxLength });
export const PRODUCT_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["schemaVersion", "summary", "audience", "goal", "features", "dataEntities", "persistenceRequired"],
  properties: {
    schemaVersion: { const: 1 }, summary: textSchema(180), audience: textSchema(120), goal: textSchema(180),
    features: { type: "array", minItems: 1, maxItems: 8, uniqueItems: true, items: textSchema(120) },
    dataEntities: { type: "array", maxItems: 6, uniqueItems: true, items: textSchema(80) },
    persistenceRequired: { type: "boolean" },
  },
} as const;
export const ARCHITECTURE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["schemaVersion", "summary", "components", "interactions", "stateModel", "storageKeys", "constraints"],
  properties: {
    schemaVersion: { const: 1 }, summary: textSchema(180),
    components: { type: "array", minItems: 1, maxItems: 10, uniqueItems: true, items: textSchema(80) },
    interactions: { type: "array", minItems: 1, maxItems: 10, uniqueItems: true, items: textSchema(120) },
    stateModel: textSchema(240),
    storageKeys: { type: "array", maxItems: 10, uniqueItems: true, items: { type: "string", pattern: "^[A-Za-z0-9._-]{1,64}$" } },
    constraints: { type: "array", maxItems: 8, uniqueItems: true, items: textSchema(120) },
  },
} as const;
export const DESIGN_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["schemaVersion", "summary", "visualDirection", "layout", "colorTokens", "interactionStates", "responsiveNotes", "accessibilityNotes"],
  properties: {
    schemaVersion: { const: 1 }, summary: textSchema(180), visualDirection: textSchema(180), layout: textSchema(120),
    colorTokens: { type: "object", additionalProperties: false, required: ["background", "surface", "text", "accent", "muted"], properties: Object.fromEntries(["background", "surface", "text", "accent", "muted"].map((key) => [key, { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" }])) },
    interactionStates: { type: "array", minItems: 1, maxItems: 10, uniqueItems: true, items: textSchema(100) },
    responsiveNotes: { type: "array", minItems: 1, maxItems: 6, uniqueItems: true, items: textSchema(120) },
    accessibilityNotes: { type: "array", minItems: 1, maxItems: 6, uniqueItems: true, items: textSchema(120) },
  },
} as const;
export const PLANNING_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object", additionalProperties: false, required: ["schemaVersion", "product", "architecture", "design"],
  properties: { schemaVersion: { const: 1 }, product: PRODUCT_SCHEMA, architecture: ARCHITECTURE_SCHEMA, design: DESIGN_SCHEMA },
} as const;

type ProductPlan = {
  schemaVersion: 1; summary: string; audience: string; goal: string; features: string[]; dataEntities: string[]; persistenceRequired: boolean;
};
type ArchitecturePlan = {
  schemaVersion: 1; summary: string; components: string[]; interactions: string[]; stateModel: string; storageKeys: string[]; constraints: string[];
};
type DesignPlan = {
  schemaVersion: 1; summary: string; visualDirection: string; layout: string;
  colorTokens: { background: string; surface: string; text: string; accent: string; muted: string };
  interactionStates: string[]; responsiveNotes: string[]; accessibilityNotes: string[];
};
type PlanningEnvelope = { schemaVersion: 1; product: ProductPlan; architecture: ArchitecturePlan; design: DesignPlan };

export type AiRunner = { run(model: string, input: Record<string, unknown>): Promise<unknown> };
export type GenerationMeta = {
  source: "workers_ai" | "deterministic";
  model: string;
  outcome: "SUCCESS";
  failureCode: string | null;
  fallbackReason: string | null;
  durationMs: number;
  artifactKind: "code_bundle";
  inputTokens?: number | null;
  outputTokens?: number | null;
};
export type GeneratedApp = { bundle: CodeBundleV1; summary: string; steps: AgentStep[]; generation: GenerationMeta };
export type StageRole = "product" | "architecture" | "design" | "engineering";
export type StageProgress = {
  role: StageRole; status: "RUNNING" | "COMPLETED"; summary?: string; artifact?: Record<string, unknown>;
  source?: "workers_ai" | "deterministic"; model?: string; durationMs?: number; attemptNo?: number; errorCode?: string | null; sharedCallId?: string | null;
};
export type GenerationOptions = { now?: () => number; onStage?: (progress: StageProgress) => Promise<void> };

export class GenerationFailure extends Error {
  constructor(readonly code: string, readonly path = "") {
    super(path ? `${code}:${path}` : code);
    this.name = "GenerationFailure";
  }
}

function utf8Bytes(value: string) { return new TextEncoder().encode(value).byteLength; }
function object(value: unknown, code: string, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new GenerationFailure(code, path);
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: string[], code: string, path: string) {
  const actual = Object.keys(value).sort(); const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new GenerationFailure(code, path);
}
function text(value: unknown, max: number, code: string, path: string) {
  if (typeof value !== "string") throw new GenerationFailure(code, path);
  const trimmed = value.trim();
  const points = Array.from(trimmed);
  if (points.length < 1 || points.length > max || points.some((character) => { const point = character.codePointAt(0) ?? 0; return point < 32 || point === 127; })) throw new GenerationFailure(code, path);
  return trimmed;
}
function stringList(value: unknown, min: number, max: number, itemMax: number, code: string, path: string, pattern?: RegExp) {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new GenerationFailure(code, path);
  const parsed = value.map((item, index) => text(item, itemMax, code, `${path}.${index}`));
  if (new Set(parsed).size !== parsed.length || (pattern && parsed.some((item) => !pattern.test(item)))) throw new GenerationFailure(code, path);
  return parsed;
}
function parseProduct(value: unknown): ProductPlan {
  const code = "INVALID_PLANNING_ARTIFACT"; const path = "product"; const item = object(value, code, path);
  exact(item, ["schemaVersion", "summary", "audience", "goal", "features", "dataEntities", "persistenceRequired"], code, path);
  if (item.schemaVersion !== 1 || typeof item.persistenceRequired !== "boolean") throw new GenerationFailure(code, path);
  return { schemaVersion: 1, summary: text(item.summary, 180, code, `${path}.summary`), audience: text(item.audience, 120, code, `${path}.audience`), goal: text(item.goal, 180, code, `${path}.goal`), features: stringList(item.features, 1, 8, 120, code, `${path}.features`), dataEntities: stringList(item.dataEntities, 0, 6, 80, code, `${path}.dataEntities`), persistenceRequired: item.persistenceRequired };
}
function parseArchitecture(value: unknown): ArchitecturePlan {
  const code = "INVALID_PLANNING_ARTIFACT"; const path = "architecture"; const item = object(value, code, path);
  exact(item, ["schemaVersion", "summary", "components", "interactions", "stateModel", "storageKeys", "constraints"], code, path);
  if (item.schemaVersion !== 1) throw new GenerationFailure(code, path);
  return { schemaVersion: 1, summary: text(item.summary, 180, code, `${path}.summary`), components: stringList(item.components, 1, 10, 80, code, `${path}.components`), interactions: stringList(item.interactions, 1, 10, 120, code, `${path}.interactions`), stateModel: text(item.stateModel, 240, code, `${path}.stateModel`), storageKeys: stringList(item.storageKeys, 0, 10, 64, code, `${path}.storageKeys`, /^[A-Za-z0-9._-]{1,64}$/u), constraints: stringList(item.constraints, 0, 8, 120, code, `${path}.constraints`) };
}
function parseDesign(value: unknown): DesignPlan {
  const code = "INVALID_PLANNING_ARTIFACT"; const path = "design"; const item = object(value, code, path);
  exact(item, ["schemaVersion", "summary", "visualDirection", "layout", "colorTokens", "interactionStates", "responsiveNotes", "accessibilityNotes"], code, path);
  if (item.schemaVersion !== 1) throw new GenerationFailure(code, path);
  const colors = object(item.colorTokens, code, `${path}.colorTokens`); exact(colors, ["background", "surface", "text", "accent", "muted"], code, `${path}.colorTokens`);
  const color = (key: string) => { const value = text(colors[key], 7, code, `${path}.colorTokens.${key}`); if (!/^#[0-9A-Fa-f]{6}$/u.test(value)) throw new GenerationFailure(code, `${path}.colorTokens.${key}`); return value; };
  return { schemaVersion: 1, summary: text(item.summary, 180, code, `${path}.summary`), visualDirection: text(item.visualDirection, 180, code, `${path}.visualDirection`), layout: text(item.layout, 120, code, `${path}.layout`), colorTokens: { background: color("background"), surface: color("surface"), text: color("text"), accent: color("accent"), muted: color("muted") }, interactionStates: stringList(item.interactionStates, 1, 10, 100, code, `${path}.interactionStates`), responsiveNotes: stringList(item.responsiveNotes, 1, 6, 120, code, `${path}.responsiveNotes`), accessibilityNotes: stringList(item.accessibilityNotes, 1, 6, 120, code, `${path}.accessibilityNotes`) };
}
function extractJson(raw: unknown) {
  let value = raw;
  if (value && typeof value === "object" && !Array.isArray(value) && "response" in value) value = (value as { response?: unknown }).response;
  if (typeof value === "string") { if (utf8Bytes(value) > MAX_PLAN_BYTES) throw new GenerationFailure("RESPONSE_TOO_LARGE", "planning"); try { value = JSON.parse(value); } catch { throw new GenerationFailure("INVALID_JSON", "planning"); } }
  let serialized: string; try { serialized = JSON.stringify(value); } catch { throw new GenerationFailure("INVALID_JSON", "planning"); }
  if (utf8Bytes(serialized) > MAX_PLAN_BYTES) throw new GenerationFailure("RESPONSE_TOO_LARGE", "planning");
  return value;
}
export function parsePlanningEnvelope(raw: unknown): PlanningEnvelope {
  const item = object(extractJson(raw), "INVALID_PLANNING_ARTIFACT", "planning");
  exact(item, ["schemaVersion", "product", "architecture", "design"], "INVALID_PLANNING_ARTIFACT", "planning");
  if (item.schemaVersion !== 1) throw new GenerationFailure("INVALID_PLANNING_ARTIFACT", "planning.schemaVersion");
  return { schemaVersion: 1, product: parseProduct(item.product), architecture: parseArchitecture(item.architecture), design: parseDesign(item.design) };
}

function short(value: string, max: number) { return Array.from(value.replace(/\s+/gu, " ").trim()).slice(0, max).join(""); }
function persistence(prompt: string) { return /刷新|保存|持久|记住|restore|persist|save/iu.test(prompt); }
function intent(prompt: string) {
  if (/计数器|数字计数|counter|stepper/iu.test(prompt)) return "counter";
  if (/todo|待办|任务清单|阅读清单|habit|习惯/iu.test(prompt)) return "todo";
  if (/calculator|计算器|计算|账单|小费|预算/iu.test(prompt)) return "calculator";
  if (/form|表单|报名|申请|landing|落地页/iu.test(prompt)) return "form";
  return "default";
}
export function deterministicPlanning(prompt: string): PlanningEnvelope {
  const idea = short(prompt, 120) || "可交互应用"; const persistent = persistence(prompt); const kind = intent(prompt);
  const architecture = {
    counter: { components: ["计数显示", "增减与重置控件"], interactions: ["增加", "减少", "重置"] },
    todo: { components: ["任务列表", "新增表单", "状态筛选"], interactions: ["新增任务", "切换完成", "删除任务", "筛选任务"] },
    calculator: { components: ["数字输入", "运算控件", "结果显示"], interactions: ["输入数字", "选择运算", "清空结果"] },
    form: { components: ["内容区", "表单", "成功提示"], interactions: ["填写表单", "校验必填项", "显示成功提示"] },
    default: { components: ["内容区", "主要控件", "状态提示"], interactions: ["操作主要控件", "更新页面状态"] },
  }[kind];
  const layouts = { counter: "居中卡片与水平操作区", todo: "表单、筛选与纵向列表", calculator: "数字面板与结果区", form: "内容区与表单卡片", default: "单栏响应式卡片" } as const;
  const storageKeys = persistent ? kind === "counter" ? ["counter.value"] : kind === "todo" ? ["todo.items"] : ["app.state"] : [];
  return parsePlanningEnvelope({ schemaVersion: 1, product: { schemaVersion: 1, summary: `将需求转为可运行前端应用：${idea}`, audience: "应用的直接使用者", goal: short(prompt, 180) || idea, features: [idea], dataEntities: persistent ? ["app-state"] : [], persistenceRequired: persistent }, architecture: { schemaVersion: 1, summary: `纯前端沙箱架构：${idea}`, components: architecture.components, interactions: architecture.interactions, stateModel: persistent ? "内存状态与 Atoms.storage 持久状态" : "页面内存状态", storageKeys, constraints: ["纯前端", "禁止外部网络", "沙箱运行"] }, design: { schemaVersion: 1, summary: `清晰、响应式的界面：${idea}`, visualDirection: "现代、简洁、强调主要操作", layout: layouts[kind], colorTokens: { background: "#F5F7FB", surface: "#FFFFFF", text: "#172033", accent: "#635BFF", muted: "#6B7280" }, interactionStates: ["默认", "悬停", "聚焦", "禁用", "成功", "错误"], responsiveNotes: ["窄屏改为单列", "触控目标至少44像素"], accessibilityNotes: ["表单控件具有关联标签", "状态变化可被辅助技术感知"] } });
}

function timeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new GenerationFailure("MODEL_TIMEOUT")), milliseconds);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}
function publicError(error: unknown) {
  if (error instanceof GenerationFailure || error instanceof CodeBundleError) return { code: error.code, path: error.path };
  if (error instanceof Error && /JSON Mode couldn't be met/iu.test(error.message)) return { code: "JSON_MODE_UNMET", path: "planning" };
  return { code: "MODEL_ERROR", path: "" };
}
async function digest(value: string) {
  const result = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(result), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function planningSystem() {
  return `你是一个产品、架构和体验设计联合 Agent。只返回一个 JSON object，不要 Markdown 或额外字段。必须严格满足以下 canonical schema：${JSON.stringify(PLANNING_SCHEMA)}。使用用户的语言；不得添加外部网络、第三方脚本、支付、OAuth 或后端服务。`;
}
function engineeringSystem(plan: PlanningEnvelope, previous: AppSpec | CodeBundleV1 | undefined, repair?: { code: string; path: string; previousRaw: string }) {
  const protocol = `只输出以下纯文本协议，不要 Markdown code fence，不要解释：\n<<<ATOM_META>>>\n{"schemaVersion":1,"kind":"code_bundle","title":"1-60字标题","summary":"1-180字摘要","entry":"index.html","capabilities":{"storage":false}}\n<<<ATOM_FILE:index.html>>>\n仅 body fragment\n<<<ATOM_FILE:styles.css>>>\nCSS\n<<<ATOM_FILE:app.js>>>\n浏览器 JavaScript\n<<<ATOM_END>>>`;
  const safety = "禁止外部依赖和网络；禁止 script/style/link/iframe/svg、inline on*、fetch/XHR/WebSocket/eval/import/export/Worker/parent/top/postMessage/location/open、无限循环；交互必须使用 addEventListener。需要刷新恢复时只能调用 window.Atoms.storage.get/set/delete/list/clear，并把 capabilities.storage 设为 true。";
  const previousContext = previous ? JSON.stringify(previous).slice(0, 24 * 1024) : "null";
  const repairContext = repair ? `\n上次输出未通过服务端校验。公开错误=${repair.code}:${repair.path}。请重新返回完整协议。上次输出=${repair.previousRaw.slice(0, 48 * 1024)}` : "";
  return `你是 Engineering Agent，生成一个真正可交互的纯前端应用。${protocol}\n${safety}\n已验证规划=${JSON.stringify(plan)}\n上一版本=${previousContext}${repairContext}`;
}

export async function generateAppWithAgents(prompt: string, previous: AppSpec | CodeBundleV1 | undefined, runner: AiRunner | undefined, options: GenerationOptions = {}): Promise<GeneratedApp> {
  const now = options.now ?? Date.now; const started = now(); const sharedCallId = crypto.randomUUID(); const steps: AgentStep[] = [];
  let attemptNo = 1;
  const progress = async (item: StageProgress) => { await options.onStage?.(item); };
  let plan: PlanningEnvelope; let planningSource: "workers_ai" | "deterministic" = "workers_ai"; let planningFailure: string | null = null; let planningDuration = 0;

  if (!runner) {
    plan = deterministicPlanning(prompt); planningSource = "deterministic"; planningFailure = "AI_UNAVAILABLE";
  } else {
    const planStarted = now(); await progress({ role: "product", status: "RUNNING", attemptNo: 1, sharedCallId });
    try {
      const remaining = MODEL_DEADLINE_MS - (now() - started);
      if (remaining <= 0) throw new GenerationFailure("MODEL_BUDGET_EXHAUSTED");
      const raw = await timeout(runner.run(PLANNING_MODEL, { messages: [{ role: "system", content: planningSystem() }, { role: "user", content: prompt }], max_tokens: 1800, temperature: 0.2, response_format: { type: "json_object" } }), Math.min(STAGE_TIMEOUTS_MS.planning, remaining));
      if (now() - started >= MODEL_DEADLINE_MS) throw new GenerationFailure("MODEL_BUDGET_EXHAUSTED");
      plan = parsePlanningEnvelope(raw); planningDuration = now() - planStarted;
    } catch (error) {
      const failure = publicError(error); plan = deterministicPlanning(prompt); planningSource = "deterministic"; planningFailure = failure.code; planningDuration = now() - planStarted;
    }
  }

  for (const [index, role] of (["product", "architecture", "design"] as const).entries()) {
    const artifact = plan[role]; const step: AgentStep = { role, name: ROLE_NAMES[role], summary: artifact.summary, status: "COMPLETED", source: planningSource, model: planningSource === "workers_ai" ? PLANNING_MODEL : "deterministic-planner-v1", durationMs: index === 0 ? planningDuration : 0, attemptNo: 1, artifact: artifact as unknown as Record<string, unknown>, errorCode: planningFailure, sharedCallId };
    steps.push(step); await progress({ role, status: "COMPLETED", summary: step.summary, artifact: step.artifact ?? undefined, source: step.source ?? undefined, model: step.model ?? undefined, durationMs: step.durationMs ?? undefined, attemptNo: 1, errorCode: step.errorCode, sharedCallId });
  }

  if (!runner) return deterministicResult("AI_UNAVAILABLE");
  let rawEngineering = ""; let engineeringDuration = 0;
  try {
    await progress({ role: "engineering", status: "RUNNING", attemptNo: 1 });
    const stageStarted = now(); const remaining = MODEL_DEADLINE_MS - (now() - started);
    if (remaining <= 0) throw new GenerationFailure("MODEL_BUDGET_EXHAUSTED");
    const raw = await timeout(runner.run(ENGINEERING_MODEL, { messages: [{ role: "system", content: engineeringSystem(plan, previous) }, { role: "user", content: prompt }], max_tokens: 6000, temperature: 0.25 }), Math.min(STAGE_TIMEOUTS_MS.engineering, remaining));
    rawEngineering = typeof raw === "string" ? raw : typeof (raw as { response?: unknown })?.response === "string" ? String((raw as { response: string }).response) : "";
    let bundle: CodeBundleV1;
    try { bundle = parseCodeBundle(raw); }
    catch (firstError) {
      const first = publicError(firstError); const repairRemaining = MODEL_DEADLINE_MS - (now() - started);
      if (repairRemaining < 500) throw firstError;
      attemptNo = 2;
      await progress({ role: "engineering", status: "RUNNING", attemptNo: 2 });
      const repaired = await timeout(runner.run(ENGINEERING_MODEL, { messages: [{ role: "system", content: engineeringSystem(plan, previous, { code: first.code, path: first.path, previousRaw: rawEngineering }) }, { role: "user", content: prompt }], max_tokens: 6000, temperature: 0.15 }), Math.min(STAGE_TIMEOUTS_MS.repair, repairRemaining));
      bundle = parseCodeBundle(repaired);
    }
    if (now() - started >= MODEL_DEADLINE_MS) throw new GenerationFailure("MODEL_BUDGET_EXHAUSTED");
    engineeringDuration = now() - stageStarted;
    const fileBytes = Object.fromEntries(Object.entries(bundle.files).map(([name, value]) => [name, utf8Bytes(value)]));
    const artifact = { artifactKind: "code_bundle", bytes: Object.values(fileBytes).reduce((sum, value) => sum + value, 0), fileBytes, sha256: await digest(JSON.stringify(bundle)), capabilities: bundle.capabilities, repaired: attemptNo === 2 };
    const step: AgentStep = { role: "engineering", name: ROLE_NAMES.engineering, summary: bundle.summary, status: "COMPLETED", source: "workers_ai", model: ENGINEERING_MODEL, durationMs: engineeringDuration, attemptNo, artifact };
    steps.push(step); await progress({ role: "engineering", status: "COMPLETED", summary: step.summary, artifact, source: "workers_ai", model: ENGINEERING_MODEL, durationMs: engineeringDuration, attemptNo });
    return { bundle, summary: bundle.summary, steps, generation: { source: "workers_ai", model: ENGINEERING_MODEL, outcome: "SUCCESS", failureCode: null, fallbackReason: planningFailure, durationMs: now() - started, artifactKind: "code_bundle" } };
  } catch (error) {
    const failure = publicError(error);
    return deterministicResult(failure.code);
  }

  async function deterministicResult(code: string): Promise<GeneratedApp> {
    const bundle = compileCounterBundle(prompt);
    if (!bundle) throw new GenerationFailure(code);
    const artifact = { artifactKind: "code_bundle", bytes: utf8Bytes(bundle.files["index.html"]) + utf8Bytes(bundle.files["styles.css"]) + utf8Bytes(bundle.files["app.js"]), sha256: await digest(JSON.stringify(bundle)), capabilities: bundle.capabilities, compiler: "counter-compiler-v1" };
    const step: AgentStep = { role: "engineering", name: ROLE_NAMES.engineering, summary: bundle.summary, status: "COMPLETED", source: "deterministic", model: "counter-compiler-v1", durationMs: 0, attemptNo, artifact, errorCode: code };
    steps.push(step); await progress({ role: "engineering", status: "COMPLETED", summary: step.summary, artifact, source: "deterministic", model: "counter-compiler-v1", durationMs: 0, attemptNo, errorCode: code });
    return { bundle, summary: bundle.summary, steps, generation: { source: "deterministic", model: "counter-compiler-v1", outcome: "SUCCESS", failureCode: null, fallbackReason: code, durationMs: now() - started, artifactKind: "code_bundle" } };
  }
}

export const generateAppWithAI = generateAppWithAgents;
