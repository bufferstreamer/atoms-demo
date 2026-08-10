# CHG-010 VibeTest 验收基线独立复核

- 日期：2026-08-10
- Reviewer：`codex-independent-chg010-acceptance-reviewer-r1`
- 结论：`REJECTED`
- 复核输入：`.vibetest/code-sandbox-generation/{rules.md,cases.md,evidence.md,gaps.md,skill-feedback.md}`、已冻结 `design/technical-design.md`、`implementation-plan.md`、`traceability.md`。本次只复核验收基线，未执行用例，也未修改验收方案或业务代码。

## 已确认的基线事实

- `VT-101~116` 共 16 条，`R101~R116` 共 16 条；当前全部保持 `PENDING/NOT_RUN`。`evidence.md` 的 Cases `0/0/16`、Rules `0/0/16` 和总体 `NOT_RUN` 与正文一致。
- `GAP-101~107` 均为 OPEN，`GAP-108/109` 仅作为显式 ACCEPTED_RISK；完成声明没有把设计冻结误写成实现、验收或发布完成。
- `SEM-01~10` 的精确 prompt、逐条断言与计分规则已直接写入 `cases.md`；runner 被要求从该文件解析并计算 SHA-256，acceptance freeze 将保护整个文件，因此实施后不能无痕移动基准。
- 用例已覆盖 CodeBundle/sentinel、安全 validator、iframe/CSP/bridge、Storage、owner/rate、旧 AppSpec、模型调用、终态原子性、deadline/迟到、UI、十条语义、迁移、工程构建、production 与回滚等主要风险面；现有故障注入、barrier、fake clock 和 D1 前后摘要方向正确。
- 线上证据明确要求新 CHG-010 deployment、同 production SHA、同 run 的 D1 join，并排除 pre-CHG-010 artifact，声明边界正确。

## 门禁阻塞项

### CHG10-AREV-001 — 冻结 trace/plan 的 VT 编号已与当前用例语义错位

- 定位：`traceability.md` 第 5~19 行；`implementation-plan.md` TASK-101~108；`cases.md` VT-101~116。
- 问题：当前 cases 已把 VT 编号定义为新的验收矩阵，但冻结追踪和计划仍含明显旧映射。例如 FR-001 工作台输入只映射到 VT-106，而当前 VT-106 是 owner/global 限流；FR-009 来源与失败 UI 映射 VT-106/109，而二者当前分别是限流和 D1 终态原子性；NFR-001 公网托管映射 VT-108/110/116，却漏掉真正的 production 全链路 VT-115；NFR-006 的 52/62/65 deadline 映射中没有 VT-110。FR-004/006、NFR-003/004/005 也分别漏掉 bridge/owner/deadline/audit 等直接用例。
- TASK 同样错位：TASK-104 Storage route 没有映射 owner/rate VT-106；TASK-105 UI 没有映射核心 UI VT-111；TASK-108 部署没有映射 production VT-115；TASK-102/103 的 deadline/background 职责没有稳定落到 VT-110。仅靠 TASK-106 的 `VT-101~116` 全包不能替代每个交付任务的完成定义。
- 修复建议：在受 acceptance hash 保护的 `cases.md` 增加正式 `FR/NFR -> DESIGN -> TASK -> VT -> RULE` 映射表，并逐项校正 `traceability.md` 与 implementation plan 的“验证 Case”。由于后二者已进入 design freeze，按冻结后变更控制更新并重记设计哈希；不能只在 review 或临时 addendum 中解释。

### CHG10-AREV-002 — 本地夹具、清理与线上 artifact 尚不足以由另一执行者复跑

- 定位：`cases.md` 第 3、43~61 行；`evidence.md` 第 16~38 行；VT-102/105/106/109/110/113/115。
- 问题：协议说明了注入 `AiRunner/Clock/BackgroundTasks/D1Adapter` 和“本地临时 D1 整体回收”，但没有固定 runner/adapter 入口、每组用例的命令、临时 DB 创建与 migration/seed 顺序、应回查的业务表集合、清理命令及“临时 DB 已删除”的验证。VT-109 所称“整库业务表摘要”也没有列出 `projects/runs/steps/versions/messages/generation_events/workspace_requests/run_deadline_audit/app_state/storage_rate_events` 等权威集合，换一个执行者可能得到不同 diff 边界。
- 线上侧只写 `artifacts/` 与 `chg010-vt-*`，没有固定 artifact 文件名/manifest schema。必须固定至少 production code SHA、Worker version、deployment time、case/SEM hash、owner session labels、requestId/runId/projectId/versionId、模型/source/outcome、API monotonic duration、D1 join 摘要、browser artifact、执行命令和采集时间；否则旧 artifact 排除仍依赖人工判断。既然线上测试项目明确不删除，还需规定 retention/台账和容量影响，避免重复执行无界积累且无法定位本次 fixture。
- 修复建议：在 cases 的通用执行协议中固定可实现后的脚本入口与参数合同、临时 D1 生命周期和逐表回查/清理断言；为 VT-112/115/116 指定唯一 artifact 路径及必填字段/hash，线上 fixture 建立 manifest/保留策略。evidence 的“计划工具/命令”应引用这些稳定入口，而不是只写工具类别。

### CHG10-AREV-003 — 新增 background audit 失败契约没有对应负向用例

- 定位：DESIGN-109 第 142~145、239~240 行；CONTRACT-102/106；TASK-103/106；RULE R110/R111；VT-109/110。
- 问题：冻结设计规定 `terminalPromise.finally` 的 audit-only UPDATE 失败必须形成 evidence GAP 并阻塞发布，也规定生产缺少 `BackgroundTasks.waitUntil` 时要在 AI/写入前返回 503。VT-109 只注入 terminal/failure batch statement 与 commit 失败；VT-110 只验证正常的 finally 后四 flags，没有注入 audit-only UPDATE 失败、幂等重放/重试以及 GAP 生成，也没有覆盖 BackgroundTasks 缺失分支。因此实现可以漏掉审计 finalize 或在缺 scheduler 时已调用 AI，现有用例仍可能全绿。
- 修复建议：扩充 VT-110（或新增稳定 case）：注入 audit UPDATE 首次失败/重放成功，断言业务 READY/FAILED、version/event/pointer 不反改，audit gap 保持 OPEN 直到同 run 四字段回查完成；注入 BackgroundTasks unavailable，断言 503、AI calls=0、无 reserve/execute 新 mutation。evidence/gaps 必须有对应 Case/Rule 和关闭条件。

## 最终结论

`REJECTED`

当前矩阵覆盖面较完整，SEM 基准、NOT_RUN 统计、gap 和完成声明也保持诚实；但冻结追踪/任务到 VT 的语义映射尚未闭环，执行夹具与在线证据没有达到独立复跑所需的固定合同，且 DESIGN-109 新增的 background audit 失败路径缺少验收。关闭 `CHG10-AREV-001~003` 前，不应进入 `ACCEPTANCE_FROZEN`。

---

# CHG-010 VibeTest 验收基线第二轮独立复核

- 日期：2026-08-10
- Reviewer：`codex-independent-chg010-acceptance-reviewer-r2`
- 结论：`CONFIRMED`
- 复核输入：当前 `.vibetest/code-sandbox-generation/{rules.md,cases.md,evidence.md,gaps.md,skill-feedback.md}`、重新冻结的 `design/technical-design.md`、`implementation-plan.md`、`traceability.md`、freeze/change-log 记录及 R1 findings。未执行用例，未修改验收方案或业务代码。

## AREV-001~003 关闭检查

| R1 Finding | R2 结论 | 依据 |
| --- | --- | --- |
| CHG10-AREV-001 | 已关闭 | `traceability.md` 已按当前 VT-101~116 语义重新建立 FR/NFR→DESIGN/TASK→VT 映射：工作台落到 VT-101/111/115，Storage 落到 VT-104/105/106/115，失败/deadline 落到 VT-108/109/110/111，hosting 落到 VT-114/115/116，NFR-006 落到 VT-110/112/115。implementation plan 同步修正 TASK-101~108 的验证 Case，尤其 TASK-104→VT-104/105/106、TASK-105→VT-111、TASK-108→VT-115/116。scope/design 已重新冻结，当前 trace/plan SHA 与 `feature.yaml` 记录一致。 |
| CHG10-AREV-002 | 已关闭 | `cases.md` 已固定未来唯一 runner `scripts/vt-chg010.ts` 及 case/environment/artifact 参数合同；local 使用 runner 自建 `/private/tmp/atoms-chg010-vt-*`，清理前执行 realpath/prefix/lstat/non-symlink/manifest count 校验，清理后回查路径不存在。fixture manifest 固定 ID、commit、环境、Worker、case/owner alias/request/run/project/version/artifact hash 与 local removed/online retained 状态；线上保留数据以可查询前缀建台账。local、production API/D1、browser 三类 artifact 均有固定文件名、必填身份/hash/result 字段，旧 commit/旧命名/缺字段证据不能关闭 case。 |
| CHG10-AREV-003 | 已关闭 | VT-110 现明确注入 `BackgroundTasks=null`，断言 AI 前 503、AI counter=0、execute 新业务写=0；另注入 audit-only finalizer 首次 UPDATE 失败，断言 READY/FAILED 业务终态与业务 hash 不变、waitUntil error 可观察，同 run 幂等重试只补齐四 flags且不新增 version/event/message。持续失败时 VT-110 FAIL，新增 P0 `GAP-110` 保持 OPEN 并阻塞发布。 |

## 整体一致性复查

- VT-101~116 与 R101~116 仍各 16 条，全部保持 PENDING/NOT_RUN；`evidence.md` 的 Cases `0/0/16`、Rules `0/0/16` 和总体 `NOT_RUN` 未被评审修订误标为 PASS。
- `GAP-101~107` 与新增 `GAP-110` 均为 OPEN；发布边界要求全部关闭，GAP-108/109 继续只作为显式 ACCEPTED_RISK。
- SEM-01~10 的精确文本、顺序、断言、9/10 与 counter 2/2/至少一次 Qwen SUCCESS 规则仍位于 `cases.md`；runner 必须从该文件解析并保存 inputs hash，acceptance freeze 可保护基准不漂移。
- local fixture 不触碰既有 D1，线上 fixture 不执行破坏性清理并由 manifest 保留；Cookie/ownerKey/token 不入 artifact。线上证据仍绑定新 CHG-010 commit、Worker version、同 run D1 join，pre-CHG-010 evidence 不能冒充。
- fault injection、D1 逐表/业务 hash、barrier、fake clock、waitUntil、202 FINALIZING、owner 双会话、migration、browser 与 rollback 的组合能够覆盖冻结设计的正常、失败、并发、迟到、安全、兼容和发布路径；本轮未发现新增门禁级冲突。

## 最终结论

`CONFIRMED`

`CHG10-AREV-001~003` 已全部关闭。当前材料满足高风险验收基线冻结条件，可以进入 `ACCEPTANCE_FROZEN`；该结论仅确认规则、用例、可重复执行协议、证据占位和 gap 边界完整，不代表任何 VT 已运行、实现已完成或线上发布已通过。
