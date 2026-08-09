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

# CHG-006 JSON Schema 与对象响应适配验收基线独立复核

- 日期：2026-08-09
- Reviewer：`codex-independent-chg006-reviewer`
- 结论：`REJECTED`

## 已确认

- VT-018 已要求 spy 固定 Llama 模型、`max_tokens:2200`、`response_format.type=json_schema`，检查 required、数组上限、action 分支与 `additionalProperties:false`，并证明同一合法 envelope 以字符串或对象返回时结果一致。
- 原有 JSON Mode 拒绝、55/65 秒预算、48 KiB、枚举失败码、fallback 校验、completion/failure 原子性、迟到结果、限流/容量/幂等零调用等断言仍保留，未运行用例继续为 pending。

## 阻塞项

### CHG6-AREV-001 — 对象响应的新攻击面缺少负向用例

VT-018 只覆盖合法对象与合法字符串等价，未明确覆盖对象分支的 `null`、数组、数字/布尔值、不可安全序列化对象、序列化后超过 48 KiB、顶层或嵌套额外字段和非法 AppSpec。应以表驱动方式固定这些输入的失败码/fallback、无原始响应日志、无非法 version/event/current 写入，并证明对象路径同样经过 48 KiB、exact-keys 和 `validateAppSpec`，不能因跳过字符串解析而绕过边界。

### CHG6-AREV-002 — 最高风险线上门禁仍可被 CHG-006 前证据关闭

GAP-004 和 VT-017 仍只锁定 CHG-005 与 `artifacts/chg005-online-model-2026-08-09.md`。CHG-006 改变了实际请求 schema 与响应解析器，旧 artifact 即使存在也不能证明新路径成功。应把 GAP-004/VT-017 的关闭条件更新为部署 CHG-006 后的同一 commit、Worker version、bindings、requestId/runId 与 Llama `workers_ai/SUCCESS`，并使用 CHG-006 专属 artifact（或在受控 artifact 中明确不可混淆的 CHG-006 版本段）；`adce530c` 或历史成功 event 不得关闭该门禁。

## 结论边界

在 CHG6-AREV-001/002 关闭前，CHG-006 验收基线不能重新冻结，且不得声明 JSON Schema/对象响应路径已在线接通。

# CHG-006 JSON Schema 与对象响应适配验收基线独立复核（第二轮）

- 日期：2026-08-09
- Reviewer：`codex-independent-chg006-reviewer`
- 结论：`CONFIRMED`
- 关闭项：`CHG6-AREV-001`、`CHG6-AREV-002`
- VT-018 已要求请求 schema 与 DESIGN-004 唯一对象逐字段一致，并以表驱动覆盖合法字符串/对象等价以及对象 `null`、数组、数字、布尔值、不可安全序列化、序列化后超 48 KiB、顶层/嵌套额外字段和非法 AppSpec；每例均验证精确失败边界、透明 fallback、无原始响应日志及无非法 version/event/current。
- VT-017 与 GAP-004 已切换到 CHG-006 专属 `artifacts/chg006-online-model-2026-08-09.md`，要求同一部署 commit/Worker version/bindings 与同一 requestId/runId 的 Llama `workers_ai/SUCCESS`；明确排除 `adce530c`、CHG-005 artifact 和历史 event。
- 原有 55/65 秒预算、D1 原子性、失败/迟到、幂等/限流/容量零调用及 VT-019/020 回归保持不变；所有未执行项继续为 pending。
- 声明边界：CHG-006 验收基线可以重新冻结；GAP-004 关闭且形成真实在线证据前，不得声明 JSON Schema/对象响应路径已接通。

# CHG-007 真实四阶段 Agent 验收基线独立复核

- 日期：2026-08-09
- Reviewer：`codex-independent-chg007-reviewer`
- 结论：`REJECTED`

## 已确认

- R19~R22 与 VT-021~024 已覆盖四次独立调用、上游产物传递、阶段持久化、reserve/execute claim、一次 repair、实时轮询、超时迟到和旧库升级；GAP-006 明确保持 OPEN，并声明旧 CHG-006 证据不能关闭真实多 Agent 门禁。
- VT-021/024 使用 runner counter、Promise barrier、临时 D1 与 SQL 回查，能够验证大部分本地幂等和单 version/event 不变量；VT-022 把中间 UI 状态绑定到 D1 GET，而不是本地动画。

## 阻塞项

### CHG7-AREV-001 — VT-021 无法验证未冻结的阶段 schema

VT-021 要求 fake runner“按 schema 名”返回 JSON并做 exact-key 检查，但 DESIGN-005 没有四份完整 schema。应先关闭 CHG7-DREV-001，再让测试逐字段比对实际 `AiBinding.run` 收到的模型、token、response_format/schema 和清洗后的上下游输入，并为每一阶段覆盖额外字段、超长/超大、错误类型与非法 artifact 不进入下游/D1 的负向表。

### CHG7-AREV-002 — 五调用 repair 路径没有 55/65 秒边界证明

VT-023 只断言调用次数和 repair 结果，没有 fake monotonic clock 的临界序列。需覆盖前四阶段耗时接近 55 秒时 repair 不再调用、剩余预算小于 Engineering 上限时的裁剪/拒绝、repair 成功/失败后的 fallback 与 completion，并逐项断言 AI 墙钟 `<55s`、reserve+execute/API 口径 `<65s`、D1 `duration_ms` 与外部测量一致；等于阈值应失败。

### CHG7-AREV-003 — VT-022 的“受控测试 runner”不可重复且边界不安全

真实模型过快时允许用受控 runner 收集中间 UI 证据，但没有说明 runner 如何注入、运行在哪个隔离部署、如何记录 commit/Worker version/bindings、如何保证客户端请求不能开启故障/延迟开关，以及如何清理测试数据。应固定为组件级 fetch adapter，或定义独立测试 Worker 的服务端配置与证据/清理协议；不得用公开 query/body 参数切换 runner，也不能让该证据冒充真实 AI 四阶段证据。

### CHG7-AREV-004 — 并发迁移与 RUNNING step 回收缺少精确断言

VT-024 只顺序执行初始化两次，未覆盖两个初始化并发观察缺列的竞争；中断回收也未明确逐个断言已完成 step 保留、当前 RUNNING 与后续 PENDING 均收敛为指定状态/error_code。应增加并发 migration barrier/re-read，以及 product 已完成、architecture 正在执行时回收并让旧 promise 迟到 resolve 的完整列级回查。

### CHG7-AREV-005 — 新线上证据没有固定唯一 artifact

GAP-006 虽排除了旧 CHG-006 证据，但只写“证据归档”，VT-021/022/024 没有统一指定 CHG-007 artifact 及最小字段。应固定例如 `artifacts/chg007-online-multistage-2026-08-09.md`，记录同一 commit、Worker version、AI/DB bindings、database id、owner/requestId/projectId/runId、reserve/execute HTTP 时序、四 step artifact/attempt/duration、event/version/current、真实浏览器阶段与交互证据；历史 run、CHG-006 artifact 或受控 runner 证据不得关闭 GAP-006。

## 结论边界

在 CHG7-AREV-001~005 关闭前，CHG-007 验收基线不可重新冻结；VT-021~024 继续保持 pending，旧证据不得用于声明真实四阶段 Agent 已上线。

# CHG-007 真实四阶段 Agent 验收基线独立复核（第二轮）

- 日期：2026-08-09
- Reviewer：`codex-independent-chg007-reviewer`
- 结论：`REJECTED`
- 已关闭：`CHG7-AREV-003`、`CHG7-AREV-004`、`CHG7-AREV-005`
- 部分关闭：`CHG7-AREV-001`、`CHG7-AREV-002`

## 已确认

- VT-021 已增加生产 schema 导入、上下游哨兵、串行调用、PENDING→RUNNING→COMPLETED 和逐阶段非法/超限 artifact 的表驱动负向矩阵。
- VT-022 已把延迟 runner 限定为本地模块级 fetch adapter，并要求 production build 排除公开测试开关；线上只用真实 AI/D1 证据，不再由受控 runner 冒充，关闭 AREV-003。
- VT-024 已覆盖并发 migration barrier、duplicate-column 回读、RUNNING/PENDING 超时收敛、COMPLETED artifact 保留和迟到 promise，关闭 AREV-004。
- GAP-006 已固定唯一 `artifacts/chg007-multi-agent-2026-08-09.md` 及 commit、Worker version、D1、请求/run、step/event/version/current、浏览器和阈值字段，并排除 CHG-006/旧 version/event，关闭 AREV-005。

## 剩余阻塞项

### CHG7-AREV2-001 — Schema deep-equal 目标仍自相矛盾

VT-021 要求生产 schema 与 DESIGN-005 exact deep-equal，同时要求 Engineering 复用同一 `APP_SPEC_SCHEMA` 对象；但设计 JSON 中是不可解析的字符串 `$ref:"APP_SPEC_SCHEMA"`。在 DREV2-001 修正为唯一可序列化 schema 前，该测试无法同时证明传给 Workers AI 的对象有效、与设计一致且无复制漂移。修正后还应增加 Product `requiredCapabilities:["toast"]` 的遵循/拒绝用例。

### CHG7-AREV2-002 — 65 秒临界用例没有证明最终响应仍在预算内

VT-023 让 completion 时钟推进到 65,000ms 后断言 `GENERATION_DEADLINE_EXCEEDED`，但没有也无法按当前设计证明随后 failure batch、回查和 HTTP body 完成仍 `<65,000ms`。应配合 DREV2-002 增加 finalize 保留窗口，用 fake clock 覆盖 completion/fallback 卡住、取消、failure batch、回查和响应全过程；断言最终 run/request/step/project 状态、无 version/event/current 移动，以及外部 API wall-clock 严格小于 65 秒，等于阈值即失败。

## 结论边界

在 CHG7-AREV2-001/002 关闭前，CHG-007 验收基线仍不可重新冻结；其余首轮验收阻塞已关闭，VT-021~024 继续保持 pending。

# CHG-007 真实四阶段 Agent 验收基线独立复核（第三轮）

- 日期：2026-08-09
- Reviewer：`codex-independent-chg007-reviewer`
- 结论：`REJECTED`
- 已关闭：`CHG7-AREV2-001`
- 部分关闭：`CHG7-AREV2-002`

## 已确认

- VT-021 已验证生产 Engineering schema 与设计 TypeScript 对象图 deep-equal、`properties.spec === APP_SPEC_SCHEMA`、序列化无 `$ref` 且包含完整 AppSpec，并覆盖五种 required/forbidden capability 与 external_script，关闭 AREV2-001。
- VT-023 已用 fake monotonic clock 覆盖 52 秒模型截止、repair 裁剪/丢弃/零调用、62 秒持久化截止、64.5 秒 failure 回查和 65 秒响应截止；正常、临界、504+读取回收边界均可判定。

## 剩余阻塞项

### CHG7-AREV3-001 — 必跑旧回归仍锁定已被 CHG-007 替换的 55 秒单模型超时

CHG-007 的 traceability/TASK-007 明确要求回归 VT-016~020，但 R18 仍写“55 秒模型预算必须仍可用”，VT-018 仍断言“生产默认值为 55,000ms”并在 55,000ms 触发单模型 `MODEL_TIMEOUT`。新设计的生产协议是总模型 deadline 52,000ms，单阶段上限 7/9/7/22/7 秒；二者不可能同时作为生产默认契约通过。应把 R18/VT-018 明确分层：保留适用于 CHG-006 legacy adapter 的历史回归时不得称其为当前生产默认；当前 CHG-007 的生产预算必须断言 52/62/65 与分阶段 timeout，并由 VT-023 承接。同步后仍需保留旧非法 envelope、fallback、completion 原子性和迟到写入回归，不得简单删除 VT-018。

## 结论边界

设计侧剩余阻塞已全部关闭；在 CHG7-AREV3-001 关闭前，CHG-007 验收基线仍不可重新冻结，VT-021~024 与关联回归继续保持 pending。

# CHG-007 真实四阶段 Agent 验收基线独立复核（最终轮）

- 日期：2026-08-09
- Reviewer：`codex-independent-chg007-reviewer`
- 结论：`CONFIRMED`
- 关闭项：`CHG7-AREV3-001`
- 当前预算：R18 明确要求 52 秒总模型、62 秒持久化和 65 秒 execute API；VT-017 按同一线上 run 验证四阶段各自 `<7/<9/<7/<22s`、总模型 `<52s`、completion `<62s`、API `<65s`；VT-018 固定生产 deadline 与 `7/9/7/22/7s` 上限，并明确不存在单次默认 `55000ms`。
- 回归保留：VT-018 继续覆盖 CHG-006 已验证的对象/字符串响应、非法/超限输出、安全 fallback、原子回滚、迟到写入以及拒绝路径零 AI 调用，但 CHG-006 artifact 仅为历史证据，不能通过当前 VT-017、VT-021~024 或关闭 GAP-006。
- 最终边界：首轮与后续全部设计/验收阻塞均已关闭，CHG-007 验收基线可以重新冻结；所有 case 仍为 pending，只有固定 CHG-007 artifact 和 GAP-006 条件完成后才能声明真实四阶段 Agent 已上线。
