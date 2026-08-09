# VibeTest Evidence — atoms-demo

## 环境

- Branch/commit：`main` / `131e220`
- Environment：localhost / Cloudflare production
- Date：2026-08-09
- Data used：验收用示例项目

## 结果

| Case/Rule | 工具或操作 | 关键输出 | 结果 | 证明内容 | 不证明内容 |
| --- | --- | --- | --- | --- | --- |
| VT-016 / R14 | lint、TypeScript、10 项测试、production build、schema equality | 全部 exit 0；`SCHEMA_MATCH=true` | PASS | 工程构建、模型适配和冻结 schema 一致 | 不替代平台在线调用 |
| VT-017 / R15 | 固定 requestId 在线 API + D1 join + Cookie refresh | Llama `SUCCESS`；6071ms；HTTP 6.667337s | PASS | 真实模型、来源审计、原子版本与刷新恢复 | 不保证所有提示词均成功 |
| VT-018 / R16/R17 | fake runner 表驱动 + 线上复杂非法语义输出 | 10/10；线上 `FALLBACK/INVALID_APP_SPEC` | PASS | 非法/超大/对象响应不能绕过校验，降级透明 | 未在线故障注入 D1 batch 失败 |
| VT-020 / R1/R2/R8/R11/R18 | 真实应用内浏览器生成、点击、reload | disabled `构建中`；`AI · LLAMA`；toast；刷新恢复 | PASS | 等待体验、真实交互、在线可用、持久化 | 不代表高并发容量测试 |
| 历史 VT-002/004/005/009/010 | Cloudflare 首版在线浏览器/API | 生成、筛选、修改、版本、双 Cookie | PASS | 首版主流程、延展能力与 owner 隔离 | 不是 CHG-006 模型证据 |

## 汇总

- Cases：Passed 10 / Failed 0 / Not run 10
- Rules：Passed 12 / Failed 0 / Not run 6
- 总体状态：PASS_WITH_ACCEPTED_RISKS（未执行项为并发/容量/人工故障注入强化项，不阻塞公开 Demo；GAP-003/005 已明确接受）
