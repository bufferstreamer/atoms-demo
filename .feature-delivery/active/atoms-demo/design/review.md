# Atoms AI App Builder Demo - 高风险设计独立复核（第五轮）

## 复核范围

- `design/technical-design.md`
- `design/verification-matrix.md`
- `implementation-plan.md`
- `.vibetest/atoms-demo/rules.md`、`cases.md`、`gaps.md`
- 前四轮 DREV、DREV2、DREV3、DREV4 阻塞项回归

## 最终复核结果

### 真实交互与 Agent 生成

- AppSpec v1 已定义组件、action、局部状态、白名单、大小约束、错误行为和两个完整示例。
- `set_filter.value`、`filterValues[filterId]`、form→add_item 映射及 `allValue` 通配规则均可唯一实现。
- VT-002 已锁定“具体筛选收窄→allValue 恢复全集”，VT-012 已覆盖非法 value/allValue、悬空 action、未知 schema 和越界拒绝。
- 四阶段确定性工作流明确为已持久化步骤的可读回放，不伪装外部模型流式执行；复杂度取舍与产品表述一致。

### D1、幂等、并发与恢复

- 首次创建由 `workspace_requests(owner_key, request_id)` 唯一约束，已有项目由 `runs(project_id, request_id)` 唯一约束。
- 首次 `baseVersionId:null` 与后续 base 均使用 null-safe/current pointer 守卫；完成 batch 对 version、steps、run、project 和 workspace request 顺序加条件并回查影响结果。
- `workspace_requests` 已包含 `error_code`；COMPLETED、普通 FAILED、RUN_TIMEOUT 与关联 run/steps 的状态写入路径明确。
- RUNNING 时拒绝 activate；超时清理后迟到 batch 不能插入版本或移动指针。VT-014 已覆盖首次三态重放、已有项目幂等、生成/激活竞争与迟到完成。

### 匿名 owner、安全与容量

- Cookie、owner_key、服务端过滤、404 防枚举、日志脱敏、prompt 限制、参数化 SQL 与 AppSpec 禁止执行代码均已具体化。
- `rate_limits(bucket_key, window_start, action, count)` 与实现一致：bucket 支持 owner/global，action 区分 generate/create_project，复合主键可承载独立原子桶。
- owner 级限制之外已有全站分钟桶和 5000 项目硬上限；Cookie 重置残余 DoS 风险在 GAP-003 明确接受，且不宣称企业级防滥用。VT-010/011 可验证隔离、owner/global 限额和容量降级。

### 修改、版本、任务与验收

- 修改白名单、base/parent、不可变版本、乐观激活和错误不移动 current pointer 已由 DESIGN-001/002/003、TASK-004、VT-005/015 闭环。
- `verification-matrix.md` 完整承接 FR-001~006 与 DEC-006/007/009 的 DESIGN/TASK/VT 正反链，同时保持已冻结 scope 产物不变。
- TASK-001~005 的依赖、完成定义和 VT-001~015 足以形成实现工作包；GAP-001/002 正确保留“尚未实现、尚未在线”的完成声明边界。

## Findings

未发现阻止设计冻结的新问题。

## 结论

`CONFIRMED` — DREV-001~005、DREV2-001~003、DREV3-001~002、DREV4-001~002 均已关闭。当前技术方案在真实交互、D1 持久化、Agent 驱动生成、继续修改/版本、匿名 owner 隔离、幂等并发、失败恢复、容量保护和任务验收追踪方面已达到高风险设计冻结要求，可以进入 `DESIGN_FROZEN` 门禁。本结论只确认设计基线，不代表代码实现、验收或发布完成；本轮未执行 freeze 命令。
# CHG-003 Workers AI 接入独立复核

- 日期：2026-08-09
- Reviewer：`codex-independent-source-reviewer`
- 轮次：5
- 最终结论：`CONFIRMED`
- 确认范围：官方模型与免费额度事实快照、严格 generation envelope、两阶段 request/run reservation、AI 前幂等/限流/容量/RUNNING 锁、attempt token 完成与迟到守卫、generation event 原子一致性、completion/failure/超时收敛、首版旧库升级、线上 requestId→runId→event 证据链。
- 声明边界：只确认 CHG-003 设计与验收基线可重新冻结，不代表代码已实现或线上模型已接通。
# CHG-004 模型时延与长等待体验独立复核

- 日期：2026-08-09
- Reviewer：`codex-independent-source-reviewer`
- 轮次：4
- 最终结论：`CONFIRMED`
- 确认范围：55 秒模型预算与 65 秒 API E2E 预算、2 分钟 RUNNING 回收、BUILDING 刷新轮询、重复提交保护、timer 清理、composer 恢复，以及 READY workers_ai / READY deterministic fallback / FAILED no-event 三类终态语义。
- 声明边界：只确认 CHG-004 可重新冻结；VT-017 仍需真实线上 `workers_ai/SUCCESS`。

# CHG-005 Llama 3.1 8B Fast 模型切换独立设计复核

- 日期：2026-08-09
- Reviewer：`codex-independent-chg005-reviewer`
- 结论：`REJECTED`

## 已确认

- Cloudflare 官方模型页确认 `@cf/meta/llama-3.1-8b-instruct-fast` 为 Cloudflare-hosted Fast 模型，输入参数使用 `max_tokens`；官方 JSON Mode 支持列表包含该精确模型 ID。
- DESIGN-004、TASK-006 与 VT-017 已切换到同一模型 ID，55 秒模型预算、65 秒 API E2E、48 KiB、严格 envelope/AppSpec 校验、两阶段持久化、attempt token、fallback 与 2 分钟回收协议未被放宽。

## 阻塞项

### CHG5-DREV-001 — 官方事实引用不可独立稳定读取

`reference/workers-ai-model-facts-2026-08-09.md` 的 Llama 链接仍使用 `https://developers.cloudflare.com/ai/models/@cf/meta/llama-3.1-8b-instruct-fast/`，本轮独立读取出现 redirect loop；Cloudflare 当前可直接读取的 canonical URL 为 `https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fast/`。同时该快照仍声明“仅用于 CHG-003”、末尾仍写“两个模型/CHG-003”，`dependencies.md` 的 REF-009 仍只列 pricing/GLM/Kimi，未索引 Llama 与 JSON Mode。需统一为 CHG-003/005 可复核事实快照并修正依赖索引。

### CHG5-DREV-002 — 冻结后变更影响追踪不完整

CHG-005 的 change-log 影响栏没有 FR/NFR，traceability 只新增 NFR-003；但生产生成模型直接承接 FR-002/003/004/006 与 NFR-001/002/004/005，至少应明确这些需求“契约不变但实现依赖模型替换并需回归”，并追踪到 TASK-006、VT-017/018/019/020 及既有业务回归用例。否则模型切换未满足冻结后变更的受影响需求登记要求。

## 结论边界

在 CHG5-DREV-001/002 关闭前，CHG-005 不能重新冻结。本结论不评价业务代码实现，也不代表 Llama 已在线成功生成。

# CHG-005 Llama 3.1 8B Fast 模型切换独立设计复核（第二轮）

- 日期：2026-08-09
- Reviewer：`codex-independent-chg005-reviewer`
- 结论：`CONFIRMED`
- 关闭项：`CHG5-DREV-001`、`CHG5-DREV-002`
- 复核依据：模型事实快照已使用 Cloudflare canonical Llama URL，并统一 CHG-003/005、GLM/Llama/Kimi 与 JSON Mode 口径；REF-009 同步索引完整。CHG-005 的 change-log 与 traceability 已覆盖 FR-002/003/004/006、NFR-001/002/003/004/005，关联 DESIGN-004、TASK-006、VT-016~020 及 VT-002/003/005 回归。
- 设计边界：仅替换生产模型与模型专属参数；55/65 秒预算、严格 envelope/AppSpec 校验、两阶段 run reservation、D1 原子审计、attempt token、超时回收、UI 状态与透明 fallback 均保持不变。
- 声明边界：CHG-005 设计变更可以重新冻结；本结论不代表业务代码已完成，也不代表 Llama 已在线成功生成。

# CHG-006 JSON Schema 与对象响应适配独立设计复核

- 日期：2026-08-09
- Reviewer：`codex-independent-chg006-reviewer`
- 结论：`REJECTED`

## 已确认

- Cloudflare 官方 JSON Mode 契约支持 `response_format.type=json_schema` 与有效 JSON Schema，示例响应中的 `response` 可为已解析对象；官方同时不保证模型绝对遵循 schema，因此保留 exact-keys、`validateAppSpec` 二次校验与透明 fallback 是必要且方向正确的。
- CHG-006 已在 change-log 和 traceability 覆盖 FR-002/003/004/006、NFR-001/002/003/004/005，并关联 DESIGN-004、TASK-006、VT-017/018/019/020 及 VT-002/003/005 回归；55/65 秒预算、48 KiB、两阶段 D1 原子持久化、attempt token、超时回收与 UI 状态协议均未被放宽。

## 阻塞项

### CHG6-DREV-001 — 冻结设计没有可核验的完整 JSON Schema

DESIGN-004 仍写作 `json_schema:<完整 envelope schema>`，后文只用自然语言概括字段、分支、数组上限和 `additionalProperties:false`，没有内联 schema，也没有引用受控且可哈希的 schema artifact。由此无法独立判断 required、嵌套对象、四类 action 分支、四步顺序及 AppSpec 全部约束是否真的可由同一份有效 schema 表达，TASK-006 和 VT-018 也没有唯一的预期对象可对照。应把完整 schema 固化在 DESIGN-004 或引用一个纳入冻结/哈希的唯一 schema 文件，并明确其 draft/Workers AI 兼容口径；服务端 validator 继续作为二次边界。

### CHG6-DREV-002 — CHG-006 的事实快照适用范围未闭环

`reference/workers-ai-model-facts-2026-08-09.md` 已新增 JSON Schema/对象响应事实，但文件仍声明“用于 CHG-003 与 CHG-005”，末尾也只写 `CHG-003/005`。应把 CHG-006 纳入快照适用范围，避免变更记录依赖一个按自身声明不覆盖该变更的事实源。

## 结论边界

在 CHG6-DREV-001/002 关闭前，CHG-006 不能重新冻结。本结论只审查设计与证据闭环，不评价业务代码实现，也不代表线上模型已经成功生成。

# CHG-006 JSON Schema 与对象响应适配独立设计复核（第二轮）

- 日期：2026-08-09
- Reviewer：`codex-independent-chg006-reviewer`
- 结论：`CONFIRMED`
- 关闭项：`CHG6-DREV-001`、`CHG6-DREV-002`
- Schema 契约：DESIGN-004 已内联唯一 `APP_SPEC_ENVELOPE_SCHEMA`，固定 JSON Schema 2020-12，并完整约束 envelope、AppSpec 字段、required、枚举、数组上限、四类 action 分支与四步 `prefixItems` 顺序；除 `filterValues` 明确为动态 string map 外对象均封闭，动态 key 与 filter id 的引用关系继续由 `validateAppSpec` 二次校验。
- 对象响应边界：只接受字符串或非 null、非数组的普通 JSON object；对象安全序列化后与字符串统一进入 48 KiB、JSON 解析、exact-keys 和 AppSpec validator，失败保持枚举错误与透明 fallback，不放宽 D1 写入边界。
- 事实与追踪：模型事实快照已明确覆盖 CHG-006；change-log、traceability、TASK-006 与 VT-017~020 的 FR/NFR 影响和回归关系一致。
- 声明边界：CHG-006 设计基线可以重新冻结；本结论不代表业务代码已完成，也不代表线上 JSON Schema 路径已经成功。

# CHG-007 真实四阶段 Agent 独立设计复核

- 日期：2026-08-09
- Reviewer：`codex-independent-chg007-reviewer`
- 结论：`REJECTED`

## 已确认

- change-log、traceability 与 TASK-007 已把 CHG-007 追到 FR-002/003/004/006、NFR-001/002/003/004/005/007、DESIGN-005、VT-021~024 及既有关键回归；`feature.yaml` 仍保留旧冻结哈希，符合“待独立复核后重新冻结”的状态边界。
- reserve 不调用 AI、execute 原子 claim、重复 execute 零模型调用、attempt token 迟到保护、四阶段串行、一次 Engineering repair、55 秒共享模型预算和 65 秒 API 预算的总体方向合理；CHG-006 的 owner、限流、版本、fallback 与原子 completion 协议未被主动放宽。

## 阻塞项

### CHG7-DREV-001 — 四份上下游 artifact 没有唯一可实现契约

DESIGN-005 只列出 `ProductBrief`、`ArchitecturePlan`、`DesignPlan` 和 Engineering envelope 的字段名称及少量数组/文本描述，没有内联或引用四份受冻结保护的 JSON Schema。required/optional、exact keys、字段类型、枚举、每个数组 item、文本长度和 12 KiB 计量口径均不能唯一确定；因此“前序已验证 artifact 才能进入下游”和 VT-021 的 exact-key/schema spy 没有可对照的权威对象。应固定四份完整 schema（或受控 schema artifact 与哈希），并明确每阶段输入 envelope、清洗规则和服务端二次语义校验。

### CHG7-DREV-002 — 超时回收对正在执行的 step 存在冲突

DESIGN-004 的一处协议只把 `PENDING` step 标为 FAILED，而后续章节写“尚未完成的 step”全部 FAILED；CHG-007 执行中必然存在 `RUNNING` step，并引用该旧回收协议。Worker 中断后若只更新 PENDING，当前阶段会永久停在 RUNNING，与 run/project 已 FAILED 冲突。应给出 CHG-007 唯一回收 batch：对同 run 且非终态的 `PENDING/RUNNING` step 统一写 `FAILED/RUN_TIMEOUT`，同步 run/request/project、清 attempt token，并规定已完成 artifact 是否保留及迟到 step/completion 写入的影响行回查。

### CHG7-DREV-003 — D1 加列迁移的并发可重复性未闭合

“先 `PRAGMA table_info`，缺列再 `ALTER TABLE ADD COLUMN`”只能保证顺序重复；两个 Worker 冷启动并发时可同时观察缺列，随后一个 `ALTER` 因 duplicate column 失败。设计应规定单写迁移/部署期迁移，或把 duplicate-column 竞争视为可接受结果并重新读取精确 schema 后继续；否则 CHG-006 旧库升级在生产并发初始化时不具备可重复性。

### CHG7-DREV-004 — repair 的共享截止时间仍有多种实现

四个阶段上限合计 49 秒，repair 复用 Engineering 时最多再需 23 秒。当前只写“共享 55 秒、调用前剩余不足则不再调用”，未定义单调 deadline、何谓“不足”、repair 实际 timeout 是否为 `min(23s, remaining)`，以及为 completion/fallback 保留的 10 秒是否从模型预算中隔离。应把每次调用的可用 timeout、达到/超过边界的比较规则、repair 放弃错误码和 generation/API duration 起止点写成唯一时序，确保任何五调用路径不突破 55/65 秒。

## 结论边界

在 CHG7-DREV-001~004 关闭前，CHG-007 设计不可重新冻结。本结论不评价业务代码实现，也不代表真实四阶段流水线已上线。

# CHG-007 真实四阶段 Agent 独立设计复核（第二轮）

- 日期：2026-08-09
- Reviewer：`codex-independent-chg007-reviewer`
- 结论：`REJECTED`
- 已关闭：`CHG7-DREV-002`、`CHG7-DREV-003`
- 部分关闭：`CHG7-DREV-001`、`CHG7-DREV-004`

## 已确认

- CHG-007 已给出 Product/Architecture/Design/Engineering response 与 Engineering artifact 的字段、required、枚举、数组和长度约束；非法 artifact 的服务端二次校验、12 KiB 限制及下游零调用边界已明确。
- 读取回收现在明确把同 run 的 `PENDING/RUNNING` step 原子收敛为 `FAILED/RUN_TIMEOUT`，保留 COMPLETED artifact，并以 run token 阻止迟到写入，关闭 DREV-002。
- D1 迁移已规定 duplicate-column 竞争后重读对应列、最终回读七个目标列及失败 promise 可重试，关闭 DREV-003。
- `t0/modelDeadline/apiDeadline`、单调时钟、每次模型 timeout 裁剪、超界结果丢弃及 repair 最多一次均比首轮唯一明确。

## 剩余阻塞项

### CHG7-DREV2-001 — Engineering schema 的 APP_SPEC 引用仍不是有效的唯一序列化契约

DESIGN-005 一方面要求 `engineering.properties.spec` 直接复用 `APP_SPEC_SCHEMA` 对象，另一方面内联的权威 JSON 却写 `"$ref":"APP_SPEC_SCHEMA"`。该值既不是可解析的本地 JSON Pointer，也没有对应 `$id/$defs`，若按文档逐字段传给 Workers AI 会形成未解析引用；若生产代码实际把常量对象直接嵌入，则又无法与文档 JSON exact deep-equal。应选择一种唯一的可序列化表达：直接把 `APP_SPEC_SCHEMA` 对象作为 `spec` 属性值，或在同一 schema 用 `$defs` 和 `#/$defs/...` 有效引用，并让文档、生产对象和 VT-021 对照同一表达。同时 `requiredCapabilities` 已允许 `toast`，但语义遵循校验只列 `filter/form/toggle/stats`；应补 `toast` 映射或从允许集合移除，避免 Product 声明必需能力却可被 Engineering 忽略。

### CHG7-DREV2-002 — API 到期后才执行 failure batch 无法保证 `<65s`

DESIGN-005 规定 55~65 秒用于 fallback/completion，且“到 `apiDeadline` 尚未安全完成则执行 token-guarded failure”。一旦到达 65,000ms 后才开始 D1 failure batch、回查和 HTTP 响应，最终 API 必然超过 `<65s`。应在 `apiDeadline` 前保留明确的失败收敛/响应预算（例如独立 `finalizeDeadline < apiDeadline`），或重新定义并获批预算口径；需给出在 completion/fallback 卡住时何时取消、何时落 FAILED、何时返回的唯一时序，不能以 65 秒时才启动补偿同时声称响应小于 65 秒。

## 结论边界

在 CHG7-DREV2-001/002 关闭前，CHG-007 设计仍不可重新冻结。其余首轮设计阻塞已关闭。

# CHG-007 真实四阶段 Agent 独立设计复核（第三轮）

- 日期：2026-08-09
- Reviewer：`codex-independent-chg007-reviewer`
- 结论：`CONFIRMED`
- 关闭项：`CHG7-DREV2-001`、`CHG7-DREV2-002`
- Schema：Engineering response 已改为唯一 TypeScript 对象图，`properties.spec` 直接引用 `APP_SPEC_SCHEMA`，序列化后包含完整 AppSpec schema 且不存在悬空 `$ref`；Product required/forbidden 的 filter/form/toggle/stats/toast 五能力映射和 external_script 禁止边界均已唯一化。
- 时序：DESIGN-005 已固定 `modelDeadline=52s`、`persistenceDeadline=62s`、`apiDeadline=65s`；模型与 repair timeout 由剩余模型预算裁剪，62 秒后取消成功路径，failure batch 最多使用到 64 秒、最终回查要求在 64.5 秒前结束并为响应保留 500ms。剩余不足时返回 504 并由读取回收，未把超预算路径伪装为受控完成。
- 声明边界：CHG-007 设计基线本身可以重新冻结；本结论不代表验收基线或业务实现已经通过。

# CHG-007 最终设计/验收一致性复核

- 日期：2026-08-09
- Reviewer：`codex-independent-chg007-reviewer`
- 结论：`CONFIRMED`
- 一致性确认：R18、VT-017、VT-018 已统一到 DESIGN-005 的 staged `52s model / 62s persistence / 65s API` 与 `7/9/7/22/7s` 阶段上限，不再把 CHG-006 的单调用 55 秒参数声明为当前生产默认。
- 回归边界：CHG-006 的非法输出、对象/字符串适配、fallback、completion/event/failure 原子性、迟到守卫以及限流/容量/幂等零调用仍作为行为回归保留；历史 artifact 不能证明 CHG-007 四阶段在线成功。
- 最终边界：CHG-007 设计与验收基线现已一致，可以重新冻结；实现、运行用例和 GAP-006 线上证据仍需后续完成。

# CHG-008 中间阶段 JSON Mode 兼容独立设计复核

- 日期：2026-08-09
- Reviewer：`codex-independent-chg008-reviewer`
- 结论：`REJECTED`

## 已确认

- Cloudflare 官方 JSON Mode 文档明确支持 `json_object`/`json_schema`，并说明模型不保证满足请求 JSON Schema，极端情况下返回 `JSON Mode couldn't be met`；两次 Product strict-schema `MODEL_ERROR` 与该兼容风险一致。
- DESIGN-005 §11.5 仅把 Product/Architecture/Design 的平台生成格式切为 `json_object`；system message 携带对应 `STAGE_SCHEMAS[role]` 的完整 canonical 序列化对象，Engineering/AppSpec 继续使用严格 `json_schema`。
- canonical schema、exact-key、类型/枚举/长度/唯一性/数组上限、12 KiB、下游零调用、D1 artifact、52/62/65 秒预算以及 owner/API/UI 协议均未被放宽；`json_object` 不被当作信任边界，设计安全方向成立。

## 阻塞项

### CHG8-DREV-001 — 冻结后影响登记未覆盖完整修改链且无 traceability 行

CHG-008 的 change-log 只登记 FR-002/003/004、NFR-001/002/003/004 和 VT-017/018/021/023，但同一四阶段 pipeline 也承接 FR-006 的基于当前 AppSpec 继续修改，并由 VT-019 验证合法修改/非法输出不覆盖历史版本；CHG-007 原追踪还包含 NFR-005/007 与相关回归。当前 `traceability.md` 没有 CHG-008 行，无法证明兼容切换对修改、版本和数据/创新性约束的回归责任。应补全实际受影响 FR/NFR，至少关联 DESIGN-005、TASK-007、VT-017/018/019/021/023 及必要 VT-024/业务回归，并在 traceability 登记 `CHANGE_PENDING_FREEZE`。

## 结论边界

在 CHG8-DREV-001 关闭前，CHG-008 设计变更不能重新冻结。本结论不评价业务代码，也不代表中间阶段已在线成功。

# CHG-008 中间阶段 JSON Mode 兼容独立设计复核（第二轮）

- 日期：2026-08-09
- Reviewer：`codex-independent-chg008-reviewer`
- 结论：`CONFIRMED`
- 关闭项：`CHG8-DREV-001`
- 影响闭环：change-log 已覆盖 FR-002/003/004/006、NFR-001/002/003/004/005/007、TASK-007、VT-002/003/005/016~021/023/024 与 GAP-006；traceability 已新增 CHG-008 `CHANGE_PENDING_FREEZE` 行，并把 DESIGN-005 §11.5、VT-019 修改链和必要回归纳入。
- 设计边界：Product/Architecture/Design 的 `json_object` 仅为平台兼容层，canonical `STAGE_SCHEMAS` 与服务端 exact-key/type/enum/length/unique/12 KiB 校验仍是唯一准入边界；Engineering/AppSpec 保持 `json_schema`，预算、D1、API、UI、owner、版本与迟到协议不变。
- 声明边界：CHG-008 设计基线可以重新冻结；本结论不代表业务代码或线上四阶段证据已完成。

# CHG-009 未登记生成收敛变更独立设计复核

- 日期：2026-08-10
- Reviewer：`codex-independent-chg009-reviewer`
- 复核实现：Git `86d348f4298444feb7c2081010442f4844b76bd0`，线上候选 Worker `812bd26c`
- 结论：`REJECTED`

## 已确认事实

- CHG-008 冻结后，`0e71098..86d348f` 实际新增 Product 驱动的 Engineering 派生 schema、AppSpec 关系规范化、required capability action 补齐、筛选可操作性修正和 UI `null/undefined` 字符串过滤；这不是单纯实现细节，已改变模型输出的接受、repair 和成功审计语义。
- 基础 AppSpec 白名单、对象 exact-key、最终 `validateAppSpec`、48 KiB/12 KiB、owner/D1/API/52-62-65 秒协议仍在；UI 仅隐藏精确的空值占位字符串，本身不扩大渲染能力。
- 本轮执行 production build 与现有测试成功，9/9 通过；该结果只证明现有回归未失败，不证明新增策略已被充分验收。

## 与冻结基线的冲突/阻塞

### CHG9-DREV-001 — 非法关系从“拒绝并 repair”变为静默改写，尚无冻结决策

DESIGN-002/005 与 VT-012/023 当前约定非法 `defaultValue/allValue`、action target/value、`filterValues` 关系应被 validator 拒绝，Engineering 缺 required capability 后最多 repair 一次。当前 `assertAppSpec` 会改写 default/allValue、set_filter target/value、add_item target 和 card filterValues；`completeRequiredCapabilities` 会在第一次 Engineering 输出后直接补 set_filter/add_item/toggle/show_toast，随后仍可能记录 `workers_ai/SUCCESS`、`attemptNo=1`、`repaired=false`。这改变了 FR-003/004/006、NFR-001/002/004/007 与 DESIGN-005 §11.3 的失败和来源语义，必须先登记并冻结“允许规范化的白名单、不可规范化错误、何时 repair、何时 fallback”。公开/API `validateAppSpec` 仍应保持严格拒绝，不能把 AI adapter 的修复扩散为通用宽松验证。

### CHG9-DREV-002 — 动态 schema 对冲突能力集合可生成不可满足契约

Product schema 允许同一 capability 同时出现在 required/forbidden。当前派生顺序可能先把 `form` 加入 required、随后删除 `form` property，或把 required filter/stats 的 minItems 与 forbidden maxItems=0 同时写入；若 filter/form/toggle/toast 全部 forbidden，actions 的 oneOf 可被过滤为空，但基础 AppSpec 又要求 actions 至少 1 项。应在 Product artifact 进入 Engineering 前固定冲突/可满足性校验与枚举错误码，并定义是 repair Product、直接 fallback 还是拒绝；不能把无解 schema 交给平台后笼统记为 MODEL_ERROR。

### CHG9-DREV-003 — “required filter 已补齐”不等于真实筛选能力

`completeRequiredCapabilities` 为缺少 set_filter 的已有 filter 添加 action 时使用 `filter.defaultValue`；该值常等于 `allValue`，action 只恢复全集却被 `abilityPresent(filter)` 视为能力已满足。若 options 只有 allValue，也不存在可收窄集合。冻结 DESIGN-002 明确要求筛选改变可见卡片。CHG-009 必须把 filter capability 定义为：至少一个非 allValue option、至少一张卡有对应合法非 all filterValue、set_filter 指向非 allValue 且操作后集合发生变化；无法安全补齐时进入 repair/fallback，而非标 SUCCESS。

### CHG9-DREV-004 — 服务端规范化/补齐没有可审计来源

Engineering artifact 仍只有 `{summary,repaired}`，线上 D1 无法区分模型原样通过、关系规范化或服务端补 action。既然最终 event 仍是 `workers_ai/SUCCESS`，至少应持久化不含模型原文的安全元数据，例如 `normalizationVersion`、`normalizedPaths[]`、`completedCapabilities[]`、base/derived schema SHA；否则 GAP-006 无法证明最终可交互结果来自哪条受控路径，也无法回放 CHG-009 行为。

## CHG-009 建议登记

- 变更原因：CHG-008 后线上输出仍出现可安全收敛的 AppSpec 关系/能力缺口；实现已部署候选 Worker `812bd26c`。
- 影响范围：FR-002/003/004/006，NFR-001/002/003/004/005/007，DESIGN-002/004/005（建议新增 §11.6 或 DESIGN-006），TASK-001/003/004/007，VT-002/003/005/012/017/018/019/021/023/024，GAP-006。
- 变更内容：Product 派生 Engineering schema、冲突能力预检、AI-adapter 专属安全规范化、required capability 安全补齐、规范化审计元数据、UI 空值占位过滤；AppSpec/API/D1 owner 与版本不变量保持兼容。
- 回滚：登记 CHG-008 最后已冻结且已验证的确切 commit/Worker；新增审计字段若采用 artifact JSON 扩展则向后兼容保留，不删除历史版本。
- 状态：`CHANGE_PENDING_FREEZE`；在设计/验收复核关闭前，`86d348f`/`812bd26c` 只能称候选实现，不能作为已冻结完成版本。

## 结论边界

在 CHG9-DREV-001~004 关闭前，当前实现与冻结设计不一致，CHG-009 不可冻结，也不能关闭 GAP-006。本轮未修改业务代码。

# CHG-009 并发补档后的增量设计复核

- 日期：2026-08-10
- Reviewer：`codex-independent-chg009-reviewer`
- 结论：`REJECTED`
- 复核对象仍为已声明发布标识：Git `86d348f4298444feb7c2081010442f4844b76bd0` / Worker `812bd26c-c683-4634-a0e2-ffad09cea9af`

## 增量结论

- `change-log.md`、`traceability.md` 与 DESIGN-005 §11.6 已补 CHG-009 的原因、影响面、回滚和规范化白名单，故首轮所述“完全未登记”已关闭。
- 但这些补档没有关闭 `CHG9-DREV-001~004` 的实现与审计门禁。尤其已发布 commit `86d348f` 的 Product artifact 未拒绝 required/forbidden 重叠；required filter 补 action 仍使用 `defaultValue`，可能等于 `allValue`；Engineering D1 artifact 仍只有 `summary/repaired`，没有 normalization 版本、路径/代码、补齐能力或实际派生 schema hash。因此 §11.6 所述“已验证 ProductBrief”“安全补齐”和可审计关系不能由该 commit/Worker 证明。
- 共享工作区中另有未提交的 `lib/ai-generator.ts`/`app/workspace.tsx` 修改，加入 `CAPABILITY_CONFLICT` 与 `normalizationCodes`。它们不属于 `86d348f`，也没有对应新 Worker，不能用于证明当前发布版本关闭阻塞；本复核未修改这些业务文件。

## 冻结条件

CHG-009 需以新的确切 commit/Worker 重新登记并验证：Product 能力集合可满足性预检；required filter 的非 all option、卡片分布与实际收窄不变量；规范化与补齐对 repair/source/attempt 的唯一语义；持久化的 normalization 版本/代码、completed capabilities、base/derived schema SHA。完成前维持 `CHANGE_PENDING_FREEZE`，设计不可 CONFIRMED。

# CHG-009 最终实现独立设计复核（第二轮）

- 日期：2026-08-10
- Reviewer：`codex-independent-chg009-reviewer`
- Production code SHA：`0085c134042f68ca7b2ac1a57d08f6d7e4b3b3fe`
- Worker：`8d3e1c98-888a-4072-bd06-788860cd59bf`
- 结论：`REJECTED`

## 已关闭

- `CHG9-DREV-001`：DESIGN-005 §11.3/11.6 已登记允许规范化白名单、repair/fallback 边界、`workers_ai/SUCCESS` 下的显式 normalized UI/审计语义，公共 `validateAppSpec` 仍保持严格。
- `CHG9-DREV-003`：实现将 required filter 定义为非 all action 且可见卡片数 `>0 && <cards.length`；不可收窄时进入 repair/fallback。线上 artifact 与浏览器证据均有真实子集变化。
- `CHG9-DREV-004`：Engineering artifact 已持久化 `normalizationVersion/codes/completedCapabilities/baseAppSpecSchemaSha/derivedEngineeringSchemaSha`。本地按生产对象重算 base=`bf11ff...bca8`、derived=`152d11...d708`，与固定 artifact 一致。
- `CHG9-DREV-002` 的 required/forbidden 同能力交集部分已关闭：Product 解析后立即以 `INVALID_PRODUCT_ARTIFACT/CAPABILITY_CONFLICT` 收敛，下游 AI 为零。

## 剩余阻塞

### CHG9-DREV2-001 — forbidden capability 未被服务端按结构边界二次执行

`checkCapabilities` 对 required 与 forbidden 共用 `abilityPresent`。该函数为了 required filter 的“真实可用”语义要求 set_filter 必须实际收窄，form 则要求 form 与 add_item 同时存在；因此 forbidden `filter` 可携带无效/不收窄的 set_filter 或 filter 组件，forbidden `form` 可携带 form 但不含 add_item，仍被判定为“能力不存在”。本轮直接使用生产 `generateAppWithAgents` 注入 Product `forbiddenCapabilities:["form"]` 与带 form、仅 show_toast 的 Engineering 响应，结果为 `calls=4, source=workers_ai, hasForm=true, failure=null`。这违反 §11.3“所有 forbidden 映射必须为假”、§11.6 派生 schema 删除 form/filter 的安全边界，也说明服务端二次校验仍依赖平台遵守动态 schema。

应将 forbidden 结构存在性与 required 可操作性拆成两个谓词：forbidden form 只要存在 form 或 add_item 即拒绝；forbidden filter 只要存在 filters 或 set_filter 即拒绝；toggle/toast/stats 同样按其明确结构拒绝。服务端必须对最终对象执行派生约束等价校验，不能只依赖 Workers AI `json_schema`。

### CHG9-DREV2-002 — 全部 action 能力 forbidden 时派生 schema 无解

对 `forbiddenCapabilities=[filter,form,toggle,toast]` 调用生产 `engineeringSchemaFor`，实测得到 `actions.minItems=1` 且 `actions.items.oneOf.length=0`。该 Product 没有 required/forbidden 交集，却产生不可满足 schema，并会被笼统降级而非在 Product 后以明确可满足性错误停止。应在 Product 校验中拒绝该组合，或给 AppSpec 定义合法的无 action 形态；同时增加下游 AI=0 的固定用例。

### CHG9-DREV2-003 — 技术设计仍保留冲突的 Engineering artifact 旧契约

DESIGN-005 §11.1 在新增完整 engineeringArtifact schema 前仍写“Engineering artifact 固定为 `{summary,repaired}`”，与紧随其后的八字段 required schema、当前实现和 D1 证据冲突。应删除旧句或改为完整权威字段引用，避免冻结后出现两个持久化契约。

## 结论边界

新 commit/Worker 已实质关闭上一轮四项中的三项及冲突交集子项，但 `CHG9-DREV2-001~003` 未关闭，CHG-009 仍不可重新冻结为 CONFIRMED。本轮未修改业务代码。
