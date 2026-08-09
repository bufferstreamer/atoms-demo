# Atoms AI App Builder Demo 实施计划

> 状态：`DRAFT`。每项任务必须关联需求和验证方式。

## 1. 输入与完成定义

输入为冻结 PRD、技术方案和 VibeTest。完成定义是在线环境通过全部 P0/P1 用例并提供链接。

## 2. 外部输入

| 依赖 | 责任方 | 开发替代 | 联调前置 | 发布前置 |
| --- | --- | --- | --- | --- |
| D1 | Sites | 本地 D1 | schema 可迁移 | 托管绑定成功 |
| Hosting | Sites | localhost | 构建通过 | 在线发布成功 |
| Workers AI | Cloudflare | fake AI runner + deterministic fallback | `AI` binding 可调用 Llama 3.1 8B Instruct Fast | 线上出现 `workers_ai/SUCCESS` 审计证据 |

## 3. 实施任务

| TASK | 仓库/模块 | 对应 FR/ADR/Contract | 变更 | 依赖 | 完成定义 | 验证 Case | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TASK-001 | app / design system | FR-001/004, NFR-003, DEC-008, DESIGN-002/004 | 自适应三栏、状态 UI、BUILDING 刷新轮询、输入保留与 AppSpec 白名单交互渲染器 | 无 | 首屏/窄屏可访问；长生成可恢复且不重复提交；筛选、toggle、表单改变可见状态 | VT-001/002/003/008/012/020 | `PENDING` |
| TASK-002 | db / API | FR-002/005, DEC-003/006/007/009, DESIGN-001/003 | D1 schema、owner Cookie/哈希/隔离、限流/容量、项目 API、原子 batch | TASK-001 | 刷新恢复；跨工作区不可读；容量边界可执行 | VT-004/006/010/011/013/014 | `PENDING` |
| TASK-003 | generator | FR-002/003/004, DEC-002/007/009, DESIGN-001/002 | 四阶段规则编排、AppSpec 校验、幂等/并发/超时 run 恢复 | TASK-002 | 不同输入生成不同可交互预览，失败不覆盖 | VT-002/003/006/012/014 | `PENDING` |
| TASK-004 | iteration | FR-006, DEC-003/007/008, DESIGN-002/003 | 修改白名单、base/parent、版本激活、乐观并发 | TASK-003 | 新旧版本均可用，负向路径不改指针 | VT-005/015 | `PENDING` |
| TASK-005 | release | NFR-001/005/006/007, DESIGN-001/003 | 构建、迁移重复执行、在线发布和证据归档 | TASK-001~004 | 在线主流程与关键负向路径通过 | VT-001~015 | `PENDING` |
| TASK-006 | model gateway + db/API/UI | FR-002/003/004/006, NFR-001/002/003/004/005, DESIGN-004 | Workers AI binding、完整 JSON Schema + 服务端严格 envelope、对象/字符串响应适配、真实四角色摘要、与版本原子写入的来源审计、55 秒超时/超大/非法输出降级、UI 来源标识 | TASK-002/003 | 线上至少一次由 Llama 3.1 8B Fast 在 55 秒模型预算/65 秒 E2E 预算内成功生成并持久化；失败不写非法版本且可明确降级；已有 D1 升级后旧项目可读 | VT-016/017/018/019/020 | `PENDING` |
| TASK-007 | orchestrator + db/API/UI | FR-002/003/004/006, NFR-001/002/003/004/005/007, DESIGN-005 | 四次有依赖的模型调用、reserve/execute、runner claim、stage artifact/耗时持久化、一次 Engineering repair、真实轮询进度与可读错误 | TASK-002/006 | 单 run 可证明四次独立调用与上下游输入链；复杂筛选/表单需求优先由模型生成；刷新和并发不重复执行；旧库升级可读；线上四阶段与交互证据齐全 | VT-021/022/023/024，并回归 VT-002/003/004/006/014/016~020 | `PENDING` |

## 4. 开发与联调顺序

1. 新建项目并生成首个可交互版本。
2. 刷新恢复项目与版本。
3. 验证幂等、同项目串行、超时 run 恢复、owner 隔离和容量边界。
4. 继续修改、乐观激活并切换历史版本。
5. 失败保护、窄屏和在线验收。
6. CHG-007 先 reserve 并返回 BUILDING，再 execute 四阶段；在真实轮询中验证阶段、repair、降级与刷新恢复。

## 5. 发布与回滚顺序

迁移 D1 → 构建 → 部署 → 在线冒烟。失败时回滚应用版本；新增 schema 保留，不做破坏性清理。

## 6. 执行门槛

- 范围、设计和验收已冻结。
- 冻结材料已进入 Git 基线。
- 最高风险开放项不阻塞当前切片。
