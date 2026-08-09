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
