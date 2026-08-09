# Atoms AI App Builder Demo - 事实、假设与术语

## 已验证事实

| ID | 事实 | 证据类型 | 证据位置 | 验证时间 |
| --- | --- | --- | --- | --- |
| FACT-001 | 挑战要求真实交互、持久化、在线链接和至少一个延展能力 | 用户原始需求 | `reference/user-challenge.md` | 2026-08-09 |
| FACT-002 | MGX 已更名为 Atoms，并以多角色 Agent 协作完成软件构建 | 官方帮助原文 | `reference/raw-official-help-snapshot.md`（S005/EV-002） | 2026-08-09 |
| FACT-003 | 官方核心体验为自然语言沟通、Agent 分工、应用生成与预览、发布与分享 | 官方帮助原文 | `reference/raw-official-help-snapshot.md`（S005/EV-002） | 2026-08-09 |
| FACT-004 | 官方将刷新后仍保留数据作为后端持久化验证方式 | 官方帮助原文 | `reference/raw-official-help-snapshot.md`（S005/EV-002） | 2026-08-09 |
| FACT-005 | Atoms 公开首页以一句话输入和模板作为起点，登录支持 Google 或邮箱 | 公开页面原文与实际观察 | `reference/raw-atoms-public-ui.md`（S006/EV-004） | 2026-08-09 |
| FACT-006 | Sites 公共站允许匿名访客；授权必须在服务端执行，持久结构化数据使用 D1 | Sites 官方参考原文 | `reference/raw-sites-platform-capabilities.md`（S012/EV-005） | 2026-08-09 |

## 目标决定

| ID | 决定 | 决策人/来源 | 落地材料 | 日期 |
| --- | --- | --- | --- | --- |
| DEC-001 | 本期采用单页三栏工作区：项目导航、Agent 对话、实时应用预览 | 产品设计决定 | PRD / 技术方案 | 2026-08-09 |
| DEC-002 | 使用规则驱动的生成引擎输出多种真实可交互应用，不依赖外部模型密钥 | 技术设计决定 | 技术方案 | 2026-08-09 |
| DEC-003 | 使用平台 D1 保存项目、消息和版本，刷新后从服务端恢复 | 技术设计决定 | 技术方案 | 2026-08-09 |
| DEC-004 | 为满足可测试在线链接，本期不设置应用自有登录门槛，也不接入密钥、资金或敏感数据 | 挑战要求与复杂度控制 | PRD / 技术方案 | 2026-08-09 |
| DEC-005 | 官方帮助列七类核心角色，公开首页额外展示广告专家 Adrian；本期不复刻固定数量，只展示与生成主链有关的四个阶段角色 | 官方材料差异与复杂度控制 | PRD / 技术方案 | 2026-08-09 |
| DEC-006 | 公开 Demo 采用服务端所有者隔离：优先使用平台稳定用户 ID；匿名访问由服务端签发随机 httpOnly、SameSite=Lax 工作区 Cookie；所有项目读写按 owner key 过滤 | Sites 身份边界与安全设计决定 | 技术方案 / VibeTest | 2026-08-09 |
| DEC-007 | 错误处理统一遵循“保留用户输入与最后成功版本、不给错误请求切换当前版本、提供明确重试或解释” | 稳定性评分与工程安全决定 | PRD / 技术方案 / VibeTest | 2026-08-09 |
| DEC-008 | 单页三栏、直接输入、模板示例、阶段角色与预览焦点属于公开产品体验启发的设计选择，不作为用户挑战中的硬需求来源 | 产品设计决定 | PRD / 技术方案 | 2026-08-09 |
| DEC-009 | 公开写入接口限制 prompt 长度、单工作区项目数量与短时请求频率；AppSpec 使用白名单结构，禁止执行任意 HTML/JavaScript | 安全与容量设计决定 | 技术方案 / VibeTest | 2026-08-09 |

## 假设

| ID | 假设 | 影响 | 验证方式 | 状态 |
| --- | --- | --- | --- | --- |
| ASM-001 | 参赛访问者可匿名进入体验，不强制第三方登录 | 降低测试门槛，但必须按服务端 owner key 隔离 | 在线验收 | ACCEPTED |
| ASM-002 | 规则生成足以证明“智能体驱动的应用生成”，无需调用收费模型 | 生成范围有限但演示稳定 | 多提示词验收 | ACCEPTED |

## 术语与 ID

| 术语/字段 | 业务含义 | 所属系统 | 粒度/关系 | 是否可信输入 | 证据 |
| --- | --- | --- | --- | --- | --- |
| Project | 一次可持续迭代的应用构建空间 | Demo | 包含消息、Agent 运行和版本 | 服务端生成 ID | PRD |
| Agent Run | 用户请求触发的一次多角色协作执行 | Demo | 属于一个 Project | 服务端生成 | 技术方案 |
| Build Version | 一次可预览、可恢复的生成结果 | Demo | 属于一个 Project | 服务端生成 | 技术方案 |

## 证据索引

| EV ID | 类型 | 路径/链接/命令 | 证明内容 | 限制 |
| --- | --- | --- | --- | --- |
| EV-001 | 用户需求快照 | `reference/user-challenge.md` | 本期目标与验收要求 | 不证明实现状态 |
| EV-002 | 官方帮助原文快照 | `reference/raw-official-help-snapshot.md`（索引：`official-help-observations.md`） | MGX/Atoms 产品角色、持久化验证与发布分享 | 原入口受安全页限制，使用官方公开副本 |
| EV-003 | 仓库原始基线 | `reference/raw-code-config-snapshot.md`、`.openai/hosting.json`（索引：`current-project-observations.md`） | 空骨架、技术栈与空 D1/R2 配置 | 不证明线上托管已可用 |
| EV-004 | 公开产品页面原文与体验 | `reference/raw-atoms-public-ui.md`（索引：`product-experience-observations.md`） | 首屏、模板、Agent 表达和登录入口 | 未进入登录后的工作区 |
| EV-005 | Sites 平台能力 | `reference/raw-sites-platform-capabilities.md` | D1 持久化、身份头、匿名边界和服务端授权责任 | 不证明线上资源已创建 |
