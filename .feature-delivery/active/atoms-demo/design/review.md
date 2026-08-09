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
