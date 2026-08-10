# CHG-010 Code Sandbox Generation 实施计划

> 状态：`CONFIRMED_FOR_DESIGN_FREEZE`。独立复核：`codex-independent-chg010-design-reviewer-r4`；执行前仍必须完成 acceptance freeze 与 Git baseline。

## 1. 输入与完成定义

- 产品输入：冻结 `reference/prd.md`、`scope.md`、S012 兼容决定。
- 技术输入：`design/technical-design.md` 的 DESIGN-101~111、CONTRACT-101~106。
- 验收输入：`.vibetest/code-sandbox-generation/{rules,cases,evidence,gaps}.md`（待 acceptance freeze）。
- 完成必须同时满足：代码/迁移/测试通过，真实 Qwen 代码包成功，计数器与 10 条语义基准、D1 storage、旧 AppSpec、在线浏览器闭环，GitHub Public 与 Cloudflare 主链接指向同一 production commit。

## 2. 外部输入

| 依赖 | 责任方 | 开发替代 | 联调前置 | 发布前置 |
| --- | --- | --- | --- | --- |
| Workers AI Llama/Qwen | Cloudflare | strict fake runner + recorded protocol fixtures | 远程 binding 精确模型可调用 | Qwen SUCCESS event + usage/时延 |
| D1 | Cloudflare/Sites | 本地 D1/adapter fixture | additive migration | production schema/state 回查 |
| 托管与域名 | Cloudflare | production build | Worker dry run | 主 URL 浏览器验收 |
| GitHub Public | GitHub | 本地 commit | push 权限 | main/production SHA 对齐 |

## 3. 实施任务

| TASK | 仓库/模块 | 对应 FR/DESIGN/Contract | 变更 | 依赖 | 完成定义 | 验证 Case | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TASK-101 | `lib/types.ts`, `lib/code-bundle.ts` | FR-002/003/007/008; DESIGN-102/104/111 | CodeBundle/Version union、严格 sentinel grammar、HTML/CSS/JS/跨文件校验、counter compiler | none | validator 正反矩阵；无非法 bundle 可入库；counter 只命中冻结 grammar | VT-101/102/103/108/112 | PENDING |
| TASK-102 | `lib/ai-generator.ts` | FR-002/006/008; DESIGN-103/107/109/111 | 单次 combined canonical planner、deterministic planner、单次 Qwen builder、最多一次 repair、52s model deadline、usage/audit meta | TASK-101 | 精确调用数/模型/format/顺序/timeout；generic failure 不产无关版本；counter outcome 语义一致 | VT-108/110/112 | PENDING |
| TASK-103 | `db/schema.ts`, `lib/store.ts` | FR-002/004/005/006; DESIGN-106/107/109/110; CONTRACT-101/102/103/106 | artifact_kind、audit/expiry/rate 列表、active unique index、原子 completion/failure、activate/base guard、旧行读取 | TASK-101/102 | 空/旧库重复并发升级；transition 并发唯一；迟到/失败不移动 pointer | VT-107/109/110/113 | PENDING |
| TASK-104 | storage route + store | FR-004; DESIGN-105/110; CONTRACT-104/105 | exact RPC/API、owner/project 同语句授权、get/set/list/delete/clear、容量与原子 rate ledger | TASK-103 | key/value/count/bytes/owner/rate 正反边界和 D1 回查 | VT-104/105/106 | PENDING |
| TASK-105 | `app/workspace.tsx`, sandbox components/CSS | FR-001/003/004/005/007/009; DESIGN-101/104/105/106/111 | preview/code tabs、base64 srcdoc、opaque iframe、CSP/bridge/error reset、AppSpec fallback、source UI | TASK-101/104 | counter 点击/刷新、copy code、旧版本切换、失败保留 input、deterministic 透明标识 | VT-101/104/107/111/115 | PENDING |
| TASK-106 | tests + VibeTest runners | FR-006/008; NFR-002/003/004/005/006; DESIGN-104/109/110/111 | unit/API/D1/component/browser safety、冻结 10-prompt matrix、fake clock/transition/真实 model evidence protocol | TASK-101~105 | build/type/lint/test 和 VT required 全通过；边界与 prompt hash 不可移动 | VT-101~116 | PENDING |
| TASK-107 | README/architecture/release | NFR-001/002/004/006; DESIGN-108/109/111 | 能力边界、架构、运行、证据、限制、deadline、语义 gate、回滚、AI 工具说明 | TASK-106 | 文档与真实 SHA/URL/证据一致 | VT-116 | PENDING |
| TASK-108 | Cloudflare + GitHub | NFR-001/002/005/006; DESIGN-108/109 | migration/deploy/online QA/push public | TASK-106/107 | production/GitHub SHA 对齐，GAP 全关 | VT-115/116 | PENDING |

## 4. 垂直实施顺序

1. CodeBundle parser + counter compiler + union types，先让纯函数测试覆盖正负协议。
2. D1 union/状态表/原子完成，使用 fake runner 打通 API 生成与存储。
3. SandboxPreview + parent bridge，完成计数器真实点击/刷新垂直切片。
4. 单次 combined Llama planning、Qwen builder/repair 与三个可独立展示的 planning artifact，关闭无关 template fallback。
5. 旧 AppSpec 与继续修改/版本切换兼容。
6. 安全/容量/并发/迟到/迁移/语义矩阵回归。
7. 文档、生产 migration、真实模型、浏览器、D1、GitHub/Cloudflare 交付。

## 5. 发布与回滚顺序

- 发布：build/test → 本地旧库迁移 → compatibility switch 默认关闭的预部署 → production migration/read smoke → 开启生成 → Qwen/语义/storage/旧版本浏览器验收 → push/tag/release 记录。
- 回滚：关闭 `CODE_BUNDLE_GENERATION_ENABLED` → 部署同 schema compatibility build → 验证两类 artifact 可读与 D1 无删除。禁止回滚到不认识 `artifact_kind=code_bundle` 的旧 Worker。

## 6. 执行门槛

- scope/design/acceptance 均冻结，baseline commit 已登记。
- OQ-005 只阻塞 staging/release，不阻塞本地实现；最终无法取得 Qwen SUCCESS 时不得声明 released。
- 业务代码修改仅在 `atoms-demo`；不修改通用 Feature Delivery/VibeTest skills。
