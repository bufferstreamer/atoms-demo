# Cloudflare Workers AI 模型事实快照

采集日期：2026-08-09。用于 CHG-003、CHG-005 与 CHG-006 的模型选择、费用、结构化输出和绑定契约复核。

## 官方受控链接

- Workers AI pricing: `https://developers.cloudflare.com/workers-ai/platform/pricing/`
- GLM-4.7-Flash: `https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/`
- Llama 3.1 8B Instruct Fast: `https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fast/`
- JSON Mode: `https://developers.cloudflare.com/workers-ai/features/json-mode/`
- Kimi K2.7 Code: `https://developers.cloudflare.com/workers-ai/models/kimi-k2.7-code/`

## 当日核对事实

- Workers AI Free 与 Paid 计划均包含每日 10,000 Neurons 免费 allocation；免费计划超过该 allocation 后请求失败，不能产生超额账单。
- `@cf/zai-org/glm-4.7-flash` 为 Cloudflare-hosted 多语言模型，支持 function calling 与 reasoning；上下文 131,072 tokens；页面列价为输入 `$0.06/M tokens`、输出 `$0.40/M tokens`。其模型页未标记 paid-only。
- `@cf/meta/llama-3.1-8b-instruct-fast` 是 Cloudflare-hosted 的 Llama 3.1 8B Fast 版本；官方 JSON Mode 支持列表明确包含该模型，输入参数使用 `max_tokens`。其职责限定为生成受严格校验的 AppSpec envelope。
- 官方 JSON Mode 示例在需要结构约束时使用 `response_format.type=json_schema` 并直接传有效 JSON Schema；示例同步响应的 `response` 是已解析对象。官方同时声明 schema 不保证绝对满足，因此服务端二次校验和安全降级必须保留。
- 线上 Worker versions `9ae2badf`、`daa750b2`、`c46db79b` 与 `8b58a341` 对 GLM 的实测分别在 25/25/25/55 秒进入 `MODEL_TIMEOUT`；因此 CHG-005 切换 Fast 模型，不再继续扩大用户等待预算。
- `@cf/moonshotai/kimi-k2.7-code` 页面明确显示 `Paid access required`，并说明标准 Workers Free billing 不可用，需升级 Workers Paid 或使用预付 AI Gateway credits；因此本次免费账户不采用。
- GLM、Llama 与 Kimi 均通过 Worker `AI` binding 的 `env.AI.run(model, input)` 调用；CHG-003/005/006 不需要第三方 API Key。本期生产选择 Llama，GLM 超时记录和 Kimi 费用事实仅保留为选型依据。

## 设计边界

模型目录、价格和计划可用性可能变化。发布验收必须以实际 `AI` binding 调用和 `generation_events` 成功记录为准；本快照不能替代线上调用证据。
