# Atoms AI App Builder Demo - 发布记录

## 发布对象

| 应用/仓库 | 版本/提交 | 环境 | 部署/变更引用 | 状态 |
| --- | --- | --- | --- | --- |
| Atomize / `atoms-demo` | Sites version 1 / `c45afbcdeb6f844650de66936d84df277b47ef4f` | Production | `appgdep_6a7842c73bc88191a2bce106c7044842` | `SUCCEEDED` |

## 配置与依赖

- URL：`https://atomize-ai-builder.qwert012342026.chatgpt.site`
- Sites project：`appgprj_6a7840f921308191b84ce59a6a77d176`
- D1 logical binding：`DB`；R2 未使用。
- Access policy：`public`，revision 2。
- 运行时不依赖外部 LLM API 或业务密钥；生成器为确定性 AppSpec v1。

## 验证与监控

- 部署终态：`succeeded`，平台已生成 production screenshot。
- 完整证据：`.vibetest/atoms-demo/artifacts/verification-2026-08-09.md`。
- 本地真实浏览器已覆盖生成、交互、刷新持久化、继续修改、版本切换、窄屏、双 Cookie 隔离。
- 线上自动浏览受本机企业安全网关拦截，未绕过；待外部网络人工补跑 VT-009。
- 运行监控使用 Sites deployment status 与 Worker logs；首次观察窗口为发布后 30 分钟。

## 应急与回滚

- 若出现阻断问题，先将访问策略收回 `custom`，停止新增匿名流量。
- 修复后从已验证提交构建新的 Sites version 并重新发布；当前为首个版本，无更早应用版本可回退。
- D1 schema 为新增型，回滚应用时保留数据库，不执行破坏性清理；项目版本本身不可变且可切回历史版本。
- Owner：codex / 项目所有者。

## 残余风险

- `RISK-001`：企业安全网关阻止本机对 production 执行完整浏览器回归；公开链接与平台截图/终态已确认。Owner：项目所有者；期限：提交评审前从外部网络补跑一次 VT-009。
- `RISK-002`：匿名 Cookie 可删除以重置 owner 配额；全局分钟桶和 5000 项目总上限作为 Demo 兜底。挑战范围内接受，不作为企业级鉴权方案。
- `RISK-003`：并发/故障注入/迟到完成属于上线强化项，未作为本挑战 Demo 的完成阻塞。
