# VibeTest Rules — atoms-demo

## 变更类型

- UI 页面、按钮与多状态交互
- API 请求与响应
- D1 写入与版本状态迁移
- 公开在线发布

## 必测规则

| Rule | 原因 | 工具 | 状态 |
| --- | --- | --- | --- |
| R1 主流程产生真实可交互应用 | 挑战核心要求 | API + 浏览器 | pending |
| R2 项目、消息和版本刷新后恢复 | 持久化要求 | API + D1 + 浏览器 | pending |
| R3 失败不覆盖上一成功版本 | 稳定性要求 | API/单测 | pending |
| R4 不同提示词产生可观察差异 | 证明非静态演示 | 单测 + 浏览器 | pending |
| R5 修改产生新版本且历史可切换 | 延展能力 | API + 浏览器 | pending |
| R6 空、超长或不支持输入有明确反馈 | 边界体验 | 单测 + 浏览器 | pending |
| R7 桌面和窄屏关键内容可访问 | 用户体验 | 浏览器 | pending |
| R8 在线地址完整跑通 | 可交付性 | 在线浏览器 | pending |
| R9 项目读写按服务端 owner key 隔离 | 公开匿名安全边界 | API + 双 Cookie 会话 | pending |
| R10 输入与请求频率受控 | 稳定性与容量 | API/单测 | pending |
| R11 AppSpec v1 白名单校验且交互改变可见状态 | 真实交互与安全 | 单测 + 浏览器 | pending |
| R12 生成幂等、同项目串行、超时 run 可恢复 | D1 一致性 | API/单测 | pending |
| R13 版本不可变且负向修改不移动指针 | 迭代稳定性 | API/单测 | pending |
| R14 类型、生产构建与幂等迁移通过 | 基本工程质量 | TypeScript + build + 本地 D1 | pending |
| R15 生产生成由真实模型完成且来源可审计 | 避免规则模板冒充智能体 | fake binding 单测 + Cloudflare AI/D1/在线 API | pending |
| R16 模型错误、超时和非法 JSON 安全降级 | 外部模型不稳定且输出不可信 | 单测 + 在线/本地 API | pending |
| R17 模型输出仍受 AppSpec 白名单约束 | 防止执行任意代码或写入非法版本 | 表驱动单测 + D1 回查 | pending |
| R18 长生成等待可恢复且不重复调用 | 55 秒模型预算必须仍可用 | 组件测试 + 并发 API + 浏览器 | pending |
