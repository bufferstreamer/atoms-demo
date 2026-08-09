# VibeTest Gaps — atoms-demo

| ID | 级别 | 状态 | 缺口/风险 | 后续动作 |
| --- | --- | --- | --- | --- |
| GAP-001 | IMPLEMENTATION | CLOSED | 首版功能已实现并发布 | 历史证据见 `artifacts/verification-*.md` |
| GAP-002 | EXTERNAL | CLOSED | Cloudflare workers.dev 已创建并完成在线验收 | 主地址为 `https://atomize-ai-builder-demo.atomize-demo.workers.dev` |
| GAP-003 | ACCEPTED_RISK | ACCEPTED | 匿名访问者可清除 Cookie 重置 owner 级额度 | D1 全局分钟桶与全站 5000 项目硬上限保护容量；不承诺企业级身份防滥用 |
| GAP-004 | IMPLEMENTATION | CLOSED | CHG-006 已部署并证明 JSON Schema/对象响应路径的 Llama 在线成功 | 同一部署、requestId/runId、55/65 秒预算、D1 与浏览器证据见 `artifacts/chg006-online-model-2026-08-09.md` |
| GAP-005 | ACCEPTED_RISK | ACCEPTED | Workers AI 免费日额度耗尽时生成会降级为规则引擎 | UI 明示生成来源；D1 审计区分成功与降级；不影响已有项目和版本读取 |
| GAP-006 | IMPLEMENTATION | OPEN | CHG-007/008 真实四阶段 Agent、一次修复与实时阶段 UI 尚未取得完整线上证据 | 关闭条件：VT-021~024 与关联回归通过；证据只认 `.vibetest/atoms-demo/artifacts/chg007-multi-agent-2026-08-09.md`，至少包含 commit、CHG-008 后 Worker version、URL、D1 id、requestId/projectId/runId、reserve/execute HTTP 与墙钟、三次 json_object/一次 json_schema 实际格式、四个 canonical schema hash、四行 step 元数据/artifact hash、event/version/current、浏览器 BUILDING/终态/交互/刷新及逐阈值 PASS；同一 run 四份 workers_ai artifact 和 SUCCESS event、复杂筛选+表单及一次修改可操作并刷新恢复、execute `<65s` 才可关闭；CHG-006、pre-CHG008、`e40dafa6`/`06eddb22` 或旧 event 不接受 |

## 完成声明边界

首版与 CHG-006 模型接入均已形成在线证据。声明“模型已接通”仅指至少一次真实 Llama 生成、持久化与浏览器恢复成功；不承诺每个任意复杂提示词都能通过 AppSpec 语义校验，失败时仍会明确安全降级。

CHG-007 完成前不得声明“真实多 Agent 流水线已上线”；旧 CHG-006 证据不能关闭 GAP-006。
