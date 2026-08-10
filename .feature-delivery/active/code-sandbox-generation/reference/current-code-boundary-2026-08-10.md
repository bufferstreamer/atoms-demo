# CHG-010 当前代码能力边界快照

采集时间：2026-08-10；基线提交：`0c7783f48e54f26c982d39688c560e71785318ec`。

## 当前生成协议

- `lib/ai-generator.ts` 要求 Engineering 最终输出 `AppSpec v1`。
- 页面种类只允许 `dashboard`、`tracker`、`landing`。
- 动作只允许 `set_filter`、`toggle_item`、`add_item`、`show_toast`。
- 最终运行时没有通用变量、算术、条件、循环、自定义事件或代码文件概念。

## 当前失败与降级

- Product、Architecture、Design、Engineering 任一阶段异常都会被外层 `catch` 捕获并调用规则降级。
- 只有 Engineering 的部分校验错误具有一次 repair；前三阶段没有独立重试。
- `lib/generator.ts` 的规则降级只识别旅行、健身、客户、读书、发布等少量主题，未命中时固定返回 `Spark / 项目`。
- 规则降级写入合法 version 并呈现为 `deterministic/FALLBACK`，因此技术上透明，但产品结果可能与输入不一致。

## 当前持久化

- D1 已保存 project、workspace request、message、run、run step、version、generation event 和 rate limit。
- `versions.app_spec_json` 保存生成页面配置；版本不可变并带父版本。
- 生成应用内的筛选、toggle、draft、added card、toast 属于 React 临时状态，不是 D1 业务事实；刷新只恢复 AppSpec 初始状态。

## 当前可复用资产

- 三栏工作台、首次生成和继续修改流程。
- 四阶段 Agent 状态与产物审计。
- owner 隔离、幂等、并发锁、超时回收、限流和项目容量保护。
- D1 project/message/run/version 数据链路。
- Cloudflare Workers AI 与公网部署配置。

## 当前不能满足的代表需求

- 计数器、计算器、番茄钟等含通用运行状态和计算逻辑的应用。
- 自定义按钮事件、任意 DOM 结构和自定义 CSS/JavaScript。
- 生成应用自身的数据持久化。
- 第三方 API、任意依赖、独立后端服务或服务端代码执行。

