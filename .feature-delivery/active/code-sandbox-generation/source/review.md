# CHG-010 Code Sandbox Generation - 来源覆盖独立复核

## 复核输入

- 来源清单：`source/register.yaml`
- 结构单元：`source/units.jsonl`
- 语义覆盖：`source/coverage.yaml`

## 来源全集检查

记录是否缺少 PRD、原型、当前 UI、代码/配置、上下游契约、非功能要求或评审结论。

## 单元与语义检查

记录未拆分条件、例外、枚举值、隐藏交互、失败路径及不合理的 `OUT`/`NO_REQUIREMENT`。

## 差异与处置

| Finding | 来源位置 | 影响 | 处置 | 状态 |
| --- | --- | --- | --- | --- |

## 结论

`OPEN`

# CHG-010 Code Sandbox Generation 独立来源覆盖复核

- 日期：2026-08-10
- Reviewer：`codex-independent-chg010-source-reviewer`
- 结论：`REJECTED`
- 输入边界：仅复核 `source/register.yaml`、`source/units.jsonl`、`source/coverage.yaml` 与 register 登记的 7 份原始快照；未采用既有 review 或主 Agent 预期结论。

## 已确认

- 7 份快照均存在且逐文件 SHA-256 与 register 一致；register 的 unit_count 合计 135，与 units 实际 135 行一致。
- coverage 含 135 个 unit，未缺 unit，135 个 content hash 全部与 units 一致；105 个 ATOMIZED、30 个 NO_REQUIREMENT，没有结构性漏行。
- 用户反馈、生产计数器失败样本、64% deterministic fallback、当前 AppSpec/规则降级边界、D1 既有数据链与 Workers AI 绑定事实均有原文。
- “不再返回与需求无关的固定看板”有 S002-U0004、S003-U0013~15、S004-U0013~14 的需求/事实链；计数器 `+1/-1/重置/刷新恢复` 有 S002-U0015 的直接用户来源。两项主题本身未遗漏。
- “AI 生成任意”已由 S002-U0013~14 限定为隔离环境内纯前端 HTML/CSS/JavaScript，明确排除服务端任意命令、任意依赖安装与平台密钥获取；但该意图边界尚未被下述平台事实闭环。

## 阻塞项

### CHG10-SREV-001 — 来源全集缺少沙箱执行与安全平台契约

S002 只给出用户期望的“隔离沙箱”与服务端禁止项；S005 只覆盖 D1/身份，S007 只覆盖 Workers AI/JSON Mode。当前 7 份来源没有任何 raw contract 证明或约束生成 HTML/JS 的实际隔离机制，包括 iframe sandbox flags、CSP、脚本/导航/弹窗/下载、网络请求与数据外传、Cookie/父页面 DOM、消息桥接、存储命名空间、资源/大小/执行时限。高风险的“任意前端代码”不能仅凭用户措辞推导出安全实现边界。应补平台/浏览器沙箱权威快照，并把允许与禁止能力逐项形成 SRC→NFR；不可确定项标 OPEN，不得默认安全。

### CHG10-SREV-002 — Atoms 官方帮助来源缺失，模型平台快照也未覆盖代码包生成

S001-U0003 明确要求阅读官方帮助，S006-U0008 又声明工作区内部行为应以官方帮助为准，但 register 未登记官方帮助 raw snapshot，`product_requirements`/`prototype_and_interaction` 因而不能称完整。另 S007-U0019 明确把当前 Llama 职责限定为 AppSpec envelope；该旧快照没有代码生成能力、代码包 schema、输出 token/byte 上限或 HTML/CSS/JS 质量边界，不能支持 CHG-010 的新生成协议。应登记官方帮助 raw snapshot，并补本期选用模型/格式/容量的当前官方或生产能力证据。

### CHG10-SREV-003 — 现有 AppSpec 兼容没有 SRC 决策

S004-U0005~8、U0016~20 只证明当前 AppSpec v1、不可变版本和刷新行为；S002-U0012 只说 AppSpec 不再作为“目标生成协议”。没有任何 SRC 说明旧 AppSpec project/version 是否必须继续读取、渲染、激活和修改，或允许迁移/弃用。若“现有 AppSpec 兼容”是本期约束，当前 FR/NFR 映射完全缺失；应补用户/产品兼容决定及失败边界，不能从当前数据存在事实自动推导兼容义务。

### CHG10-SREV-004 — S005 两个官方代码块未做语义原子化

S005-U0004 被单个 `SRC-065` 整段映射 FR-004/NFR-005，但正文独立包含 D1 持久化、browser storage 非权威、hosting binding、schema/helper/prepared statement 四类约束；S005-U0005 的单个 `SRC-066` 又混合登录 header、匿名访客、跨 Site ID、服务端授权和 SIWC 决策。`coverage_assertion=FULL` 只证明整段被引用，不等于语义原子覆盖。必须拆为逐条原子并分别映射 FR-004、状态权威、安全授权、身份与非目标，避免用宽泛 NFR-005 吞并不同约束。

### CHG10-SREV-005 — 分类与权威边界存在误标

- S006-U0010~12 是“设计辅助结论”，属于观察后的启发/建议，不是公开 UI 的可验证 FACT；应标 OUT，或在用户采纳后另建 SRC，不能以 observed public product authority 伪装事实。
- S003-U0024 的“本期必须增加……”是分析者提出的规范性要求，不是 Cloudflare D1 查询事实。当前把它标 `SRC-037 → NFR-004` 与 register authority 不符；D1 只能支持 U0023 的审计缺口 FACT，NFR-004 需用户/决策来源或明确 OPEN。
- S007-U0032 的“发布验收必须……”同样是快照内设计边界，却被标 FACT 且未映射任何 NFR。若作为发布门禁，应有可归责 SRC→NFR；否则标 OUT/事实边界，不能在 FACT 与规范要求间悬空。

### CHG10-SREV-006 — 个别 SRC→FR 映射超出原文

S002-U0010 仅为“嗯 OK 开始吧”的一般实施授权，却被 `SRC-017` 同时映射 FR-002/FR-007/FR-008；该短句本身不包含代码包协议、任意生成边界或计数器持久化语义。具体要求已有 U0013/U0015，可将 U0010 仅作为 review decision/授权，不应作为三个 FR 的语义证据。S002-U0006~8 的疑问也应避免把“询问能力边界”直接扩写成未在原文出现的实现义务。

## 结论边界

当前集合在文件、单元与全文引用层面完整，但在高风险语义原子、权威分类和 SRC→FR/NFR 闭环上仍有可定位阻塞，尤其无法证明任意前端代码的隔离安全、模型/平台承载能力和旧 AppSpec 兼容责任。在 CHG10-SREV-001~006 修复前，来源门禁不可 CONFIRMED。

---

# CHG-010 第二轮独立来源覆盖复核

- 日期：2026-08-10
- Reviewer：`codex-independent-chg010-source-reviewer-r2`
- 结论：`REJECTED`
- 输入边界：仅使用当前 `source/register.yaml`、`source/units.jsonl`、`source/coverage.yaml` 与 register 登记的 11 份快照；未采用主 Agent 预期结论，也未读取下游 PRD、facts 或 traceability 作为来源正确性的反向证明。

## 完整性与已关闭项

- 11 份登记文件均存在，逐文件 SHA-256 与 register 一致；unit_count 合计 302，与 units 的 302 行一致。coverage 恰有 302 个 unit，content hash 全部与 units 一致，无缺失或多余 unit。
- coverage 包含 215 个 `ATOMIZED`、87 个 `NO_REQUIREMENT`；共 114 个 FACT、69 个 SRC、59 个 OUT，69 个 SRC ID 唯一。所有 SRC 均至少映射一个 FR/NFR，FR-001~009、NFR-001~006 均有映射，但“有映射”不等于下述权威性成立。
- `CHG10-SREV-002` 的官方帮助与代码模型事实缺口已补：S008 覆盖 Atoms 官方帮助；S010 覆盖 Qwen code-specific 定位、JSON Mode 不支持边界、context/pricing/capacity 与生产证据门禁。
- `CHG10-SREV-004` 已关闭：S005-U0004/U0005 的多段代码块已逐语义拆成 D1、browser storage、binding、访问层、身份与服务端授权原子；S008 的四个代码块也逐标题/段落/列表项拆分，代码围栏仅作为 ignored syntax。
- `CHG10-SREV-005/006` 指定分类已修正：S003-U0024、S006-U0010~12、S007-U0032、S002-U0006~10 均为 OUT，未再借分析建议、设计启发、发布主张、疑问或一般授权扩写 FR/NFR。

## 剩余阻塞项

### CHG10-SREV2-001 — S009 仍未分离权威平台事实与项目设计决定

S009-U0007~13、U0019、U0024~26、U0033~36 是可定位到 WHATWG/MDN/Cloudflare 的平台 FACT；但 U0014~16、U0020~21、U0027~30、U0035/U0037~38、U0040~52 则是本项目的实现选择、bridge API、owner/project 信任模型、允许/禁止清单和精确资源预算。快照正文第 3 行还声明“产品实现上限由 PRD 与设计另行收紧”，register 却把同一文件整体授权为“official documentation plus project technical owner constraints”，未给出技术 owner 的原始决定、日期或可复核引用。由此 `SRC-034~058` 中大量规范性结论仍是从标准事实直接跃迁成需求，而不是独立来源。

其中 `SRC-038` 尤其不受所引 MDN `default-src` 事实完整支持：`default-src` 是 fetch directive fallback，不会替代 `form-action`，所引段落也没有证明 CSP 本身可以承担顶层导航隔离；导航限制实际来自 iframe sandbox token。`SRC-058` 声称所有 48 KiB/12 KiB/8 KiB/50 key/64 KiB/2 秒预算“均小于平台外层限制”，但这些量纲并不能与 Worker 10 ms CPU、128 MB、50 subrequests、3 MB size 全部直接比较。高风险安全约束必须拆为“官方 FACT → 已归责的产品/安全决定 SRC”，无法归责的精确策略应进入设计而非伪装 raw contract。

### CHG10-SREV2-002 — S010 仍把模型选型推断误标为 FACT

S010-U0007 的“官方定位为 code-specific model”可作为 FACT；U0008 的“因此它比当前通用 Llama 更直接匹配 HTML/CSS/JavaScript 代码生成职责”是项目选型推断，并非官方页面事实，却仍标 FACT。类似地，U0019、U0025~27、U0039~41 是模型分工、协议、失败与发布门禁决定，来源正文没有用户/产品/技术 owner 的原始决定，只通过 register 的“project release policy”自我赋权。应将推断标 OUT/设计输入，或补有明确责任人和决定时间的原始 decision snapshot 后作为 SRC；官方模型文档只能证明模型/API/限制事实，不能自行证明本项目应采用何种职责与验收政策。

### CHG10-SREV2-003 — S011 不能独立证明旧 AppSpec 恢复与版本兼容决定

S011 登记标题为“Archived Atoms Demo Product Decisions”、authority 为“historical frozen product decision”，但实际快照是 `reference/prd.md`，正文明确状态 `DRAFT` 且写明“冻结前不得作为开发完成声明”。它同时包含“本期不承诺任意代码生成、采用有限模板”等与 CHG-010 新方向冲突的旧范围。coverage 选择性把绝大多数旧决定标 OUT，只提升 U0015/U0016/U0042/U0053 为 `SRC-066~069`，无法解释为何一个未冻结的派生 PRD 在这些段落上具有原始决定权、在其他段落上又没有。

旧 AppSpec project/version 的读取、渲染、切换、修改或迁移责任仍需来自明确的用户/产品兼容 decision snapshot；当前代码存在事实可以说明兼容对象，但不能产生兼容义务。故上一轮 `CHG10-SREV-003` 尚未真正关闭。

## 最终结论

`REJECTED`

第二轮已补齐来源数量、逐单元全文覆盖、官方帮助、Qwen 平台事实，并修复指定多语义 atom 与 OUT 分类；但 `CHG10-SREV2-001~003` 仍使沙箱安全契约、模型项目政策和旧 AppSpec 兼容要求缺少可独立核验的权威 SRC。修复前不能确认高风险 source gate，也不能用下游 facts/trace 的存在反向证明这些来源主张成立。

---

# CHG-010 第三轮独立来源覆盖复核

- 日期：2026-08-10
- Reviewer：`codex-independent-chg010-source-reviewer-r3`
- 结论：`REJECTED`
- 输入边界：仅使用当前 `source/register.yaml`、`source/units.jsonl`、`source/coverage.yaml` 与 register 登记的 12 份快照；未使用主 Agent 预期结论或未登记的下游材料。

## 完整性与 R2 关闭情况

- 12 份快照均存在且逐文件 SHA-256 与 register 一致；登记 unit_count 合计 280，与 units 实际 280 行一致。coverage 恰有 280 个 unit，所有 content hash 与 units 一致，无缺失、多余或 quote 不属于对应 unit 的情况。
- 280 个单元中 193 个 `ATOMIZED`、87 个 `NO_REQUIREMENT`；共有 104 个 FACT、51 个 SRC、65 个 OUT。51 个 SRC ID 从 `SRC-001` 至 `SRC-051` 连续且唯一，每个均有 FR/NFR 映射；104 个 FACT 均有关联 evidence ID，OUT 均有原因。在本轮允许输入内，结构与 ID 闭环成立；由于输入明确不包含实际 `facts.md`/`traceability.md`，不以这些下游文档反向证明来源正确性。
- `CHG10-SREV2-001` 的 raw 内容主体已关闭：S009 现在只保留 WHATWG iframe sandbox、MDN `default-src`/`postMessage` 和 Workers limits 的直接事实，已删除项目 bridge、namespace、代码包/消息/存储预算和 watchdog 决定。S009-U0017 明确把“该事实不等于导航、form action 或消息授权策略”标 OUT；`SRC-041/042` 只映射 fetch directive fallback 范围，没有再声称 `default-src` 可承担导航或 `form-action` 策略。
- `CHG10-SREV2-002` 的 raw 内容主体已关闭：S010 只保留 Cloudflare 官方 Qwen/Llama/JSON Mode/pricing/limits 事实；原 builder、parser、repair、fallback 与发布门禁已删除。S010-U0012 对输出长度、响应时间和中文生成成功率的“未承诺”正确标 OUT，未把缺少承诺变成能力保证。
- `CHG10-SREV2-003` 部分关闭：S011 authority 已明确为 historical draft，62 个单元中所有实质内容均不再作为 SRC；S012 保存了用户原始问答，`SRC-049/050` 对“旧 AppSpec 可打开/切换”和“继续修改产生新 CodeBundle 且不改写旧版本”的规范化语义与原始问题及“可以”一致。

## 剩余阻塞项

### CHG10-SREV3-001 — register 的 S009/S010 权威与 facet 描述仍引用已删除的项目决定

S009 原文第 3 行明确“只记录公开标准/平台页面直接支持的事实，不混入项目 bridge、namespace、代码包大小或 watchdog 设计”，但 register 的 authority 仍为 `WHATWG, MDN and Cloudflare official documentation plus project technical owner constraints`；`data_and_state` reason 仍声称 S009 登记了“沙箱 bridge”约束，`security_and_permissions` 又称其为“message bridge 契约”。当前 S009 只有通用 `postMessage` 传输与校验事实，没有项目 bridge API、可信字段、namespace 或状态契约。

S010 原文同样明确 builder 选型、CodeBundle、parser、repair 与发布证据属于后续设计，但 register authority 仍包含 `project release policy`，`non_functional_and_release` reason 仍声称来源登记了“线上证据门禁”。这些 stale metadata 会把已主动移出 raw 的设计/政策继续伪装成来源全集已覆盖。应把 S009/S010 authority 和 facet reason 改成与纯官方事实快照一致；项目 bridge、资源预算、模型选型和发布门禁应在后续设计/验收中形成，不应由 register 虚构已登记来源。

### CHG10-SREV3-002 — S012-U0011 / SRC-051 超出用户原始确认

S012 原始问题只包含两项：旧 AppSpec 项目/历史版本继续可打开和切换；旧项目继续修改时生成新的代码版本。用户回复“可以”足以支持 `SRC-049/050`。但规范化决定 U0011 额外写成“升级和回滚均不得删除既有项目、消息或版本数据”，新增了原问题没有出现的 `回滚` 和 `消息` 数据义务，并以 `SRC-051 → FR-005/NFR-005` 进入范围。

“旧版本可打开/切换”可以推导相关 project/version 必须保留，但不能独立推出所有 message 数据的升级/回滚不删除承诺。应将 U0011 收窄到原始确认直接覆盖的 project/version 非破坏兼容语义，或补充用户对 message 与 rollback 数据保留的明确原始确认；否则 `SRC-051` 仍是未经授权的规范扩写。

## 最终结论

`REJECTED`

第三轮已关闭 S009/S010 的 raw 内容混杂、`default-src` 导航外推、S010 选型推断，以及 S011 draft 被选择性当兼容决定的问题；但 `CHG10-SREV3-001/002` 仍造成来源 register 与快照矛盾、兼容 SRC 超出用户原始确认。修复前高风险 source gate 不可 CONFIRMED。

---

# CHG-010 第四轮独立来源覆盖定点复核

- 日期：2026-08-10
- Reviewer：`codex-independent-chg010-source-reviewer-r4`
- 结论：`CONFIRMED`
- 输入边界：当前 `source/register.yaml`、`source/units.jsonl`、`source/coverage.yaml` 与 register 登记的 12 份快照；定点复核 R3 的 `CHG10-SREV3-001/002`，不使用下游 PRD/VibeTest 反向证明 raw 来源。

## 定点结论

- `CHG10-SREV3-001` 已关闭：S009 authority 已收窄为 WHATWG、MDN、Cloudflare 官方文档，S010 authority 已收窄为 Cloudflare Workers AI 官方文档。`data_and_state`、`security_and_permissions` 只声称登记了 `postMessage`/iframe/CSP 官方事实；`non_functional_and_release` 只声称登记平台安全与模型容量事实，并明确项目验收门禁由后续 PRD/VibeTest 设计。register 不再把项目 bridge、namespace、资源预算、模型职责或 release policy 冒充 raw 来源。
- `CHG10-SREV3-002` 已关闭：S012 已删除未经原始问答确认的 rollback/messages bullet 与 `SRC-051`。现有 `SRC-049` 精确对应旧 AppSpec 项目/历史版本继续可打开、切换；`SRC-050` 精确对应旧项目继续修改时生成新 CodeBundle 且不覆盖/改写旧版本，均受原始问题及用户“可以”直接支持。

## 一致性回查

- 12 份快照逐文件 SHA-256 均与 register 一致；unit_count 合计 279，与 units 的 279 行及 coverage 的 279 个 unit 一致。
- 279 个单元中 192 个 `ATOMIZED`、87 个 `NO_REQUIREMENT`；共有 104 个 FACT、50 个 SRC、65 个 OUT。50 个 SRC 唯一且均映射 FR/NFR；所有 FACT 均有关联 evidence ID，所有 OUT 均有原因。
- coverage 无缺失或多余 unit，无 content hash 漂移，无 atom quote 脱离对应原文。删除 S012-U0011 后未留下重复、悬空或越界 SRC。
- S009 的 `default-src` 仍只覆盖 fetch directive fallback；“不等于导航、form action 或消息授权策略”保持 OUT，没有重新产生 R2 的安全外推。S010 仍只保留官方模型、JSON Mode、pricing/limits 事实，未重新混入 builder、repair 或发布政策。

## 最终结论

`CONFIRMED`

R3 两项阻塞均已关闭，且定点修订未破坏来源集合、逐单元覆盖、SRC/FACT/OUT 分类或 SRC→FR/NFR 内部闭环。当前高风险 source coverage 可进入独立复核登记；本结论不代表后续设计、实现或线上验收已完成。
