# CHG-010 Code Sandbox Generation 外部参考与依赖清单

`reference/` 保存外部权威材料的本地快照或可访问引用；本表说明其责任、版本与本期使用边界。若材料包含需求原文，还必须登记到 `source/` 参与来源覆盖。

| ID | 上游/下游 | 材料类型 | 本地快照或受控链接 | 版本/日期 | 本期用途 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| REF-001 | 上游 | 挑战原文 | 归档 `reference/user-challenge.md` | 2026-08-09 | 产品范围与评分 | SNAPSHOT |
| REF-002 | 上游 | 用户变更决定 | `reference/user-change-request.md` | 2026-08-10 | CHG-010 目标与授权 | SNAPSHOT |
| REF-003 | 现状 | D1 运行证据 | `reference/production-failure-evidence-2026-08-10.md` | 2026-08-10 | 缺陷基线与验收反例 | SNAPSHOT |
| REF-004 | 现状 | 代码边界 | `reference/current-code-boundary-2026-08-10.md` | commit `0c7783f` | 兼容与改造起点 | SNAPSHOT |
| REF-005 | 平台 | D1/身份官方约束 | 归档 `raw-sites-platform-capabilities.md` | 2026-08-09 | 状态与授权设计 | SNAPSHOT |
| REF-006 | 产品 | Atoms 公开体验 | 归档 `product-experience-observations.md` | 2026-08-09 | 保留 idea-first/Agent 体验 | SNAPSHOT |
| REF-007 | 上游 | Workers AI 模型与 JSON Mode | 归档 `workers-ai-model-facts-2026-08-09.md` | 2026-08-09 | 模型适配与验收前提 | REVERIFY_AT_RELEASE |
| REF-008 | 产品 | Atoms 官方帮助 | 归档 `raw-official-help-snapshot.md` | 2026-08-09 | 应用类型、Agent、持久化与发布能力基线 | SNAPSHOT |
| REF-009 | 平台 | iframe/CSP/postMessage/Workers 安全契约 | `reference/raw-browser-sandbox-contract-2026-08-10.md` | 2026-08-10 | 不可信代码执行边界与验收上限 | SNAPSHOT |
| REF-010 | 上游 | Workers AI 代码生成模型 | `reference/workers-ai-code-generation-facts-2026-08-10.md` | 2026-08-10 | Qwen builder、Llama planner、输出与费用边界 | REVERIFY_AT_RELEASE |
| REF-011 | 历史决定 | 归档 PRD | 归档 `reference/prd.md` | 2026-08-09 | 旧项目恢复、不可变版本和版本切换兼容义务 | SNAPSHOT |
| REF-012 | 用户决定 | 旧版本兼容确认 | `reference/user-legacy-compatibility-decision.md` | 2026-08-10 | 旧 AppSpec 读取、切换和修改升级边界 | CONFIRMED |
