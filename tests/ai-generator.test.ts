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
  assert.deepEqual(inputs.slice(0, 3).map((item) => item.response_format), [{ type: "json_object" }, { type: "json_object" }, { type: "json_object" }]);
  const engineeringFormat = inputs[3].response_format as { type: string; json_schema: { properties: { spec: { properties: { filters: { minItems?: number } } } } } };
  assert.equal(engineeringFormat.type, "json_schema");
  assert.equal(engineeringFormat.json_schema.properties.spec.properties.filters.minItems, 1);
  assert.ok(!("minItems" in STAGE_SCHEMAS.engineering.properties.spec.properties.filters));
  assert.match(JSON.stringify(inputs[0].messages), new RegExp(STAGE_SCHEMAS.product.required[0]));
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

test("rejects conflicting product capabilities before downstream calls", async () => {
  let calls = 0;
  const runner: AiRunner = { run: async () => { calls++; return { response: { ...product, forbiddenCapabilities: ["filter"] } }; } };
  const result = await generateAppWithAgents("做一个筛选看板", undefined, runner);
  assert.equal(calls, 1);
  assert.equal(result.generation.source, "deterministic");
  assert.equal(result.generation.failureCode, "INVALID_PRODUCT_ARTIFACT");
});

test("rejects a product with no allowed action before engineering schema derivation", async () => {
  let calls = 0;
  const runner: AiRunner = { run: async () => { calls++; return { response: { ...product, requiredCapabilities: [], forbiddenCapabilities: ["filter", "form", "toggle", "toast"] } }; } };
  const result = await generateAppWithAgents("做一个无交互看板", undefined, runner);
  assert.equal(calls, 1);
  assert.equal(result.generation.source, "deterministic");
  assert.equal(result.generation.failureCode, "INVALID_PRODUCT_ARTIFACT");
});

test("every forbidden capability is rejected by the server from its structure", async () => {
  for (const forbidden of ["form", "filter", "toggle", "stats", "toast"] as const) {
    const forbiddenProduct = { ...product, requiredCapabilities: [], forbiddenCapabilities: [forbidden] };
    const baseCards = forbidden === "filter" ? engineering.spec.cards : engineering.spec.cards.map((card) => ({ id: card.id, title: card.title, description: card.description, tag: card.tag }));
    const baseActions = forbidden === "filter" || forbidden === "form" || forbidden === "stats" ? [{ id: "notice", label: "提示", kind: "show_toast", message: "完成" }] : engineering.spec.actions;
    const forbiddenSpec = {
      ...engineering,
      spec: {
        ...engineering.spec,
        stats: forbidden === "stats" ? [{ id: "total", label: "总数", value: "2" }] : [],
        filters: forbidden === "filter" ? engineering.spec.filters : [],
        cards: baseCards,
        ...(forbidden === "form" ? { form: { id: "entry-form", title: "新增观测", fields: [{ id: "entry-name", label: "名称", placeholder: "请输入", required: true }], submitLabel: "提交" } } : {}),
        actions: forbidden === "toggle" ? [{ id: "toggle", label: "切换", kind: "toggle_item", targetId: "site-a" }] : forbidden === "toast" ? [{ id: "notice", label: "提示", kind: "show_toast", message: "完成" }] : baseActions,
      },
    };
    const values = [forbiddenProduct, architecture, design, forbiddenSpec, forbiddenSpec]; let calls = 0;
    const runner: AiRunner = { run: async () => ({ response: values[calls++] }) };
    const result = await generateAppWithAgents(`禁止 ${forbidden}`, undefined, runner);
    assert.equal(calls, 5);
    assert.equal(result.generation.source, "deterministic");
    assert.equal(result.generation.failureCode, "FORBIDDEN_CAPABILITY");
  }
});

test("safely completes required toggle and toast capabilities", async () => {
  for (const required of ["toggle", "toast"] as const) {
    const requiredProduct = { ...product, requiredCapabilities: [required], forbiddenCapabilities: ["external_script"] };
    const incomplete = { ...engineering, spec: { ...engineering.spec, filters: [], cards: engineering.spec.cards.map((card) => ({ id: card.id, title: card.title, description: card.description, tag: card.tag })), actions: required === "toast" ? [{ id: "toggle", label: "切换", kind: "toggle_item", targetId: "site-a" }] : [{ id: "notice", label: "已有动作", kind: "show_toast", message: "完成" }] } };
    const values = [requiredProduct, architecture, design, incomplete]; let calls = 0;
    const runner: AiRunner = { run: async () => ({ response: values[calls++] }) };
    const result = await generateAppWithAgents(`必须支持 ${required}`, undefined, runner);
    assert.equal(calls, 4);
    assert.equal(result.generation.source, "workers_ai");
    assert.deepEqual(result.steps[3].artifact?.completedCapabilities, [required]);
  }
});

test("falls back when the action limit prevents required capability completion", async () => {
  const requiredProduct = { ...product, requiredCapabilities: ["toggle"], forbiddenCapabilities: ["external_script"] };
  const fullActions = Array.from({ length: 8 }, (_, index) => ({ id: `notice-${index}`, label: `提示 ${index}`, kind: "show_toast", message: "完成" }));
  const full = { ...engineering, spec: { ...engineering.spec, filters: [], cards: engineering.spec.cards.map((card) => ({ id: card.id, title: card.title, description: card.description, tag: card.tag })), actions: fullActions } };
  const values = [requiredProduct, architecture, design, full, full]; let calls = 0;
  const runner: AiRunner = { run: async () => ({ response: values[calls++] }) };
  const result = await generateAppWithAgents("必须支持切换", undefined, runner);
  assert.equal(calls, 5);
  assert.equal(result.generation.source, "deterministic");
  assert.equal(result.generation.failureCode, "MISSING_REQUIRED_CAPABILITY");
});

test("audits bounded AppSpec normalization and completes required actions", async () => {
  const requiredProduct = { ...product, requiredCapabilities: ["filter", "form", "stats"], forbiddenCapabilities: ["toggle", "external_script"] };
  const normalizedEngineering = {
    ...engineering,
    spec: {
      ...engineering.spec,
      stats: [{ id: "total", label: "总数", value: "2", delta: "null" }],
      filters: [{ ...engineering.spec.filters[0], defaultValue: "未知", allValue: "不存在" }],
      cards: engineering.spec.cards.map((card) => ({ ...card, filterValues: { weather: "不存在" } })),
      form: { id: "entry-form", title: "新增观测", fields: [{ id: "entry-name", label: "名称", placeholder: "请输入", required: true }], submitLabel: "提交" },
      actions: [{ id: "notice", label: "提示", kind: "show_toast", message: "完成" }],
    },
  };
  const originalEngineeringJson = JSON.stringify(normalizedEngineering);
  const values = [requiredProduct, architecture, design, normalizedEngineering]; let calls = 0;
  const runner: AiRunner = { run: async () => ({ response: values[calls++] }) };
  const result = await generateAppWithAgents("做一个带筛选、表单和统计的观测台", undefined, runner);
  assert.equal(result.generation.source, "workers_ai");
  assert.equal(calls, 4);
  assert.equal(result.steps[3].artifact?.normalized, true);
  assert.equal(result.steps[3].artifact?.normalizationVersion, "appspec-normalizer-v1");
  assert.deepEqual(result.steps[3].artifact?.normalizationCodes, ["STAT_NULL_SENTINEL", "FILTER_DEFAULT_VALUE", "FILTER_ALL_VALUE", "CARD_FILTER_VALUES", "ADD_FILTER_ACTION", "ADD_FORM_ACTION"]);
  assert.deepEqual(result.steps[3].artifact?.completedCapabilities, ["filter", "form"]);
  assert.match(String(result.steps[3].artifact?.baseAppSpecSchemaSha), /^[a-f0-9]{64}$/);
  assert.match(String(result.steps[3].artifact?.derivedEngineeringSchemaSha), /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(normalizedEngineering), originalEngineeringJson);
  assert.equal(result.spec.stats[0].delta, undefined);
  assert.ok(result.spec.actions.some((action) => action.kind === "set_filter" && action.value !== result.spec.filters[0].allValue));
  assert.ok(result.spec.actions.some((action) => action.kind === "add_item" && action.targetId === result.spec.form?.id));
  assert.ok(result.spec.actions.every((action) => action.kind !== "toggle_item"));
});

test("required filter without a narrowing result cannot be normalized as success", async () => {
  const oneCardEngineering = {
    ...engineering,
    spec: {
      ...engineering.spec,
      filters: [{ id: "only", label: "状态", options: ["全部"], defaultValue: "全部", allValue: "全部" }],
      cards: [{ id: "single", title: "唯一卡片", description: "没有可收窄集合", tag: "全部", filterValues: { only: "全部" } }],
      actions: [{ id: "notice", label: "提示", kind: "show_toast", message: "完成" }],
    },
  };
  const values = [product, architecture, design, oneCardEngineering, oneCardEngineering]; let calls = 0;
  const runner: AiRunner = { run: async () => ({ response: values[calls++] }) };
  const result = await generateAppWithAgents("做一个必须可筛选的看板", undefined, runner);
  assert.equal(calls, 5);
  assert.equal(result.generation.source, "deterministic");
  assert.equal(result.generation.failureCode, "MISSING_REQUIRED_CAPABILITY");
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
  const unmet = await generateAppWithAgents("做一个旅行计划看板", undefined, { run: async () => { throw new Error("JSON Mode couldn't be met: raw platform detail"); } });
  assert.equal(unmet.generation.failureCode, "JSON_MODE_UNMET");
  assert.doesNotMatch(JSON.stringify(unmet.generation), /platform detail/);
});
