import test from "node:test";
import assert from "node:assert/strict";
import { APP_SPEC_SCHEMA, generateAppWithAgents, MODEL_DEADLINE_MS, STAGE_SCHEMAS, STAGE_TIMEOUTS_MS, WORKERS_AI_MODEL, type AiRunner, type StageProgress } from "../lib/ai-generator";

const product = { summary: "为观测者规划地点和天气筛选。", audience: "自然观察爱好者", goal: "记录萤火虫观测", requiredCapabilities: ["filter"], forbiddenCapabilities: ["external_script"] };
const architecture = { summary: "用筛选与卡片组织观测记录。", kind: "dashboard", components: ["filters", "cards", "actions"], interactionPlan: ["set_filter"], persistencePlan: "版本保存到 D1" };
const design = { summary: "以夜间蓝色视觉突出观测信息。", visualDirection: "安静的夜间蓝色", layout: "dashboard-grid", interactionStates: ["default", "filtered"], accessibilityNotes: ["控件包含可读标签"] };
const engineering = {
  spec: {
    schemaVersion: 1, kind: "dashboard", title: "萤火虫观测协作台", subtitle: "记录观测地点、天气与发现",
    theme: { accent: "blue", density: "comfortable" }, stats: [],
    filters: [{ id: "weather", label: "天气", options: ["全部", "晴朗", "多云"], defaultValue: "全部", allValue: "全部" }],
    cards: [{ id: "site-a", title: "溪谷入口", description: "20:30 开始观测", tag: "晴朗", filterValues: { weather: "晴朗" } }, { id: "site-b", title: "林间步道", description: "湿度较高", tag: "多云", filterValues: { weather: "多云" } }],
    actions: [{ id: "sunny", label: "只看晴朗", kind: "set_filter", targetId: "weather", value: "晴朗" }],
  }, summary: "实现了可筛选的萤火虫观测协作台。",
};

function stagedRunner(overrides: Partial<Record<number, unknown>> = {}) {
  const inputs: Array<Record<string, unknown>> = [];
  const values = [product, architecture, design, engineering];
  const runner: AiRunner = { run: async (model, input) => { assert.equal(model, WORKERS_AI_MODEL); const index = inputs.length; inputs.push(input); return { response: overrides[index] ?? values[index] }; } };
  return { runner, inputs };
}

test("runs four real model stages in order and passes validated artifacts downstream", async () => {
  const { runner, inputs } = stagedRunner(); const progress: StageProgress[] = [];
  const result = await generateAppWithAgents("做一个萤火虫观测协作台", undefined, runner, { onStage: async (event) => { progress.push(event); } });
  assert.equal(inputs.length, 4);
  assert.deepEqual(inputs.map((item) => (item.response_format as { json_schema: unknown }).json_schema), [STAGE_SCHEMAS.product, STAGE_SCHEMAS.architecture, STAGE_SCHEMAS.design, STAGE_SCHEMAS.engineering]);
  assert.equal(STAGE_SCHEMAS.engineering.properties.spec, APP_SPEC_SCHEMA);
  assert.doesNotMatch(JSON.stringify(STAGE_SCHEMAS.engineering), /\$ref/);
  assert.match(JSON.stringify(inputs[1].messages), /自然观察爱好者/);
  assert.match(JSON.stringify(inputs[2].messages), /dashboard/);
  assert.match(JSON.stringify(inputs[3].messages), /夜间蓝色/);
  assert.deepEqual(progress.filter((item) => item.status === "COMPLETED").map((item) => item.role), ["product", "architecture", "design", "engineering"]);
  assert.equal(result.spec.title, "萤火虫观测协作台");
  assert.equal(result.generation.source, "workers_ai");
});

test("repairs engineering exactly once when a required capability is missing", async () => {
  let calls = 0; const invalid = { ...engineering, spec: { ...engineering.spec, filters: [], cards: engineering.spec.cards.map((card) => ({ id: card.id, title: card.title, description: card.description, tag: card.tag })), actions: [{ id: "notice", label: "提示", kind: "show_toast", message: "完成" }] } };
  const runner: AiRunner = { run: async (_model, input) => { const index = calls++; if (index < 3) return { response: [product, architecture, design][index] }; if (index === 3) return { response: invalid }; assert.match(JSON.stringify(input.messages), /MISSING_REQUIRED_CAPABILITY:filter/); return { response: engineering }; } };
  const result = await generateAppWithAgents("做一个可筛选观测台", undefined, runner);
  assert.equal(calls, 5);
  assert.equal(result.generation.source, "workers_ai");
  assert.equal(result.steps[3].attemptNo, 2);
  assert.equal(result.steps[3].artifact?.repaired, true);
});

test("invalid upstream artifact stops downstream AI and falls back safely", async () => {
  let calls = 0; const runner: AiRunner = { run: async () => { calls++; return { response: { ...product, debug: true } }; } };
  const result = await generateAppWithAgents("做一个旅行计划看板", undefined, runner);
  assert.equal(calls, 1);
  assert.equal(result.generation.source, "deterministic");
  assert.equal(result.generation.failureCode, "INVALID_PRODUCT_ARTIFACT");
  assert.ok(result.spec.cards.length > 0);
});

test("missing binding and model errors do not expose upstream text", async () => {
  assert.equal(MODEL_DEADLINE_MS, 52_000);
  assert.deepEqual(STAGE_TIMEOUTS_MS, { product: 7_000, architecture: 9_000, design: 7_000, engineering: 22_000, repair: 7_000 });
  const unavailable = await generateAppWithAgents("做一个旅行计划看板", undefined, undefined);
  assert.equal(unavailable.generation.failureCode, "AI_UNAVAILABLE");
  const failed = await generateAppWithAgents("做一个旅行计划看板", undefined, { run: async () => { throw new Error("secret upstream response"); } });
  assert.equal(failed.generation.failureCode, "MODEL_ERROR");
  assert.doesNotMatch(JSON.stringify(failed.generation), /secret/);
});
