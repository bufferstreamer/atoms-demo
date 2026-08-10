# VibeTest Rules — code-sandbox-generation

> 基线状态：`CONFIRMED_FOR_ACCEPTANCE_FREEZE`。独立复核：`codex-independent-chg010-acceptance-reviewer-r2`。未实现、未部署前全部为 `PENDING`，不得沿用 CHG-009 或更早证据。

## 变更类型

- [x] 纯函数 / parser / validator / mapping
- [x] DTO / API / postMessage contract
- [x] 前端提交、轮询、页签与 iframe 交互
- [x] D1 schema、版本、run 状态与应用状态写入
- [x] 异步/background terminalPromise
- [x] 历史缺陷回归：计数器生成失败后返回无关看板
- [x] 匿名 owner 权限、容量与公开部署

## 必测规则

| Rule | 必须证明 | 工具 | 状态 |
| --- | --- | --- | --- |
| R101 主流程 | 需求生成真实 CodeBundle，计数器可点击且刷新恢复 | API + D1 + 真实浏览器 | PENDING |
| R102 协议边界 | sentinel、exact meta、三文件、UTF-8 与字节边界无歧义 | 表驱动单测 | PENDING |
| R103 静态安全 | 危险 HTML/CSS/JS、marker/raw-text 绕过均不得入库 | validator + D1 回查 | PENDING |
| R104 沙箱隔离 | iframe 仅 allow-scripts；CSP、opaque origin、base64 bootstrap 与消息校验有效 | 组件 + 真实浏览器 | PENDING |
| R105 Storage 契约 | exact RPC/API、owner guard、JSON/key/count/bytes 边界正确 | API + 临时 D1 | PENDING |
| R106 原子限流/隔离 | 同 owner/global 并发不可越限；他人项目不可探测或写入 | 并发 API + 双会话 + D1 | PENDING |
| R107 历史兼容 | 旧 AppSpec 可读/切换；继续修改创建 CodeBundle 子版本且历史不变 | 旧库 fixture + API + 浏览器 | PENDING |
| R108 模型协议 | 精确一次 combined planning、一次 Qwen，最多一次 repair；来源真实 | runner spy + 线上 D1 | PENDING |
| R109 事务单胜者 | active run 唯一，null-safe base、completion/failure/activate 互斥 | 并发 D1 集成 | PENDING |
| R110 截止与恢复 | 52/62/65、watchdog、expired lease、202 FINALIZING 和迟到写闭环 | fake clock + barrier + D1 | PENDING |
| R111 失败原子性 | 非计数器失败不写无关版本；batch 失败保留 user message/上一版本 | 故障注入 + D1 回查 | PENDING |
| R112 语义质量 | 固定十条至少 9/10，计数器 2/2 且至少一条 Qwen SUCCESS | 线上 runner + browser matrix | PENDING |
| R113 UI 可用性 | 生成中输入保留/禁重、刷新只轮询、预览/代码/复制/错误重置可用 | 组件 + 浏览器 | PENDING |
| R114 工程质量 | lint/type/build/test、空库/旧库/并发 migration 可重复 | 本地命令 + D1 | PENDING |
| R115 在线可用 | 新 production commit 上 API、模型、交互、D1、双 owner 全链路 | Cloudflare + 浏览器 | PENDING |
| R116 可交付性 | README/架构/限制/回滚/证据、GitHub Public 与 production SHA 对齐 | 文档 + GitHub + Cloudflare | PENDING |

## 证据门禁

- PASS 必须指向本次 CHG-010 commit、Worker version、requestId/runId/projectId 与可重复命令；pre-CHG-010 artifact 只能作为回归输入。
- HTTP 200、页面可打开或静态代码存在均不能单独关闭 R101/R105/R112/R115。
- 任一 P0/P1 GAP OPEN 时，下一步优先关闭该 GAP；无法执行必须写明残余风险，不能把 PENDING 改为 PASS。
- 线上模型门禁只接受 `artifact_kind=code_bundle` 且同 run 的 planning/Qwen/step/version/generation_event/deadline_audit 闭环。

## 明确豁免与残余风险

| 不执行能力 | 原因 | 残余风险 |
| --- | --- | --- |
| 蓄意构造的全部浏览器 CPU/内存攻击证明 | Demo 无浏览器级硬配额 | 静态 loop 拒绝、iframe reset 与生成开关降低风险，但不宣称完全隔离 |
| 外部网络/OAuth/支付/Webhook | 产品明确不在本期 | 生成器与 CSP 必须拒绝，不能作为部分成功展示 |
