import { generateAppSpec, validateAppSpec } from "./generator";
import type { AgentStep, AppSpec } from "./types";

export const WORKERS_AI_MODEL = "@cf/zai-org/glm-4.7-flash";
const MAX_RESPONSE_BYTES = 48 * 1024;
export const DEFAULT_MODEL_TIMEOUT_MS = 55_000;
const ROLES = ["product", "architecture", "design", "engineering"] as const;
const ROLE_NAMES: Record<(typeof ROLES)[number], string> = {
  product: "Emma · Product",
  architecture: "Bob · Architect",
  design: "Iris · Designer",
  engineering: "Alex · Engineer",
};

export type AiRunner = {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
};

export type GenerationMeta = {
  source: "workers_ai" | "deterministic";
  model: string;
  outcome: "SUCCESS" | "FALLBACK";
  failureCode: string | null;
  durationMs: number;
};

export type GeneratedApp = {
  spec: AppSpec;
  summary: string;
  steps: AgentStep[];
  generation: GenerationMeta;
};

class ModelOutputError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function exactKeys(value: Record<string, unknown>, allowed: string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...allowed].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new ModelOutputError("INVALID_ENVELOPE");
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ModelOutputError("INVALID_ENVELOPE");
  return value as Record<string, unknown>;
}

function cleanSummary(value: unknown, max: number) {
  if (typeof value !== "string") throw new ModelOutputError("INVALID_ENVELOPE");
  const cleaned = Array.from(value, (character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 32 || code === 127 ? " " : character;
  }).join("").replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length > max) throw new ModelOutputError("INVALID_ENVELOPE");
  return cleaned;
}

function assertExactAppSpec(value: unknown): AppSpec {
  const spec = objectValue(value);
  exactKeys(spec, ["schemaVersion", "kind", "title", "subtitle", "theme", "stats", "filters", "cards", "actions", ...(spec.form === undefined ? [] : ["form"])]);
  exactKeys(objectValue(spec.theme), ["accent", "density"]);
  if (!Array.isArray(spec.stats) || !Array.isArray(spec.filters) || !Array.isArray(spec.cards) || !Array.isArray(spec.actions)) {
    throw new ModelOutputError("INVALID_APP_SPEC");
  }
  for (const stat of spec.stats) exactKeys(objectValue(stat), ["id", "label", "value", ...(objectValue(stat).delta === undefined ? [] : ["delta"])]);
  for (const filter of spec.filters) exactKeys(objectValue(filter), ["id", "label", "options", "defaultValue", ...(objectValue(filter).allValue === undefined ? [] : ["allValue"])]);
  for (const card of spec.cards) {
    const item = objectValue(card);
    exactKeys(item, ["id", "title", "description", "tag", ...(item.filterValues === undefined ? [] : ["filterValues"]), ...(item.done === undefined ? [] : ["done"])]);
  }
  if (spec.form !== undefined) {
    const form = objectValue(spec.form);
    exactKeys(form, ["id", "title", "fields", "submitLabel"]);
    if (!Array.isArray(form.fields)) throw new ModelOutputError("INVALID_APP_SPEC");
    for (const field of form.fields) exactKeys(objectValue(field), ["id", "label", "placeholder", "required"]);
  }
  for (const action of spec.actions) {
    const item = objectValue(action);
    if (item.kind === "set_filter") exactKeys(item, ["id", "label", "kind", "targetId", "value"]);
    else if (item.kind === "toggle_item" || item.kind === "add_item") exactKeys(item, ["id", "label", "kind", "targetId"]);
    else if (item.kind === "show_toast") exactKeys(item, ["id", "label", "kind", "message"]);
    else throw new ModelOutputError("INVALID_APP_SPEC");
  }
  try {
    validateAppSpec(spec as unknown as AppSpec);
  } catch {
    throw new ModelOutputError("INVALID_APP_SPEC");
  }
  return spec as unknown as AppSpec;
}

function parseEnvelope(text: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ModelOutputError("INVALID_JSON");
  }
  const envelope = objectValue(parsed);
  exactKeys(envelope, ["spec", "summary", "steps"]);
  if (!Array.isArray(envelope.steps) || envelope.steps.length !== 4) throw new ModelOutputError("INVALID_ENVELOPE");
  const steps = envelope.steps.map((raw, index): AgentStep => {
    const step = objectValue(raw);
    exactKeys(step, ["role", "summary"]);
    const role = ROLES[index];
    if (step.role !== role) throw new ModelOutputError("INVALID_ENVELOPE");
    return { role, name: ROLE_NAMES[role], summary: cleanSummary(step.summary, 180), status: "COMPLETED" };
  });
  return { spec: assertExactAppSpec(envelope.spec), summary: cleanSummary(envelope.summary, 160), steps };
}

function extractText(raw: unknown) {
  if (typeof raw === "string") return raw;
  const result = objectValue(raw);
  if (typeof result.response === "string") return result.response;
  const choices = result.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const message = objectValue(objectValue(choices[0]).message);
    if (typeof message.content === "string") return message.content;
  }
  throw new ModelOutputError("EMPTY_RESPONSE");
}

function systemPrompt(previous?: AppSpec) {
  return `你是 Atomize 的应用生成团队。把用户需求转成安全的 AppSpec v1 JSON。只输出符合 schema 的 JSON，不输出 Markdown。四个 steps 必须依次是 product、architecture、design、engineering，每个摘要说明本角色实际做出的决定。应用必须有真实可操作的筛选、卡片状态、表单或 toast，文案使用用户语言。不要输出 HTML、CSS、JavaScript 或 URL。${previous ? `这是当前版本，返回完整修改版并保留未要求改变的能力：${JSON.stringify(previous)}` : ""}`;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new ModelOutputError("MODEL_TIMEOUT")), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

function failureCode(error: unknown) {
  if (error instanceof ModelOutputError) return error.code;
  return "MODEL_ERROR";
}

export async function generateAppWithAI(
  prompt: string,
  previous: AppSpec | undefined,
  runner: AiRunner | undefined,
  timeoutMs = DEFAULT_MODEL_TIMEOUT_MS,
): Promise<GeneratedApp> {
  const started = Date.now();
  if (runner) {
    try {
      const raw = await withTimeout(runner.run(WORKERS_AI_MODEL, {
          messages: [{ role: "system", content: systemPrompt(previous) }, { role: "user", content: prompt }],
          max_completion_tokens: 2200,
          temperature: 0.35,
          reasoning_effort: "low",
          response_format: { type: "json_object" },
        }), timeoutMs);
      const text = extractText(raw);
      if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) throw new ModelOutputError("RESPONSE_TOO_LARGE");
      return { ...parseEnvelope(text), generation: { source: "workers_ai", model: WORKERS_AI_MODEL, outcome: "SUCCESS", failureCode: null, durationMs: Date.now() - started } };
    } catch (error) {
      const fallback = generateAppSpec(prompt, previous);
      return { ...fallback, generation: { source: "deterministic", model: "deterministic-v1", outcome: "FALLBACK", failureCode: failureCode(error), durationMs: Date.now() - started } };
    }
  }
  const fallback = generateAppSpec(prompt, previous);
  return { ...fallback, generation: { source: "deterministic", model: "deterministic-v1", outcome: "FALLBACK", failureCode: "AI_UNAVAILABLE", durationMs: Date.now() - started } };
}
