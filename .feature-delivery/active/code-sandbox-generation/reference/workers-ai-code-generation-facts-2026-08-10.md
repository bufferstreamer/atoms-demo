# Raw Workers AI Code Generation Facts

采集日期：2026-08-10。以下只记录 Cloudflare 官方模型/平台页面直接支持的事实；builder 选型、CodeBundle 协议、parser、repair 与发布证据属于后续设计，不包装成官方模型事实。

## Qwen2.5-Coder-32B-Instruct

来源：`https://developers.cloudflare.com/workers-ai/models/qwen2.5-coder-32b-instruct/`。

- 模型 ID：`@cf/qwen/qwen2.5-coder-32b-instruct`，Cloudflare-hosted Text Generation。
- 官方说明将 Qwen2.5-Coder 定位为 code-specific large language model。
- context window 为 32,768 tokens。
- 同步接口接受 `messages`、`max_tokens`、`temperature` 等参数，返回 `response: string`。
- 公开页面给出的 `max_tokens` 默认值为 256；页面没有承诺本项目所需的输出长度、响应时间或中文代码生成成功率。
- 单价为每百万 input tokens 0.66 美元、output tokens 1.00 美元；Cloudflare pricing 页对应 60,000 neurons/M input、90,909 neurons/M output。

## Llama-3.3-70B-Instruct-FP8-Fast

来源：`https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/`。

- 模型 ID：`@cf/meta/llama-3.3-70b-instruct-fp8-fast`，Cloudflare-hosted Text Generation。
- context window 为 24,000 tokens；接口接受 `messages`、`max_tokens`、`response_format` 等参数。

## JSON Mode

来源：`https://developers.cloudflare.com/workers-ai/features/json-mode/`，页面最近更新 2026-04-21。

- Workers AI JSON Mode 支持列表包含 Llama 3.3 70B，但不包含 Qwen2.5-Coder-32B-Instruct。
- 官方明确说明 JSON Mode 不能保证满足所给 JSON Schema。
- 极端情况下会返回 `JSON Mode couldn't be met`，调用方必须处理。
- JSON Mode 当前不支持 streaming。

## Capacity and free-plan facts

来源：`https://developers.cloudflare.com/workers-ai/platform/pricing/` 与 `https://developers.cloudflare.com/workers-ai/platform/limits/`，采集日期 2026-08-10。

- Workers AI 对 Free 与 Paid Workers 可用。
- 免费额度为每天 10,000 neurons，UTC 00:00 重置，超额后操作失败。
- text generation 默认公开速率为 300 requests/minute；Beta 或 model-specific limit 可能更低。
- 按 Qwen 官方 neuron 单价换算，7,000 output tokens 约 636 neurons；实际调用总消耗还包含输入 token，免费额度不是无限生成保证。
