# CHG-010 Code Sandbox Generation - 上下文恢复

## 当前状态

- 生命周期：`DISCOVERY`
- 风险：`high`
- 主仓库：`atoms-demo`
- 最新冻结：无

## 目标

将固定 AppSpec 生成升级为安全的纯前端 CodeBundle 生成，首要关闭计数器需求失败与无关模板 fallback。

## 已确认结论

- 新生成物为 HTML/CSS/JavaScript 代码包，不执行任意服务端代码：`reference/prd.md`。
- D1 项目链路继续复用，新增生成应用状态存储：`scope.md`。
- 计数器 `+1/-1/重置/刷新恢复` 是 P0：`reference/prd.md#2-用户场景`。
- 无关 fallback 被禁止：`reference/prd.md` FR-006。

## 仓库边界

- 可写：`atoms-demo` 单仓代码、D1 schema、Feature Delivery/VibeTest 材料。
- 只读：Cloudflare/Sites 官方契约和已归档旧需求。
- 外部：Workers AI 推理、Sites/Cloudflare 部署运行时。

## 阻塞与下一步

- 当前门禁：完成来源确认、独立来源复核并冻结 scope。
- 非阻塞外部前置：新部署真实 CodeBundle 生成稳定性仅能在实现后验证。
