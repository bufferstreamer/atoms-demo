# Atoms AI App Builder Demo - 发布记录

## 发布对象

| 应用/仓库 | 版本/提交 | 环境 | 部署/变更引用 | 状态 |
| --- | --- | --- | --- | --- |
| Atomize / `atoms-demo` | Sites version 1 / `c45afbcdeb6f844650de66936d84df277b47ef4f` | Production | `appgdep_6a7842c73bc88191a2bce106c7044842` | `SUCCEEDED` |
| Atomize / `atoms-demo` | Worker version `2802d500-e9f5-467b-a1fc-a9d118693243` / `83c2997` | Cloudflare Production | `atomize-ai-builder-demo` | `SUCCEEDED` |

## 配置与依赖

- URL：`https://atomize-ai-builder.qwert012342026.chatgpt.site`
- Sites project：`appgprj_6a7840f921308191b84ce59a6a77d176`
- D1 logical binding：`DB`；R2 未使用。
- Access policy：`public`，revision 2。
- 运行时不依赖外部 LLM API 或业务密钥；生成器为确定性 AppSpec v1。
- Cloudflare URL：`https://atomize-ai-builder-demo.atomize-demo.workers.dev`。
- Cloudflare D1：`atomize-demo-db`（APAC），logical binding `DB`；迁移后 7 张业务表。
- Cloudflare Free plan；动态请求、CPU 与 D1 免费日额度作为平台硬上限。

## 验证与监控

- 部署终态：`succeeded`，平台已生成 production screenshot。
- 完整证据：`.vibetest/atoms-demo/artifacts/verification-2026-08-09.md`。
- 本地真实浏览器已覆盖生成、交互、刷新持久化、继续修改、版本切换、窄屏、双 Cookie 隔离。
- 线上自动浏览受本机企业安全网关拦截，未绕过；待外部网络人工补跑 VT-009。
- 运行监控使用 Sites deployment status 与 Worker logs；首次观察窗口为发布后 30 分钟。
- Cloudflare 完整证据：`.vibetest/atoms-demo/artifacts/verification-cloudflare-2026-08-09.md`。
- Cloudflare 已在线完成生成、筛选、继续修改、刷新持久化、历史版本切换和双 Cookie 隔离；此前 VT-009 的企业网关阻塞已由新域名关闭。

## 应急与回滚

- 若出现阻断问题，先将访问策略收回 `custom`，停止新增匿名流量。
- 修复后从已验证提交构建新的 Sites version 并重新发布；当前为首个版本，无更早应用版本可回退。
- D1 schema 为新增型，回滚应用时保留数据库，不执行破坏性清理；项目版本本身不可变且可切回历史版本。
- Owner：codex / 项目所有者。
- Cloudflare 可使用 Workers Versions 回滚；首个已验证版本为 `2802d500-e9f5-467b-a1fc-a9d118693243`。若 Cloudflare 不可用，保留原 Sites version 1 作为代码级回退。

## 残余风险

- `RISK-001`：`chatgpt.site` 在企业网络不可访问，已通过 Cloudflare `workers.dev` 新发布关闭；原 Sites 环境仍保留但不作为评审主地址。
- `RISK-002`：匿名 Cookie 可删除以重置 owner 配额；全局分钟桶和 5000 项目总上限作为 Demo 兜底。挑战范围内接受，不作为企业级鉴权方案。
- `RISK-003`：并发/故障注入/迟到完成属于上线强化项，未作为本挑战 Demo 的完成阻塞。
- `RISK-004`：Cloudflare Free 额度和 10ms CPU 上限适合评审 Demo，不承诺高流量生产 SLA。
