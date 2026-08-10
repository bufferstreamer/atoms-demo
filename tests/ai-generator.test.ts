import test from "node:test";
import assert from "node:assert/strict";
import {
  ENGINEERING_MODEL,
  GenerationFailure,
  MODEL_DEADLINE_MS,
  PLANNING_MODEL,
  PLANNING_SCHEMA,
  STAGE_TIMEOUTS_MS,
  deterministicPlanning,
  generateAppWithAgents,
  parsePlanningEnvelope,
  type AiRunner,
  type StageProgress,
} from "../lib/ai-generator";
import { serializeCodeBundle } from "../lib/code-bundle";
import type { CodeBundleV1 } from "../lib/types";

const planning = deterministicPlanning("做一个可保存的旅行预算计算器");
const bundle: CodeBundleV1 = {
  schemaVersion: 1,
  kind: "code_bundle",
  title: "旅行预算计算器",
  summary: "输入预算与人数后实时计算人均预算。",
  entry: "index.html",
  files: {
    "index.html": '<main><h1>旅行预算计算器</h1><label>总预算<input id="budget" type="number"></label><label>人数<input id="people" type="number" value="1"></label><button id="calculate">计算</button><output id="result" aria-live="polite">¥0</output></main>',
    "styles.css": "body{font-family:system-ui;margin:0;padding:32px;background:#f5f7fb}main{max-width:520px;margin:auto;padding:24px;background:white;border-radius:20px}label{display:grid;gap:6px;margin:12px 0}input,button{min-height:44px}button{background:#635bff;color:white;border:0;border-radius:10px}",
    "app.js": 'const budget=document.getElementById("budget");const people=document.getElementById("people");const result=document.getElementById("result");document.getElementById("calculate").addEventListener("click",()=>{const total=Number(budget.value)||0;const count=Math.max(1,Number(people.value)||1);result.textContent=`¥${(total/count).toFixed(2)}`;});',
  },
  capabilities: { storage: false },
};

function runnerFor(values: unknown[]) {
  const calls: Array<{ model: string; input: Record<string, unknown> }> = [];
  const runner: AiRunner = {
    run: async (model, input) => {
      const value = values[calls.length];
      calls.push({ model, input });
      return value;
    },
  };
  return { runner, calls };
}

test("uses one planning call and one Qwen engineering call", async () => {
  const { runner, calls } = runnerFor([{ response: planning }, { response: serializeCodeBundle(bundle) }]);
  const progress: StageProgress[] = [];
  const result = await generateAppWithAgents("做一个旅行预算计算器", undefined, runner, {
    onStage: async (event) => { progress.push(event); },
  });

  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((call) => call.model), [PLANNING_MODEL, ENGINEERING_MODEL]);
  assert.deepEqual(calls[0].input.response_format, { type: "json_object" });
  assert.equal(calls[0].input.max_tokens, 1800);
  assert.equal(calls[1].input.max_tokens, 6000);
  assert.match(JSON.stringify(calls[0].input.messages), /canonical schema/);
  assert.match(JSON.stringify(calls[1].input.messages), /ATOM_FILE:app\.js/);
  assert.deepEqual(progress.filter((item) => item.status === "COMPLETED").map((item) => item.role), ["product", "architecture", "design", "engineering"]);
  assert.equal(result.bundle.title, "旅行预算计算器");
  assert.equal(result.generation.source, "workers_ai");
  assert.equal(result.generation.model, ENGINEERING_MODEL);
  assert.equal(result.generation.fallbackReason, null);
  assert.equal(result.steps[0].sharedCallId, result.steps[1].sharedCallId);
});

test("repairs an invalid code bundle exactly once", async () => {
  const invalid = serializeCodeBundle(bundle).replace(bundle.files["app.js"], 'fetch("https://example.com")');
  const { runner, calls } = runnerFor([{ response: planning }, { response: invalid }, { response: serializeCodeBundle(bundle) }]);
  const result = await generateAppWithAgents("做一个旅行预算计算器", undefined, runner);

  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map((call) => call.model), [PLANNING_MODEL, ENGINEERING_MODEL, ENGINEERING_MODEL]);
  assert.match(JSON.stringify(calls[2].input.messages), /DISALLOWED_JAVASCRIPT/);
  assert.equal(result.steps[3].attemptNo, 2);
  assert.equal(result.steps[3].artifact?.repaired, true);
  assert.equal(result.generation.source, "workers_ai");
});

test("falls back to deterministic planning but still uses Qwen", async () => {
  const { runner, calls } = runnerFor([{ response: { unexpected: true } }, { response: serializeCodeBundle(bundle) }]);
  const result = await generateAppWithAgents("做一个旅行预算计算器", undefined, runner);

  assert.equal(calls.length, 2);
  assert.equal(result.steps[0].source, "deterministic");
  assert.equal(result.steps[0].errorCode, "INVALID_PLANNING_ARTIFACT");
  assert.equal(result.generation.source, "workers_ai");
  assert.equal(result.generation.fallbackReason, "INVALID_PLANNING_ARTIFACT");
});

test("uses the narrow deterministic compiler only for an explicit counter", async () => {
  const result = await generateAppWithAgents("做一个计数器，初始值 3，支持增加、减少、重置，刷新后保存", undefined, undefined);

  assert.equal(result.generation.source, "deterministic");
  assert.equal(result.generation.outcome, "SUCCESS");
  assert.equal(result.generation.failureCode, null);
  assert.equal(result.generation.fallbackReason, "AI_UNAVAILABLE");
  assert.equal(result.bundle.capabilities.storage, true);
  assert.match(result.bundle.files["app.js"], /Atoms\.storage/);

  await assert.rejects(
    () => generateAppWithAgents("做一个旅行待办应用", undefined, undefined),
    (error: unknown) => error instanceof GenerationFailure && error.code === "AI_UNAVAILABLE",
  );
});

test("planning envelope rejects extra fields and unsafe sizes", () => {
  assert.equal(PLANNING_SCHEMA.additionalProperties, false);
  assert.throws(
    () => parsePlanningEnvelope({ ...planning, debug: true }),
    (error: unknown) => error instanceof GenerationFailure && error.code === "INVALID_PLANNING_ARTIFACT",
  );
  assert.throws(
    () => parsePlanningEnvelope({ ...planning, product: { ...planning.product, summary: "x".repeat(181) } }),
    (error: unknown) => error instanceof GenerationFailure && error.code === "INVALID_PLANNING_ARTIFACT",
  );
});

test("keeps model and deadline contracts bounded", () => {
  assert.equal(MODEL_DEADLINE_MS, 52_000);
  assert.deepEqual(STAGE_TIMEOUTS_MS, { planning: 12_000, engineering: 32_000, repair: 8_000 });
  assert.equal(PLANNING_MODEL, "@cf/meta/llama-3.3-70b-instruct-fp8-fast");
  assert.equal(ENGINEERING_MODEL, "@cf/qwen/qwen2.5-coder-32b-instruct");
});
