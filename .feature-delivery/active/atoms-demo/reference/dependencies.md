# Atoms AI App Builder Demo 外部参考与依赖清单

`reference/` 保存外部权威材料的本地快照或可访问引用；本表说明其责任、版本与本期使用边界。若材料包含需求原文，还必须登记到 `source/` 参与来源覆盖。

| ID | 上游/下游 | 材料类型 | 本地快照或受控链接 | 版本/日期 | 本期用途 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| REF-001 | 上游 | 挑战原文 | `reference/user-challenge.md` | 2026-08-09 | 范围与验收权威来源 | VERIFIED |
| REF-002 | 上游 | 官方帮助中心观察 | `reference/official-help-observations.md` | 2026-08-09 | 产品现状与交互参考 | VERIFIED_WITH_LIMITATION |
| REF-003 | 下游 | Sites D1 / Hosting | `.openai/hosting.json` | 当前 Starter | 持久化与在线发布 | AVAILABLE |
| REF-004 | 本仓 | 当前代码与配置观察 | `reference/current-project-observations.md` | 2026-08-09 | 现状基线与安全边界 | VERIFIED |
| REF-005 | 上游 | Atoms 公开产品体验 | `reference/product-experience-observations.md` | 2026-08-09 | UI 与交互设计辅助 | VERIFIED_WITH_LOGIN_LIMIT |
| REF-006 | 上游 | 官方帮助原始结构化快照 | `reference/raw-official-help-snapshot.md` | 2026-08-09 | 独立复核官方事实 | VERIFIED |
| REF-007 | 上游 | Atoms 公开 UI 原始结构化快照 | `reference/raw-atoms-public-ui.md` | 2026-08-09 | 独立复核公开 UI | VERIFIED_WITH_LOGIN_LIMIT |
| REF-008 | 本仓 | 真实配置与代码 | `.openai/hosting.json`、`package.json`、`app/page.tsx`、`db/schema.ts` | 当前 | 独立复核技术现状 | VERIFIED |
