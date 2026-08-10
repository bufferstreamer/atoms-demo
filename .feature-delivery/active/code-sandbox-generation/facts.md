# CHG-010 Code Sandbox Generation - 事实、假设与术语

## 已验证事实

| ID | 事实 | 证据类型 | 证据位置 | 验证时间 |
| --- | --- | --- | --- | --- |
| FACT-001 | 生产 50 次生成中 Workers AI SUCCESS 18 次、fallback 32 次 | 运行数据 | EV-003 | 2026-08-10 |
| FACT-002 | 计数器两次分别因 INVALID_APP_SPEC/INVALID_DESIGN_ARTIFACT 降级为 Spark 项目看板 | 运行数据 | EV-003 | 2026-08-10 |
| FACT-003 | 当前 AppSpec 只允许 dashboard/tracker/landing 与四类 action | 代码 | EV-004 | 2026-08-10 |
| FACT-004 | 当前应用内部交互状态不以 D1 为事实源 | 代码 | EV-004 | 2026-08-10 |
| FACT-005 | 当前 D1 项目、run、step、version、event 与 owner/幂等链路可复用 | 代码/生产 | EV-004 | 2026-08-10 |
| FACT-006 | Sites 规定持久产品数据使用 D1，服务端负责授权 | 官方约束 | EV-005 | 2026-08-10 |
| FACT-007 | 当前 Llama Fast 支持 JSON Mode，但官方不保证输出绝对满足 schema | 官方约束 | EV-007 | 2026-08-10 |
| FACT-008 | Atoms 官方帮助明确覆盖网站、Web App、计算器、代码编写、数据管理与稳定公开链接 | 官方产品资料 | EV-008 | 2026-08-10 |
| FACT-009 | iframe sandbox 可形成 opaque origin；CSP 负责网络 fetch 限制；opaque guest 的消息桥必须叠加 source/token/schema 校验 | 浏览器标准/官方文档 | EV-009 | 2026-08-10 |
| FACT-010 | Qwen2.5-Coder-32B 是 Cloudflare-hosted code-specific 文本模型，context 32,768 tokens，但不在 Workers AI JSON Mode 支持列表 | Cloudflare 官方文档 | EV-010 | 2026-08-10 |
| FACT-011 | 用户确认旧 AppSpec 项目/历史版本继续可读可切换，继续修改时生成新的 CodeBundle 版本 | 用户决定 | EV-012 | 2026-08-10 |

## 目标决定

| ID | 决定 | 决策人/来源 | 落地材料 | 日期 |
| --- | --- | --- | --- | --- |
| DEC-010 | 用纯前端 CodeBundle 替换 AppSpec 作为新生成物 | 用户/S002 | PRD FR-002/007 | 2026-08-10 |
| DEC-011 | “任意”限定为隔离沙箱中的 HTML/CSS/JS，不含任意服务端执行 | 用户对齐/S002 | scope/PRD 6 | 2026-08-10 |
| DEC-012 | 计数器点击与刷新恢复为 P0 门禁 | 用户/S002 | PRD FR-008 | 2026-08-10 |
| DEC-013 | 模型失败不再返回无关模板 | 用户反馈/S002/S003 | PRD FR-006 | 2026-08-10 |
| DEC-014 | 保留旧 AppSpec 项目与版本；旧项目修改升级为新 CodeBundle 版本 | 用户/S012 | PRD FR-005 | 2026-08-10 |

## 假设

| ID | 假设 | 影响 | 验证方式 | 状态 |
| --- | --- | --- | --- | --- |
| ASM-001 | Qwen2.5-Coder 能在时限内生成三文件依赖零安装代码包 | 决定线上成功率 | 本地 fake runner + 生产真实模型 VT-108 | 待验证 |
| ASM-002 | iframe sandbox+CSP+静态拒绝足以覆盖公开 Demo 风险 | 决定发布安全边界 | 安全负向矩阵 VT-104/105 | 待验证 |

## 术语与 ID

| 术语/字段 | 业务含义 | 所属系统 | 粒度/关系 | 是否可信输入 | 证据 |
| --- | --- | --- | --- | --- | --- |
| CodeBundle v1 | HTML/CSS/JS 文件集合、标题、入口和摘要 | atoms-demo | 一个 version 一个 bundle | 仅经服务端校验后可信 | DEC-010 |
| sandbox preview | 无同源权限 iframe 中的代码运行实例 | Browser | 当前选中 version | 否，生成代码不可信 | DEC-011 |
| Atoms.storage | 沙箱到父页面再到 D1 的异步 KV RPC | atoms-demo | owner + project + key | key/value 需服务端校验 | NFR-005 |
| legacy AppSpec | CHG-010 前保存的结构化页面配置 | atoms-demo | 历史 version | 已有服务端校验记录 | FACT-003 |

## 证据索引

| EV ID | 类型 | 路径/链接/命令 | 证明内容 | 限制 |
| --- | --- | --- | --- | --- |
| EV-003 | Cloudflare D1 只读查询 | `reference/production-failure-evidence-2026-08-10.md` | 线上成功率、失败码和计数器无关结果 | 不含被拒绝模型原文 |
| EV-004 | 当前代码快照 | `reference/current-code-boundary-2026-08-10.md` | AppSpec、fallback、临时状态和可复用资产 | 目标行为不由代码决定 |
| EV-005 | Sites 官方约束 | 归档 `raw-sites-platform-capabilities.md` | D1 与服务端授权责任 | 不替代真实部署证据 |
| EV-006 | Atoms 公共 UI 观察 | 归档 `product-experience-observations.md` | idea-first 和 Agent 分工体验 | 未登录内部工作区 |
| EV-007 | Cloudflare 模型事实 | 归档 `workers-ai-model-facts-2026-08-09.md` | 模型/JSON Mode/binding 边界 | 发布时需重验 |
| EV-008 | Atoms 官方帮助 | 归档 `raw-official-help-snapshot.md` | Agent 分工、代码/应用类型、持久化与公开链接能力 | 公开帮助快照，非登录工作区协议 |
| EV-009 | 浏览器/托管安全契约 | `reference/raw-browser-sandbox-contract-2026-08-10.md` | iframe、CSP、message bridge、隔离与资源上限边界 | 工程预算仍需设计和边界测试冻结 |
| EV-010 | Workers AI 代码模型事实 | `reference/workers-ai-code-generation-facts-2026-08-10.md` | Qwen Coder、Llama planner、JSON Mode、免费额度和线上证据门禁 | 不能替代最终 Worker 的真实模型成功证据 |
| EV-012 | 用户兼容决定 | `reference/user-legacy-compatibility-decision.md` | 旧 AppSpec 读取、切换及修改升级为新 CodeBundle | 不替代迁移和浏览器回归证据 |
