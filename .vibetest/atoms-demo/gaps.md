# VibeTest Gaps — atoms-demo

| ID | 级别 | 状态 | 缺口/风险 | 后续动作 |
| --- | --- | --- | --- | --- |
| GAP-001 | IMPLEMENTATION | CLOSED | 首版功能已实现并发布 | 历史证据见 `artifacts/verification-*.md` |
| GAP-002 | EXTERNAL | CLOSED | Cloudflare workers.dev 已创建并完成在线验收 | 主地址为 `https://atomize-ai-builder-demo.atomize-demo.workers.dev` |
| GAP-003 | ACCEPTED_RISK | ACCEPTED | 匿名访问者可清除 Cookie 重置 owner 级额度 | D1 全局分钟桶与全站 5000 项目硬上限保护容量；不承诺企业级身份防滥用 |
| GAP-004 | IMPLEMENTATION | CLOSED | CHG-006 已部署并证明 JSON Schema/对象响应路径的 Llama 在线成功 | 同一部署、requestId/runId、55/65 秒预算、D1 与浏览器证据见 `artifacts/chg006-online-model-2026-08-09.md` |
| GAP-005 | ACCEPTED_RISK | ACCEPTED | Workers AI 免费日额度耗尽时生成会降级为规则引擎 | UI 明示生成来源；D1 审计区分成功与降级；不影响已有项目和版本读取 |
| GAP-006 | IMPLEMENTATION | OPEN | CHG-009 forbidden 结构二次校验与无 action 可满足性修复已实现，等待新 commit/Worker 的最终复验 | 旧 `0085c134` / `8d3e1c98` 只保留主链证据；关闭须含新负向测试、新 Worker 同 run 模型/D1/浏览器/版本证据 |

## 完成声明边界

首版与 CHG-006 模型接入均已形成在线证据。声明“模型已接通”仅指至少一次真实 Llama 生成、持久化与浏览器恢复成功；不承诺每个任意复杂提示词都能通过 AppSpec 语义校验，失败时仍会明确安全降级。

真实多 Agent 流水线已在 CHG-009 最终 Worker 上取得同 run 四阶段与 D1/浏览器证据；任意提示词仍可能因严格校验进入透明 fallback，这是已设计的安全边界而非静态伪装。
