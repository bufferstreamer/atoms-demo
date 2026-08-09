# Atoms AI App Builder Demo - 高风险验收基线独立复核（第四轮）

## 最终复核结果

### 范围与设计覆盖

- FR-001~006 的正常与失败链均由 `design/verification-matrix.md`、TASK 和 VT 承接。
- AppSpec 真实筛选/allValue、表单/toggle、非法 schema/value；D1 刷新恢复；owner 隔离；输入与 owner/global 容量；首次和项目内幂等；并发/超时/迟到；修改与版本负向；窄屏和在线发布均有明确验收断言。

### 可重复执行协议

- VT-006/011~016 已定义测试 seam、临时 D1 fixture、请求/状态准备、五表/指针/JSON/限流回查与整库清理。
- 故障注入与阈值覆盖只存在于测试构造，不暴露线上开关；不会用线上环境制造 5000 条容量数据。
- VT-009 在线使用两个独立浏览器/Cookie 会话复验 VT-010，满足高风险 owner 权限链的真实环境证据要求。
- VT-016 固定类型检查、生产构建、同一本地 D1 连续两次 schema 初始化和 `sqlite_master` 回查。

### 冻结映射与状态门禁

- 受 acceptance hash 保护的 `cases.md` 已正式写明：VT-016 接入 TASK-005、NFR-001、NFR-005；TASK-005 完成定义包含类型检查、生产构建和幂等 schema。
- `plan-addendum.md` 仅为冗余可读索引，不再是该映射的唯一事实源。
- GAP-001 要求关闭 VT-001~016 与 R1~R14；GAP-002/003 清楚记录在线外部前置和匿名残余 DoS 风险。
- evidence 分别统计 Cases 0/0/16、Rules 0/0/14，总体 `NOT_RUN`；所有未执行项均保持 pending，没有无证据通过或完成声明。

## Findings

未发现阻止验收冻结的新问题。

## 结论

`CONFIRMED` — AREV-001~004、AREV2-001~002、AREV3-001 均已关闭。当前 Rules、Cases、执行工具协议、Evidence 状态、Gaps、TASK/NFR 映射与在线外部前置形成完整的高风险验收基线，可以进入 `ACCEPTANCE_FROZEN` 门禁。本结论只确认验收基线可执行且可判定，不代表任何用例已运行或功能已通过；本轮未执行 freeze 命令。
# CHG-003 验收基线独立复核

- 日期：2026-08-09
- Reviewer：`codex-independent-source-reviewer`
- 结论：`CONFIRMED`
- 新增门禁：R15-R17、VT-017-VT-019，并将模型表/旧数据升级接入 VT-016。
- 最高风险开放项：GAP-004。没有同一部署 commit、Worker version、AI/DB binding、requestId→runId→`workers_ai/SUCCESS` event 的在线证据，不得声明模型已接通。
# CHG-004 验收基线独立复核

- 日期：2026-08-09
- Reviewer：`codex-independent-source-reviewer`
- 结论：`CONFIRMED`
- 新增门禁：R18、VT-020；VT-017/018 增加 55 秒模型与 65 秒 API 双预算证据。
- 完成边界：线上 artifact 必须关联同次 requestId/runId/event、部署 commit/version/bindings，并提供真实浏览器长等待证据。

# CHG-005 Llama 3.1 8B Fast 验收基线独立复核

- 日期：2026-08-09
- Reviewer：`codex-independent-chg005-reviewer`
- 结论：`REJECTED`

## 已确认

- VT-017 已要求同次 requestId 对应 `workers_ai/@cf/meta/llama-3.1-8b-instruct-fast/SUCCESS/null`，并保留 55/65 双预算、D1 duration 对照、部署 commit/version/bindings 与固定线上 artifact。
- VT-020 的 AI READY 展示已切换为 Llama；VT-018/019 的非法输出、降级、原子写入和版本兼容协议未被削弱。

## 阻塞项

### CHG5-AREV-001 — 缺少模型调用请求契约回归

当前 VT-017 只能在线证明最终成功，VT-018 只锁定 55,000ms timeout，没有固定验证实际 `AiBinding.run` 收到：精确模型 ID `@cf/meta/llama-3.1-8b-instruct-fast`、`max_tokens: 2200`、`response_format: { type: "json_object" }`，以及不再携带 GLM 专属/遗留参数。应在 fake binding/spy 中逐字段断言调用参数，并覆盖 JSON Mode 平台拒绝时映射到枚举失败码和透明 fallback。

### CHG5-AREV-002 — 最高风险 gap 仍指向旧变更

GAP-004 仍写“CHG-003 尚未实现”且没有锁定 CHG-005 的 Llama 模型与 `chg005-online-model-2026-08-09.md`。应更新为当前最高风险门禁：只有同一部署、同一 requestId/runId 的 Llama `workers_ai/SUCCESS` 且满足 55/65 秒预算，才能关闭；GLM 或任意历史成功 event 不得关闭该 gap。

## 结论边界

在 CHG5-AREV-001/002 关闭前，CHG-005 验收基线不可重新冻结；所有新增/修改用例继续保持 pending，不能声明模型接入完成。

# CHG-005 Llama 3.1 8B Fast 验收基线独立复核（第二轮）

- 日期：2026-08-09
- Reviewer：`codex-independent-chg005-reviewer`
- 结论：`CONFIRMED`
- 关闭项：`CHG5-AREV-001`、`CHG5-AREV-002`
- 参数契约：VT-018 已通过 fake binding/spy 固定精确模型 ID、`max_tokens: 2200`、`response_format: { type: "json_object" }`，并断言不存在 `max_completion_tokens`、`reasoning_effort` 等遗留参数；JSON Mode 平台拒绝映射为 `MODEL_ERROR` 并透明 fallback。
- 线上门禁：GAP-004 已锁定 CHG-005，只接受同一部署、同一 requestId/runId 的 Llama `workers_ai/SUCCESS`、模型 `<55s`、API `<65s` 与 `artifacts/chg005-online-model-2026-08-09.md`；GLM 或历史 event 无效。
- 声明边界：CHG-005 验收基线可以重新冻结；VT-016~020 与相关回归继续保持 pending，在线证据完成前不得声明真实模型已接通。
