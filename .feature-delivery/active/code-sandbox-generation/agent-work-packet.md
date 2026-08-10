# CHG-010 Code Sandbox Generation - Agent 工作包

## 任务

按 TASK-101~108 将 AppSpec-only 生成升级为安全 CodeBundle 生成，完成代码、D1、沙箱、真实模型、在线部署与证据；不得用无关模板关闭成功路径。

## 可写边界

- 可写：`/Users/ln/IdeaProjects/atoms-demo` 内业务代码、测试、`db/`、项目 Feature Delivery/VibeTest 和文档。
- 只读：Atoms/Cloudflare/WHATWG/MDN 快照，归档 `.feature-delivery/archive/atoms-demo`。
- 禁止：通用 skill、其它仓库、外部提交页面、生产 D1 删除/重建、pre-CHG-010 Worker 回滚。

## 权威输入

- PRD：`.feature-delivery/active/code-sandbox-generation/reference/prd.md`
- 技术方案：`.feature-delivery/active/code-sandbox-generation/design/technical-design.md`
- 追踪：`.feature-delivery/active/code-sandbox-generation/traceability.md`
- VibeTest：`.vibetest/code-sandbox-generation/`
- 当前证据：S003/S004/S007/S009/S010/S012。

## 外部快照与前置

- 开发以 strict fake runner、本地 D1 和真实浏览器为替代。
- 发布前必须使用 Cloudflare production `AI`/`DB` binding；精确 Qwen/Llama model id 与 production SHA 写证据。
- GitHub 与 Cloudflare 已授权的现有项目可继续使用，但线上写入仅限加性 migration/部署/测试生成数据。

## 必须验证

- CodeBundle parser/safety、completion/failure 原子性、owner/storage boundary、旧 AppSpec、计数器点击刷新。
- 10 条线上语义基准 ≥90%，计数器 2/2 且至少一个 Qwen SUCCESS。
- build/type/lint/test、本地空库/旧库/并发 migration、在线 API/浏览器/D1、两个 owner、GitHub/production SHA。

## 完成输出

- 代码和加性 schema 变更。
- `.vibetest/code-sandbox-generation/evidence.md` 与固定 artifact。
- Cloudflare 在线链接、Worker/version/commit、GitHub Public 链接。
- 残余风险、回滚开关和 compatibility build 说明。
