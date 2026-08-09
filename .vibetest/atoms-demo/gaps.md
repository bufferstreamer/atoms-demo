# VibeTest Gaps — atoms-demo

| ID | 级别 | 状态 | 缺口/风险 | 后续动作 |
| --- | --- | --- | --- | --- |
| GAP-001 | IMPLEMENTATION | CLOSED | 首版功能已实现并发布 | 历史证据见 `artifacts/verification-*.md` |
| GAP-002 | EXTERNAL | CLOSED | Cloudflare workers.dev 已创建并完成在线验收 | 主地址为 `https://atomize-ai-builder-demo.atomize-demo.workers.dev` |
| GAP-003 | ACCEPTED_RISK | ACCEPTED | 匿名访问者可清除 Cookie 重置 owner 级额度 | D1 全局分钟桶与全站 5000 项目硬上限保护容量；不承诺企业级身份防滥用 |
| GAP-004 | IMPLEMENTATION | OPEN | CHG-005 尚未部署并证明 Llama 真实模型在线成功 | 只有同一部署、同一 requestId/runId 的 `workers_ai/@cf/meta/llama-3.1-8b-instruct-fast/SUCCESS` 同时满足模型 `<55s`、API `<65s`，并写入 `artifacts/chg005-online-model-2026-08-09.md` 才能关闭；GLM 或任意历史 event 均无效 |
| GAP-005 | ACCEPTED_RISK | ACCEPTED | Workers AI 免费日额度耗尽时生成会降级为规则引擎 | UI 明示生成来源；D1 审计区分成功与降级；不影响已有项目和版本读取 |

## 完成声明边界

首版已发布；CHG-005 当前只能声明模型切换在实现中。在取得上述同次 Llama `workers_ai/SUCCESS` 证据前，不能声明真实模型已接通。
