# CHG-010 Code Sandbox Generation 独立设计复核

- 日期：2026-08-10
- Reviewer：`codex-independent-chg010-design-reviewer-r1`
- 结论：`REJECTED`
- 复核边界：冻结 `reference/prd.md`、`scope.md`、`open-questions.md`、`traceability.md`，当前 `design/technical-design.md`、`implementation-plan.md`，以及现有业务代码和 D1 schema。未接受主 Agent 预期结论，未修改业务代码或方案正文。

## 已确认的设计基础

- `CodeBundle v1` 已固定 artifact kind、三个文件名、entry、字段长度与分文件/总字节上限；Qwen 使用 plain-text sentinel，三个规划阶段使用 Llama `json_object` 加服务端 canonical schema 二次校验，模型能力没有被当作安全边界。
- 旧 `app_spec_json` 保留列名、增加 `artifact_kind DEFAULT 'app_spec'`、联合 reader、未知/损坏 artifact 拒绝送入 DOM，以及“存在 code_bundle 后禁止回滚到旧 reader”的方向正确，符合 S012 兼容决定。
- sandbox 仅 `allow-scripts`、opaque origin、`default-src 'none'`、`form-action 'none'`、无 same-origin/forms/popups/downloads/top-navigation，并明确保留恶意 CPU/内存残余风险，边界方向合理。
- D1 作为 project/version/run/audit 与应用状态事实源、owner 仅由服务端恢复、失败不移动 current pointer、Qwen 真实成功和旧版本在线回归作为发布门禁，均与冻结范围一致。

## 阻塞项

### CHG10-DREV-001 — deterministic 最终结果语义与冻结 PRD 冲突

- 定位：PRD 3 节第 32 行；DESIGN-103（technical-design 第 11 行）、失败收敛第 162 行、DESIGN-111 第 227 行；TASK-102。
- 问题：冻结 PRD 明确只允许 `workers_ai/SUCCESS`、`deterministic/SUCCESS` 或失败终态；计数器编译器却被定义为 `source=deterministic,outcome=FALLBACK`。这不是展示措辞差异，而是 generation event、UI、验收断言共同依赖的持久化枚举冲突。规划阶段 deterministic fallback + Qwen 成功的最终 source 已说明为 Qwen，但计数器终态没有与产品契约一致。
- 修复建议：通过冻结后变更明确二选一：将 PRD/trace/验收统一允许透明的 `deterministic/FALLBACK`；或将计数器编译器定义为 `deterministic/SUCCESS` 并用独立字段记录触发它的真实 Qwen failure。同步 CONTRACT-106、UI 文案、generation event 和 VT 断言。

### CHG10-DREV-002 — 新增非终态留下并发、base guard 与激活窗口

- 定位：主链路第 152~165 行；schema 第 192~196 行；CONTRACT-101/102；TASK-103；现有 `lib/store.ts` 第 13~14、257~264、298~313、341~367、376 行。
- 问题：方案把 active run 扩为 `RUNNING/COMPLETING/FAILING`，但只要求 busy 查询与 stale recovery 覆盖三态，没有要求替换现有 `runs_project_running_idx WHERE status='RUNNING'`。旧 run 一转 `COMPLETING`，并发 reserve 可在“查询后插入”的竞态中创建第二个 RUNNING。版本激活也只在现代码中排除 RUNNING。另 completion 只写“token 原子”，没有把 `baseVersionId/currentVersionId` 的 null-safe guard、owner/project guard及其失败终态写入新 COMPLETING batch 契约；reserve 时检查不能替代落库时再次检查。
- 修复建议：明确可重复迁移为覆盖全部非终态的 partial unique index，例如 `WHERE status IN ('RUNNING','COMPLETING','FAILING')`，并要求 reserve、activate、stale recovery 使用同一 `ACTIVE_RUN_STATUSES`。定义 `RUNNING -> COMPLETING` claim 及 completion batch 的 `run_id + attempt_token + status=COMPLETING + project owner + current_version_id IS/=` null-safe guard；0 changes 必须整体不产 version/event/message/pointer 并进入可回查终态。VT 必须覆盖 transition 窗口并发 reserve/activate。

### CHG10-DREV-003 — 52/62/65 秒只有预算数字，没有可执行截止协议

- 定位：模型预算第 114~122 行；失败收敛第 163~165 行；OQ-005；TASK-102/103/106。
- 问题：6+7+6+26+7 恰好占满 52 秒，方案虽说每次调用裁剪 remaining，却没有定义单一 monotonic `t0`、模型调用/repair 启动的边界条件、62 秒时正在执行的 completion/failure batch 如何失效、D1 Promise 超时后的迟到提交如何与 failure claim 竞争，以及最晚何时回查终态并在 65 秒内返回。120 秒读取回收不能替代同一 HTTP 请求的 65 秒收敛。
- 修复建议：给出 `modelDeadline=t0+52s`、`persistenceDeadline=t0+62s`、`responseDeadline=t0+65s` 的 monotonic 算法；所有 AI timeout 为 `min(stage, modelDeadline-now)`，不足最小预算不启动 repair。明确 62 秒超时后的 token/status 失效或胜者判定、completion 与 failure 两条 batch 的互斥 guard、最晚 64.5 秒终态回查和响应余量；fake clock 覆盖 51.999/52、61.999/62、64.5/65 与迟到 AI/D1。

### CHG10-DREV-004 — CodeBundle 与 srcdoc 拼装尚未形成无歧义安全契约

- 定位：CodeBundle 第 45~86 行；sandbox 第 209~223 行；CONTRACT-103/104；TASK-101/105。
- 问题：sentinel 只给示例，没有固定 UTF-8/LF、marker 必须整行、meta 区间和 marker 出现在文件正文时的精确拒绝规则；“跨文件/安全校验”也未定义 `capabilities.storage=true/false` 与 `Atoms.storage` 调用的一致性。更严重的是，方案只说依次注入 CSS/HTML/JS：若实现为 `<style>${css}</style>`、`<script>${js}</script>`，通过当前列举规则的 `</style>`/`</script>` raw-text 终止序列可突破受信 wrapper 拼装边界。sandbox 仍限制外部能力，但冻结 bridge、注入顺序和错误处理不再可信。
- 修复建议：定义 sentinel 的完整 grammar 和 parser 状态机，marker 只允许精确独占行且正文出现 marker 即拒绝；定义 capability/storage 与跨文件引用校验。srcdoc 必须使用不会让生成文本进入 HTML raw-text 语境的固定编码方案，例如把 JSON 编码且转义 `<` 的字符串交给受信 bootstrap，再以 `textContent` 创建 style/script、以已验证 fragment 注入 HTML；同时验证 `</script`、`</style`、Unicode line separator、marker-in-string、NUL 与 48 KiB 边界。

### CHG10-DREV-005 — Storage bridge/API 与原子限流仍不足以直接实现

- 定位：CONTRACT-104/105 第 174~175 行；storage 第 198~205 行；sandbox 第 209~222 行；TASK-104；现有 `lib/store.ts` 第 108~120 行。
- 问题：所谓 exact message 没有给出 request/response envelope 的 `type/channelToken/requestId/op/key/value/error` 精确联合类型；Storage API 也没有固定 HTTP method、path/query/body 与各 op 响应。`__atoms.` 是“保留给系统”还是“允许 guest 使用”语义不清。set 的 guarded SQL 虽覆盖 count/bytes，却未明确在同一 `INSERT ... SELECT` 内用 `projects(id,owner_key)` 授权，错误 owner 可能写出 orphan state。owner/global rate 只给数值；当前实现是先读 count 再递增，存在并发越限，设计没有要求改为 guarded atomic increment，也没有定义 `storage_write` action 和 rate 拒绝时不执行 state mutation的顺序。
- 修复建议：内联 RPC discriminated union 和 API method/body/response/error 表；明确 guest 禁止 `__atoms.`。给出 set SQL 必备谓词：同语句 project-owner EXISTS、替换后 key count、`SUM(value_bytes)-old+new`，并回查 changes=0 的稳定优先级。新增 `storage_write` rate action，owner/global 均使用 `UPDATE/UPSERT ... WHERE count < limit` 原子 claim，两个 claim 成功后才执行 mutation；补同 owner 并发、跨 owner、49→50→51 key、8192/8193 bytes、替换缩容和全局边界用例。

### CHG10-DREV-006 — deterministic planning 与 counter compiler 仍是未定义算法，10-prompt gate 可移动

- 定位：规划阶段第 88~110 行；失败收敛第 162 行；DESIGN-111 第 225~229 行；TASK-101/102/106；PRD 第 37、78~80 行。
- 问题：三个 canonical model schema 完整，但 planning 模型失败后的 bounded deterministic artifact 没有给出各阶段固定 schema 对象、prompt 派生规则和验证步骤，无法证明它仍保持用户语义。counter compiler 只说同时匹配“计数器/数字、加、减、重置”，未定义中英文 token、否定句、初始值范围、标题/persistence parser、默认值及误命中规则。所谓“固定 10 条”目前只有五个类别，没有 fixture ID、精确 prompt、期望控件/storage/source 与冻结 hash，实施后可通过改 prompt 降低门槛。
- 修复建议：为三个 deterministic planning stage 给出合法 canonical artifact 构造器与相同 validator 路径；为 counter intent/parser 写明确语法、range/default/negative examples。将 10 条 prompt 和逐条 semantic/browser/source 断言固定在 acceptance cases，设计引用稳定 ID/hash；计数器 2/2、至少一条 Qwen SUCCESS 与总计 9/10 的计算规则不可在执行后修改。

### CHG10-DREV-007 — DESIGN/TASK/trace 追踪存在未定义 ID 和责任漏映射

- 定位：technical-design 全文；implementation-plan 第 8、25~32 行；traceability 第 5~19 行；feature.yaml scope freeze。
- 问题：方案正式定义 DESIGN-101~108，后文出现 DESIGN-111，但没有 DESIGN-109、DESIGN-110；实施计划却声称输入为 DESIGN-101~111，trace 的 NFR-002/NFR-006 又映射不存在的 DESIGN-109。TASK-101 实际承担 counter compiler 却只映射 DESIGN-102，未映射 DESIGN-111；TASK-103 承担 completion/failure/迟到一致性，却未映射 FR-002/006 或对应状态设计，trace 的 FR-006 也漏掉 TASK-103。所有 trace 状态仍写 `SCOPE_DRAFT`，PRD header 仍是 `DRAFT_FOR_SCOPE_REVIEW`，与 feature.yaml 已 `SCOPE_FROZEN` 的当前事实不一致。
- 修复建议：补齐或删除 DESIGN-109/110，并为 deadline/evidence/状态事务建立实际 DESIGN ID；同步 TASK-101/102/103 与 FR-002/006/008、DESIGN-111、completion/failure contract 的双向映射。通过冻结后变更流程更新 stale 状态标签和 trace，重新记录 scope hash 后再申请 design freeze。

## 结论

`REJECTED`

当前设计具备正确的总体方向，但 `CHG10-DREV-001~007` 涉及冻结产品语义、并发唯一性、deadline/迟到写、srcdoc 注入、owner/rate 原子性、语义 fallback 和端到端追踪，均会直接改变实现与验收结果。在这些问题关闭前，不应进入 `DESIGN_FROZEN` 或业务实现。

---

# CHG-010 第二轮独立设计复核

- 日期：2026-08-10
- Reviewer：`codex-independent-chg010-design-reviewer-r2`
- 结论：`REJECTED`
- 复核输入：当前 `design/technical-design.md`、`implementation-plan.md`、`traceability.md`、已重新冻结的 `reference/prd.md`、`change-log.md`。只验证设计与冻结基线闭环，不以主 Agent 预期结论代替协议检查。

## 首轮 finding 关闭检查

| 首轮 Finding | 第二轮结论 | 依据 |
| --- | --- | --- |
| CHG10-DREV-001 | 已关闭 | PRD、DESIGN-111、generation event 与 UI 已统一为 counter compiler `deterministic/SUCCESS`，真实 Qwen 失败放入 `fallback_reason`，不再使用 `FALLBACK`。 |
| CHG10-DREV-002 | 已关闭 | DESIGN-110 定义统一 `ACTIVE_RUN_STATUSES`、三态 partial unique index、owner/token/lease/null-safe current-base completion guard、active activate guard及迁移冲突收敛；TASK-103/VT 已承接。 |
| CHG10-DREV-003 | 部分关闭 | 已增加 monotonic `t0`、52/62/65 截止、lease/watchdog/fake-clock 边界，但存在下述 DREV2-002 的互斥行为与审计字段冲突。 |
| CHG10-DREV-004 | 已关闭 | sentinel 已固定 UTF-8/LF/marker/meta/body grammar、storage capability 一致性及边界测试；srcdoc 改为只让 base64 generated bytes 进入 trusted wrapper，再用 `textContent`/validated fragment 注入。 |
| CHG10-DREV-005 | 已关闭 | CONTRACT-104/105 已给 exact RPC union、固定 POST API/响应/错误；set 同语句 owner/count/bytes guard，storage rate 使用单条 conditional event insert，边界用例已进入 TASK-104/106。 |
| CHG10-DREV-006 | 部分关闭 | 三阶段 deterministic 构造、counter grammar 与 SEM-01~10 已冻结，但构造字段和 counter token 仍有下述 DREV2-003 问题。 |
| CHG10-DREV-007 | 已关闭 | DESIGN-109/110/111 已正式定义；TASK-101~108 与 FR/NFR/Contract/VT 映射补齐；trace 与 PRD 状态已更新为 `SCOPE_FROZEN`，change-log 和二次 scope freeze 有记录。 |

## 剩余与新增阻塞项

### CHG10-DREV2-001 — 冻结 PRD 的模型调用数与设计不一致

- 定位：PRD 第 37 行；technical-design 第 99~139、163~175 行；TASK-102。
- 问题：已重新冻结的 PRD 仍写“一个规划调用、一个代码生成调用、必要时一次 repair”，但设计明确依次执行 Product、Architecture、Design 三个独立 Llama 调用，再执行 Qwen Engineering，必要时 Qwen repair。这里不是 Agent 角色展示，而是三次实际 `env.AI.run`、三段 timeout/usage/rate/capacity，影响 NFR-006 与免费额度。
- 修复建议：冻结后变更明确 PRD 是“一个规划阶段内三个串行模型调用”还是确实只允许单次 planner；然后统一技术时序、模型调用计数、usage 审计、计划和 VT spy 断言，并再次记录 scope hash。

### CHG10-DREV2-002 — deadline 协议仍无法在 D1 慢调用时同时满足自身规则

- 定位：DESIGN-109 technical-design 第 141~147 行；schema 第 241~247 行；可观测第 315~318 行；TASK-102/103/106。
- 问题：第 145 行规定 D1 atomic batch 一旦开始就“必须等待唯一 batch 的真实结果并回读一次”，第 146 行又规定 65 秒后返回当前终态或 `PERSISTENCE_TIMEOUT`。若唯一 completion/failure batch 在 62 秒前已开始、到 65 秒仍未返回，执行器既不能取消/并发写，又不可能同时等待真实结果并按时返回。若先返回 timeout、未 await 的 batch 之后提交，API 表意和实际终态还会分离。另第 316 行要求 generation event 保存“四个 deadline/lease 超界布尔值”，schema 第 242 行只定义 `persistence_deadline_exceeded` 与 `response_budget_exceeded` 两个字段，没有另外两个字段的名称、计算或兼容默认值。
- 修复建议：定义单一可实现的慢 D1 分支：例如明确已启动 terminal batch 时响应可转为 `202/PERSISTENCE_PENDING` 并由 UI 轮询，而不是声明终态失败；或明确必须等待且该请求允许超过 65 秒、从而相应调整 NFR/VT。列出所有 deadline/lease 审计字段及唯一计算点；completion/failure/event/readback 的 fake runner 必须覆盖 batch 在 61.9 秒开始、64.5/65 秒后才返回的情形。

### CHG10-DREV2-003 — deterministic 构造器按文档生成的对象不满足 canonical schema

- 定位：canonical schema 第 103~129 行；counter grammar 第 281~292 行；TASK-101/102/106。
- 问题：Product、Architecture、Design 的 canonical schema 都必填 `schemaVersion` 且 `const:1`，但第 125~129 行列出的三个“固定纯函数”输出字段均遗漏 `schemaVersion:1`。方案又要求构造结果必须经过同一 canonical parser，因此按当前逐字段说明实现会稳定失败，无法完成 planning fallback。
- 新冲突：counter decrement token 包含裸 `-1`，而初始值 grammar 允许 `starting at -1`。例如 “Build a counter starting at -1 with increment and reset” 会因初始值文本中的 `-1` 被误认为 decrement 意图，错误进入 compiler 并生成用户未要求的减法按钮。
- 修复建议：三个 deterministic artifact 明确包含 `schemaVersion:1` 并给完整 golden object。action token 必须做边界/上下文解析，不能把 initial-value capture 区间内的 `-1` 当 decrement；增加该例、否定窗口边界和复合需求为 compiler negative tests。

### CHG10-DREV2-004 — 冻结 PRD 再次把 `default-src` 外推成导航策略

- 定位：PRD NFR-003 第 63 行；technical-design CSP/sandbox 第 260~275 行；已确认来源 S009 的 `default-src` 边界。
- 问题：PRD 写“CSP 默认拒绝网络、导航、外链脚本和对象”，但当前 CSP policy 没有也不依赖 `default-src` 拒绝顶层导航；设计实际通过 iframe 缺少 top-navigation token 来限制导航，并用 `form-action 'none'` 限制表单。该措辞重新引入 source review 已排除的 `default-src = navigation policy` 外推，会让安全验收错误地只检查 CSP。
- 修复建议：把冻结产品规则改为“sandbox 拒绝顶层导航；CSP `default-src`/fetch directives 拒绝网络与外链资源；`form-action 'none'` 拒绝表单外发”，并让 VT 分别验证 sandbox token、CSP fetch 与 form-action，不能用一个断言代替三层边界。

## 最终结论

`REJECTED`

首轮七项中五项已完整关闭、两项主体已补强，但 `CHG10-DREV2-001~004` 仍影响冻结产品契约、HTTP 终态语义、deterministic fallback 可运行性与沙箱安全验收。关闭并重新同步冻结哈希前，不能进入 `DESIGN_FROZEN`。

---

# CHG-010 第三轮独立设计定点复核

- 日期：2026-08-10
- Reviewer：`codex-independent-chg010-design-reviewer-r3`
- 结论：`REJECTED`
- 复核输入：当前 `design/technical-design.md`、`implementation-plan.md`、`traceability.md`、再次冻结的 `reference/prd.md`、`change-log.md` 与 scope freeze 记录。仅复核设计门禁，不修改方案或业务代码。

## DREV2-001~004 关闭检查

| 第二轮 Finding | 第三轮结论 | 依据 |
| --- | --- | --- |
| CHG10-DREV2-001 | 已关闭 | PRD 第 37 行、DESIGN-103/3.3/3.4、主时序与 TASK-102 已统一为一次 combined Llama planning、一次 Qwen Engineering、最多一次 Qwen repair；三个 planning step 通过同一 `shared_call_id` 表示一次真实调用。 |
| CHG10-DREV2-002 | 原问题已关闭 | DESIGN-109 已定义唯一 `terminalPromise`、64.5 秒 pending 时交给 Vinext `ExecutionContext.waitUntil` 并返回同 run 的 202、UI 继续轮询且不重启 AI；schema 已列出 `model_deadline_exceeded/persistence_deadline_exceeded/response_budget_exceeded/lease_expired` 四字段。但该新协议仍有下述 DREV3-001~003 的可实现性冲突。 |
| CHG10-DREV2-003 | 已关闭 | 三个 deterministic artifact 均明确 `schemaVersion=1`；counter compiler 先从 action 匹配副本删除初始值片段，裸 `-1` 只在剩余 `actionText` 中算 decrement，并固定冲突/越界拒绝规则。 |
| CHG10-DREV2-004 | 已关闭 | 再冻结 PRD NFR-003 已区分 sandbox top-navigation 权限、CSP 网络/外链资源限制以及 `form-action/base-uri`，不再把 `default-src` 单独外推成导航策略；当前 PRD/trace SHA 与 freeze 记录一致。 |

## 新增门禁阻塞

### CHG10-DREV3-001 — 61.5 秒 watchdog 无法保证两段 D1 操作在 62 秒前完成启动协议

- 定位：DESIGN-109 第 142 行；失败收敛第 185~187 行；TASK-103/106；NFR-006。
- 问题：方案要求 watchdog 在 `t0+61.5s` 先以 D1 guarded claim 抢占 `RUNNING -> FAILING`，随后在 62 秒前启动 failure batch，仅留下 500ms。当前文字和 completion 路径都把 claim 与 terminal batch 描述为两次 D1 操作；第一步只要慢于 500ms，第二步便只能在租约过期后启动，与“terminal batch 必须在 62 秒前开始”矛盾。fake clock 的纯时间边界不能证明真实异步 claim 延迟下仍成立。
- 修复建议：将 watchdog 的 `RUNNING -> FAILING` claim 与全部 failure mutations 明确合并为同一个原子 D1 batch，并规定该 batch 第一条语句的 token/owner/base/lease guard、后续语句如何读取同事务内 `FAILING`；或把 watchdog 提前到能覆盖一次已定义的 D1 上限。VT 必须注入 claim 延迟 499/500/501ms 与 61.5~62s 边界，回查 run/request/steps/version/event/pointer。

### CHG10-DREV3-002 — 两个事后 deadline 字段无法按当前原子事件协议落库

- 定位：DESIGN-109 第 143~145 行；completion 原子 batch 第 186 行；schema 第 238~241 行；CONTRACT-106；TASK-102/103/106。
- 问题：`persistence_deadline_exceeded` 只有在 `terminalPromise` 于 62 秒后完成时才能确定，`response_budget_exceeded` 只有在 64.5 秒后仍未完成回读时才能确定；但 `generation_event` 又必须与 version/message/pointer/run/request/steps 在 terminal batch 内同成同败。batch 在两个结果已知前已构造并启动，不能在同一原子事件中写入事后真值。方案也没有定义后台 promise 完成后的第二次 audit update、其 guard、失败恢复或 evidence 如何识别缺失值，因此四字段虽已建模，慢 D1 分支仍无法产生可信审计。
- 修复建议：明确唯一可执行的观测模型，例如 terminal batch 原子保存 `terminal_started_at/terminal_committed_at`，另用 append-only response observation 保存 `response_returned_at/status` 并由证据确定性计算超界；若保留 event 布尔字段，则定义 terminalPromise 链中的 token/run-guarded audit finalize、幂等键、失败重试和读取回收，并说明它不改变业务终态。VT 覆盖 batch 在 61.9 秒启动、62/64.5/65 秒后完成及 audit finalize 失败。

### CHG10-DREV3-003 — 202 响应的公共 `ProjectSnapshot` 与内部 run status 契约冲突

- 定位：DESIGN-109 第 144~145 行；时序第 176 行；CONTRACT-101/102 第 194~195 行；PRD 第 27~30、66 行；TASK-105/106。
- 问题：CONTRACT-102 规定 terminal pending 返回“202 active `ProjectSnapshot` + `retryAfterMs`”，reserve 的公开快照状态是 `BUILDING`；但 DESIGN-109 的具体 JSON 又把同名 `status` 写成内部 run 状态 `COMPLETING|FAILING`。文档没有定义 `ProjectSnapshot.status` 的联合、独立 `runStatus` 字段或旧 UI 的兼容映射。实现者可能扩展公开 project status，也可能继续返回 BUILDING，导致 UI 停止条件、刷新恢复及幂等重放断言不唯一。
- 修复建议：固定完整 202 JSON schema。建议公开 `ProjectSnapshot.status` 继续为 `BUILDING`，另加可选 `runStatus: "COMPLETING"|"FAILING"` 与 `runId/requestId/retryAfterMs`；或者正式扩展公共 status union 并同步所有旧 reader。TASK-105/106 和 VT 应覆盖首次 202、刷新/重放同 requestId、多次 pending 202、最终 READY/FAILED以及不重复调用 AI。

## 最终结论

`REJECTED`

`CHG10-DREV2-001~004` 的原始问题均已关闭，scope 重新冻结记录也与当前 PRD/trace 哈希一致；但新引入的后台 terminalPromise 协议在 watchdog 两段 D1 时序、事后审计字段原子性和 202 公共响应 shape 上仍没有唯一可实现契约。关闭 `CHG10-DREV3-001~003` 前不能进入 `DESIGN_FROZEN`。

---

# CHG-010 第四轮独立设计定点复核

- 日期：2026-08-10
- Reviewer：`codex-independent-chg010-design-reviewer-r4`
- 结论：`CONFIRMED`
- 复核输入：当前 `design/technical-design.md`、`implementation-plan.md`、`traceability.md`、冻结 `reference/prd.md`、`change-log.md` 及前三轮 findings。仅复核设计门禁，未修改方案或业务代码。

## DREV3-001~003 关闭检查

| 第三轮 Finding | 第四轮结论 | 依据 |
| --- | --- | --- |
| CHG10-DREV3-001 | 已关闭 | DESIGN-109 将 watchdog 提前至 `t0+60000ms`，并明确唯一 `timeoutFailureBatch` 在同一个 D1 atomic batch 内以 token/lease guard 完成 `RUNNING -> FAILING -> FAILED` 及 request/steps/project 收敛，不再先 claim 后另起 batch；若 completion 已取得 `COMPLETING` 或已有 terminalPromise，则 changes=0，不形成第二个终态写入者。该协议与 `ACTIVE_RUN_STATUSES`、completion 单胜者及迟到 token guard 一致。 |
| CHG10-DREV3-002 | 已关闭 | `generation_events` 恢复为只承载 terminal batch 当时已知且必须与业务结果原子的生成事实；四个 deadline/lease 观测及绝对截止点迁入 `run_deadline_audit`。terminal batch 原子插入初值，`terminalPromise.finally` 在同一 waitUntil 链中按 run_id 幂等执行 audit-only update；更新失败只阻塞证据/发布，不反改 READY/FAILED、version、event 或 pointer，消除了事后值与业务原子 batch 的矛盾。 |
| CHG10-DREV3-003 | 已关闭 | DESIGN-109 与 CONTRACT-102 已固定 terminal pending 的 exact 202 外形：`project.status=BUILDING`，`run.publicStatus=FINALIZING`，并携带同 run 与 `retryAfterMs`；内部 `COMPLETING/FAILING` 明确永不进入公共 schema。UI 轮询同一 run、幂等重放不再次调用 AI，最终只收敛 READY/FAILED。 |

## 整体一致性检查

- 52/62/65 秒仍使用同一 monotonic `t0`；模型结果、terminal batch 启动、64.5 秒 202 与 65 秒响应边界没有被本轮修订放宽。
- completion、普通 failure、60 秒 timeout failure 和 expired-lease recovery 均受同一 run/token/lease/owner/base/status 事实约束；只有已启动的唯一 terminalPromise 可在响应后继续，迟到 AI 或旧 token 仍不能插入版本、事件、消息或移动 current pointer。
- `run_deadline_audit` 是加性、按 run 唯一的审计表，CONTRACT-106、TASK-102/103/106、NFR-004/006 与 trace 的职责仍闭合；审计 finalize 失败被明确保留为发布 GAP，不会被误报为业务成功证据完整。
- 公共 ProjectSnapshot 保持既有 BUILDING/READY/FAILED 兼容语义；新增 FINALIZING 只位于嵌套 run public status，不污染 D1 内部状态或旧 AppSpec reader。
- 前轮已确认的单次 combined planning、单次 Qwen/最多一次 repair、deterministic schema/counter grammar、sandbox/CSP、storage/owner/capacity、旧 AppSpec/版本兼容与 DESIGN/TASK/trace 映射未被本轮修改破坏。

## 最终结论

`CONFIRMED`

`CHG10-DREV3-001~003` 已全部关闭，未发现本轮协议引入新的门禁级冲突。就当前独立设计复核范围，材料可以进入 `DESIGN_FROZEN` 门禁；该结论仅表示设计基线可冻结，不代表业务代码已实现、VibeTest 已通过或线上模型/发布证据已完成。
