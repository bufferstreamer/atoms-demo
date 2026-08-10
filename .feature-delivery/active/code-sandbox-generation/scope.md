# CHG-010 Code Sandbox Generation - 范围与能力边界

## 业务目标

把 Atomize 从受限 AppSpec 看板生成器升级为 AI 驱动的纯前端代码生成器：用户输入自然语言后得到真实 HTML/CSS/JavaScript、隔离预览、可检查代码、应用数据持久化和不可变版本。

## 当前现状

- 生产 50 次生成仅 18 次 Workers AI 成功，32 次 fallback；计数器连续落为无关 `Spark 项目看板`（EV-003）。
- AppSpec 只允许三种页面和四类动作，不能表达通用状态、算术或代码文件（EV-004）。
- D1 项目/消息/run/version、owner、幂等、限流和公网部署可复用（EV-004）。

## 本期范围

- CodeBundle v1、模型生成/repair、服务端校验与精确审计。
- iframe 沙箱、预览/代码切换、运行错误反馈。
- D1 `Atoms.storage` 状态桥接与容量/授权控制。
- 旧 AppSpec 兼容读取和新代码版本链。
- 计数器 P0 与五类真实语义基准。

## 明确不做

- 任意后端、命令、依赖安装、外部网络、认证/支付集成和原生应用。
- 未经沙箱与服务端校验直接执行模型代码。
- 用无关模板掩盖模型失败。

## 兼容与无感升级

- 现有 project/message/run/version/owner 契约继续使用。
- 版本增加 artifact kind；旧记录默认为 `app_spec` 并继续只读渲染。
- 新项目和新修改默认生成 `code_bundle`；旧项目可从当前 AppSpec 语义迁移到新代码版本。
- 失败不移动 current pointer；回滚应用不删除 D1 新表或历史版本。

## 仓库与团队所有权

| 仓库/系统 | 产品职责 | 本期改动 | 数据事实源 | 对外契约 | 验收责任 |
| --- | --- | --- | --- | --- | --- |
| `atoms-demo` | 生成工作台与沙箱运行时 | 全部业务改造 | D1 | HTTP API / CodeBundle / storage bridge | 本仓 |
| Workers AI | 模型推理 | 无平台改动 | 无项目事实 | `env.AI.run` | 真实调用证据 |
| Sites/Cloudflare | 公网运行与 binding | D1 migration/部署 | 平台配置 | Hosting/Worker runtime | 部署终态与在线验证 |

## 上下游能力

| 环节 | 输入 | 当前能力 | 目标能力 | 最终决策方 | 本仓职责 | 外部职责 | 失败行为 | 证据 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 需求生成 | prompt | AppSpec 白名单 | CodeBundle v1 | 本仓协议 | 编排、校验、持久化 | Workers AI 推理 | 明确失败/定向 repair | EV-003/004 |
| 预览执行 | AppSpec | 固定 React renderer | 隔离 HTML/CSS/JS | sandbox runtime | CSP、bridge、错误 UI | 浏览器隔离 | 卸载失败 iframe | PRD FR-003/007 |
| 应用状态 | React 临时状态 | 刷新丢失 | D1 JSON KV | D1 | owner/project 授权 | Sites binding | 明确 4xx，不改旧值 | PRD FR-004 |
| 发布 | build artifact | 已有公网 Worker/Sites | 兼容新 schema 的公网版本 | 发布记录 | 构建/迁移/验收 | 平台托管 | 回滚前版本，保留 D1 | NFR-001/005 |
