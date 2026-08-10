# CHG-010 线上生成失败证据

采集时间：2026-08-10；环境：Cloudflare Production；数据源：`atomize-demo-db` 只读查询。

## 用户反馈对应样本

输入需求：

> 创建一个可交互的计数器网页应用：页面显示当前数字，包含“+1”“-1”和“重置”按钮；点击按钮后数字立即变化；刷新后保留数字。

最近两次生成分别记录：

| source | outcome | failure_code | 持久化标题 | 首卡片 | 首动作 |
| --- | --- | --- | --- | --- | --- |
| deterministic | FALLBACK | INVALID_DESIGN_ARTIFACT | Spark 项目看板 | 项目 Alpha | set_filter |
| deterministic | FALLBACK | INVALID_APP_SPEC | Spark 项目看板 | 项目 Alpha | set_filter |

结论：系统没有生成计数器，而是在模型阶段失败后写入与需求无关的固定项目看板。

## 当前样本总体结果

`generation_events` 共 50 条：

- `workers_ai / SUCCESS`：18 条，占 36%。
- `deterministic / FALLBACK`：32 条，占 64%。
- 主要失败码：`INVALID_APP_SPEC` 9、`INVALID_JSON` 5、`INVALID_PRODUCT_ARTIFACT` 4、`MODEL_TIMEOUT` 4、`INVALID_DESIGN_ARTIFACT` 3、`INVALID_ARCHITECTURE_ARTIFACT` 2、`MISSING_REQUIRED_CAPABILITY` 2、`MODEL_ERROR` 2、`INVALID_ENVELOPE` 1。

## 证据边界

- 查询证明生产数据库中的最终来源、失败类别和落库结果。
- 现有审计没有保存被拒绝模型输出或精确字段路径，因此不能从数据库还原每一次 schema 失败的原始字段。
- 本期必须增加不含敏感原文的阶段错误路径和代码包校验原因审计，不能只保存粗粒度失败码。

