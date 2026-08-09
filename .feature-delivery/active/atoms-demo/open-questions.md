# Atoms AI App Builder Demo - 开放问题

状态使用 `OPEN`、`ANSWERED`、`ACCEPTED_RISK`。级别使用 `BLOCKING`、`NON_BLOCKING`、`EXTERNAL_PREREQUISITE`。

| ID | 级别 | 状态 | 问题 | 影响门禁 | Owner | 期限 | 默认处理/证据 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Q-001 | NON_BLOCKING | ANSWERED | 是否必须接入真实外部大模型？ | 设计 | 项目 | 2026-08-09 | 挑战要求智能体驱动，不要求指定模型；采用稳定的规则生成引擎 |
| Q-002 | EXTERNAL_PREREQUISITE | OPEN | 最终托管是否允许匿名公开访问？ | 发布 | Sites Hosting | 发布时 | 若仅能私有访问，记录访问要求并提供可测试链接 |
| Q-003 | NON_BLOCKING | ACCEPTED_RISK | `support.mgx.dev` 原入口被本机安全页拦截 | 范围 | 项目 | 2026-08-09 | 使用同主体官方公开帮助副本，并在证据中保留限制 |
