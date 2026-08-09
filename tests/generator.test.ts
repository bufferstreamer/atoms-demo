import test from "node:test";
import assert from "node:assert/strict";
import { generateAppSpec, InputError, validateAppSpec } from "../lib/generator";
import type { AppSpec } from "../lib/types";

test("different briefs generate materially different interactive apps", () => {
  const dashboard = generateAppSpec("做一个旅行计划看板，支持状态筛选").spec;
  const tracker = generateAppSpec("做一个产品发布任务清单，可以添加任务").spec;
  const landing = generateAppSpec("做一个 AI 工具产品落地页，带申请表单").spec;
  assert.equal(dashboard.kind, "dashboard");
  assert.equal(tracker.kind, "tracker");
  assert.equal(landing.kind, "landing");
  assert.ok(dashboard.actions.some((action) => action.kind === "set_filter"));
  assert.ok(tracker.actions.some((action) => action.kind === "toggle_item"));
  assert.ok(landing.form);
});

test("supported change creates a coral derivative without mutating the base", () => {
  const base = generateAppSpec("做一个旅行计划看板").spec;
  const original = JSON.stringify(base);
  const changed = generateAppSpec("换成暖色并增加统计卡", base).spec;
  assert.equal(JSON.stringify(base), original);
  assert.equal(changed.theme.accent, "coral");
  assert.ok(changed.stats.length > base.stats.length);
});

test("unsupported changes are explained and rejected", () => {
  const base = generateAppSpec("做一个旅行计划看板").spec;
  assert.throws(() => generateAppSpec("接入量子支付", base), (error: unknown) => {
    return error instanceof InputError && error.code === "UNSUPPORTED_CHANGE" && error.status === 422;
  });
});

test("invalid filter actions and allValue are rejected", () => {
  const base = generateAppSpec("做一个旅行计划看板").spec;
  const invalidAction = structuredClone(base) as AppSpec;
  const filterAction = invalidAction.actions.find((action) => action.kind === "set_filter");
  if (!filterAction || filterAction.kind !== "set_filter") throw new Error("fixture missing filter action");
  filterAction.value = "不存在";
  assert.throws(() => validateAppSpec(invalidAction), /筛选动作无效/);

  const invalidAll = structuredClone(base) as AppSpec;
  invalidAll.filters[0].allValue = "任何";
  assert.throws(() => validateAppSpec(invalidAll), /筛选默认值无效/);
});

test("empty and oversized prompts fail before generation", () => {
  assert.throws(() => generateAppSpec("  "), (error: unknown) => error instanceof InputError && error.code === "EMPTY_PROMPT");
  assert.throws(() => generateAppSpec("a".repeat(801)), (error: unknown) => error instanceof InputError && error.code === "PROMPT_TOO_LONG");
});
