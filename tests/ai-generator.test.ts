import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_MODEL_TIMEOUT_MS, generateAppWithAI, WORKERS_AI_MODEL, type AiRunner } from "../lib/ai-generator";

const modelEnvelope = {
  spec: {
    schemaVersion: 1,
    kind: "dashboard",
    title: "萤火虫观测协作台",
    subtitle: "记录观测地点、天气与发现",
    theme: { accent: "blue", density: "comfortable" },
    stats: [{ id: "sightings", label: "本周发现", value: "18", delta: "+6" }],
    filters: [{ id: "weather", label: "天气", options: ["全部", "晴朗", "多云"], defaultValue: "全部", allValue: "全部" }],
    cards: [
      { id: "site-a", title: "溪谷入口", description: "20:30 开始观测", tag: "晴朗", filterValues: { weather: "晴朗" } },
      { id: "site-b", title: "林间步道", description: "湿度较高", tag: "多云", filterValues: { weather: "多云" } },
    ],
    actions: [{ id: "sunny", label: "只看晴朗", kind: "set_filter", targetId: "weather", value: "晴朗" }],
  },
  summary: "创建了萤火虫观测协作台，并提供天气筛选。",
  steps: [
    { role: "product", summary: "将需求收敛为地点记录和天气筛选。" },
    { role: "architecture", summary: "用 AppSpec 组织统计、筛选与观测卡片。" },
    { role: "design", summary: "选择蓝色舒适布局突出夜间观测氛围。" },
    { role: "engineering", summary: "实现天气筛选动作并校验引用关系。" },
  ],
};

test("uses the real model envelope and exposes auditable generation metadata", async () => {
  let calledModel = "";
  const runner: AiRunner = { run: async (model, input) => {
    calledModel = model;
    assert.equal(input.max_tokens, 2200);
    assert.deepEqual(input.response_format, { type: "json_object" });
    assert.equal("max_completion_tokens" in input, false);
    assert.equal("reasoning_effort" in input, false);
    return { choices: [{ message: { content: JSON.stringify(modelEnvelope) } }] };
  } };
  const result = await generateAppWithAI("做一个萤火虫观测协作台", undefined, runner);
  assert.equal(calledModel, WORKERS_AI_MODEL);
  assert.equal(result.spec.title, "萤火虫观测协作台");
  assert.equal(result.steps[0].summary, modelEnvelope.steps[0].summary);
  assert.equal(result.generation.source, "workers_ai");
  assert.equal(result.generation.outcome, "SUCCESS");
  assert.equal(result.generation.failureCode, null);
});

test("invalid, oversized and extra-field model responses fall back safely", async () => {
  const cases: Array<[string, unknown, string]> = [
    ["invalid json", { response: "not-json" }, "INVALID_JSON"],
    ["extra envelope field", { response: JSON.stringify({ ...modelEnvelope, debug: true }) }, "INVALID_ENVELOPE"],
    ["wrong role order", { response: JSON.stringify({ ...modelEnvelope, steps: [...modelEnvelope.steps].reverse() }) }, "INVALID_ENVELOPE"],
    ["oversized", { response: "x".repeat(49 * 1024) }, "RESPONSE_TOO_LARGE"],
  ];
  for (const [name, response, code] of cases) {
    const result = await generateAppWithAI("做一个旅行计划看板", undefined, { run: async () => response });
    assert.equal(result.generation.source, "deterministic", name);
    assert.equal(result.generation.outcome, "FALLBACK", name);
    assert.equal(result.generation.failureCode, code, name);
    assert.ok(result.spec.cards.length > 0, name);
  }
});

test("missing binding, thrown errors and timeout do not expose raw errors", async () => {
  assert.equal(DEFAULT_MODEL_TIMEOUT_MS, 55_000);
  const unavailable = await generateAppWithAI("做一个旅行计划看板", undefined, undefined);
  assert.equal(unavailable.generation.failureCode, "AI_UNAVAILABLE");

  const failed = await generateAppWithAI("做一个旅行计划看板", undefined, { run: async () => { throw new Error("secret upstream response"); } });
  assert.equal(failed.generation.failureCode, "MODEL_ERROR");
  assert.ok(!JSON.stringify(failed.generation).includes("secret"));

  const jsonModeRejected = await generateAppWithAI("做一个旅行计划看板", undefined, { run: async () => { throw new Error("JSON Mode couldn't be met"); } });
  assert.equal(jsonModeRejected.generation.source, "deterministic");
  assert.equal(jsonModeRejected.generation.outcome, "FALLBACK");
  assert.equal(jsonModeRejected.generation.failureCode, "MODEL_ERROR");
  assert.ok(!JSON.stringify(jsonModeRejected.generation).includes("couldn't be met"));

  const timedOut = await generateAppWithAI("做一个旅行计划看板", undefined, { run: () => new Promise(() => undefined) }, 2);
  assert.equal(timedOut.generation.failureCode, "MODEL_TIMEOUT");
});
