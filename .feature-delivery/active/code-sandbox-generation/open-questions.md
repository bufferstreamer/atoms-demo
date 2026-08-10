# CHG-010 Code Sandbox Generation - 开放问题

状态使用 `OPEN`、`ANSWERED`、`ACCEPTED_RISK`。级别使用 `BLOCKING`、`NON_BLOCKING`、`EXTERNAL_PREREQUISITE`。

| ID | 级别 | 状态 | 问题 | 影响门禁 | Owner | 期限 | 默认处理/证据 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OQ-001 | BLOCKING | ANSWERED | “AI 生成任意”的范围是否包含服务端执行和依赖安装？ | scope | 用户 | 已答 | 仅纯前端沙箱；S002/DEC-011 |
| OQ-002 | BLOCKING | ANSWERED | 模型失败是否允许继续写固定模板？ | scope | 用户 | 已答 | 禁止无关模板；S002/S003/DEC-013 |
| OQ-003 | NON_BLOCKING | ANSWERED | 生成应用数据按版本还是项目共享？ | design | Codex | 已答 | project 级共享；版本切换不清数据，提供 clear API |
| OQ-004 | BLOCKING | ANSWERED | 历史 AppSpec 是否必须继续打开、切换，并在修改后生成 code bundle？ | scope | 用户 | 已答 | 保留可读可切换；旧项目修改生成新 CodeBundle；S012/DEC-014 |
| OQ-005 | EXTERNAL_PREREQUISITE | OPEN | 新部署上 Qwen2.5-Coder 是否能在 48 KiB/65 秒预算内稳定生成 CodeBundle？ | staging/release | Cloudflare | 发布前 | VT-108 精确 Qwen 模型 + D1 + 浏览器证据，不通过不发布 |
