# VibeTest Cases — atoms-demo

| ID | 评分维度 | 场景 | 操作 | 预期结果 | 状态 |
| --- | --- | --- | --- | --- | --- |
| VT-001 | 完成度 | 首次进入 | 打开页面并选择示例需求 | 可直接进入工作区 | pending |
| VT-002 | 完成度/创新性 | 创建应用 | 输入“个人旅行计划看板”并生成，依次选择具体状态与 allValue“全部”，再操作卡片按钮 | Agent 四阶段完成；具体筛选缩小卡片集，“全部”恢复全集，按钮改变可见状态 | PASS |
| VT-003 | 创新性 | 差异化生成 | 分别生成旅行看板和发布清单，操作各自筛选/表单/toggle | AppSpec kind、布局、组件、文案和交互存在实质差异 | pending |
| VT-004 | 完成度 | 持久化 | 生成后刷新 | 项目、对话、版本与预览恢复 | PASS |
| VT-005 | 创新性 | 继续修改 | 基于当前版本要求切换珊瑚色并增加统计卡片，再激活旧版本 | 新版本记录 parent，旧版本不可变且可切换 | PASS |
| VT-006 | 稳定性 | 生成失败 | 模拟 AppSpec 或持久化失败 | run 标为失败；四阶段错误可读；保留上一成功版本并允许重试 | pending |
| VT-007 | 用户体验 | 空与边界输入 | 提交空输入和超长输入 | 禁止提交或给出明确反馈 | pending |
| VT-008 | 用户体验 | 窄屏可访问性 | 在窄屏视口打开已生成项目 | 关键内容可见，输入和预览可访问 | pending |
| VT-009 | 可交付性 | 在线验收 | 访问发布链接执行 VT-002/004/005，并用两个独立浏览器会话执行 VT-010 | 在线生成、刷新、修改/版本与 owner 隔离全部通过 | PASS |
| VT-010 | 安全性 | 工作区隔离 | 使用两个独立 Cookie 会话访问同一项目 ID；丢失 Cookie 后重试；伪造 owner 字段 | 均不能读取或修改原项目，响应不泄露项目存在性 | PASS |
| VT-011 | 稳定性/容量 | 滥用与输入边界 | 提交超长/控制字符；同 owner 跨两客户端快速生成 7 次；不同 Cookie 合计触发全局测试阈值；创建到 owner/global 项目上限 | 分别 400/429/409或503；窗口恢复后可用；不淘汰已有数据 | pending |
| VT-012 | 完成度 | 预览恢复 | 向渲染器传未知 schema、悬空 action、set_filter 非法 value、allValue 不在 options 或越界 AppSpec | 服务端拒绝写入；客户端保留上一预览并显示恢复操作 | pending |
| VT-013 | 稳定性 | 读取失败 | 模拟 workspace/project GET 500 后重试 | 当前画面和输入不清空；错误明确；重试成功恢复 | pending |
| VT-014 | 工程质量 | 幂等、并发与中断 | 首次建项目分别在 workspace_request 为 RUNNING/COMPLETED/FAILED 时重放同一 owner+requestId；两个请求并发相同 requestId；已有项目重放 requestId；并发生成与版本激活；把 RUNNING 回收后模拟迟到完成 | RUNNING 返回202同一项目、COMPLETED返回同一快照、FAILED返回同一错误且均不新建；相同 requestId 只有一个 reservation 且 AI runner 只调用一次；已有项目只一版；生成期间激活409且 AI 调用为0；超时后 run/request/steps 失败、token 清空、project 有版本回 READY/无版本为 FAILED；迟到 batch 不插 version/event、不移动指针 | pending |
| VT-015 | 稳定性 | 修改负向路径 | 提交不支持修改、过期 base、错误 versionId 与并发激活 | 返回 422/409/404；不写新版本、不改 current，历史 JSON 不变 | pending |
| VT-016 | 工程质量 | 构建、类型与迁移 | 执行类型检查、生产构建；对空本地 D1 连续执行 schema 初始化两次；再用包含首版 project/run/version 的旧库执行升级并读取旧项目 | 全部退出 0；第二次初始化无错误；新增 `generation_events` 后旧项目/版本仍可读且旧 run 可无 event | PASS |
| VT-017 | 创新性/完成度 | 真实模型生成 | 注入成功的 AI binding，随后在线提交一个未命中旧模板的具体需求并查询项目快照与 D1 审计 | 四阶段模型墙钟均在各自 7/9/7/22 秒内且总模型路径 `<52000ms`，generation completion `<62000ms`、execute API `<65000ms`；AppSpec/阶段摘要来自模型，event 为 `workers_ai/SUCCESS`；刷新恢复 | PASS |
| VT-018 | 稳定性 | 模型失败安全降级 | 分别注入 binding 缺失、抛错、超时、空响应、超过 48 KiB、非法 JSON、额外字段、错误类型、超长摘要、错误/重复角色、非法 AppSpec，以及 event/completion/failure batch 异常 | 可降级场景由确定性生成器完成并审计 `deterministic/FALLBACK`；completion 失败时不产生 version/event/current/assistant 成功消息，预占 run/request/steps 进入 FAILED、token 清空、project 恢复 READY 或 FAILED，阶段一 user message 保留；失败码不含 prompt/原始响应 | PASS |
| VT-019 | 安全性/兼容性 | 结构化输出与版本迭代 | 模型基于当前版本生成修改版；再返回悬空 action/越界数组 | 合法修改创建 parent version；非法输出不直接入库而走受校验的降级；旧版本 JSON 不变且 UI 只渲染白名单 | PASS |
| VT-020 | 用户体验/稳定性 | 长生成等待与刷新 | 用 barrier fake runner 或线上慢调用启动生成；等待中检查 UI，刷新页面，并用同 requestId 重放；完成后观察来源 | spinner/BUILDING 持续，composer 原文保留、提交禁用；刷新只轮询同一 project；重放不产生新 run/AI 调用；READY/FAILED 后停止 timer 并展示真实来源或降级原因 | PASS |
| VT-021 | 创新性/工程质量 | 真实四阶段 Agent 链 | fake runner 为四个 schema 返回唯一产物并记录调用；在线生成后回查 step/event/version | 精确四次独立调用且顺序为 product→architecture→design→engineering；每次下游输入含前序已验证 artifact；四个 step 保存来源、模型、耗时、attempt 与安全 artifact；同 run 最终只有一个 version/event | PASS |
| VT-022 | 用户体验/完成度 | reserve 后实时进度、刷新与终态 | 提交后立即取得 BUILDING project；execute pending 时轮询并在中途刷新；分别完成 AI/fallback/FAILED | reserve 本身不调用 AI；页面至少观察到两个不同中间阶段，摘要/耗时来自 D1；刷新不 POST、不丢输入、不换 run；终态停止轮询并展示真实来源或可读错误 | PASS |
| VT-023 | 完成度/稳定性 | 复杂需求遵循、规范化与一次修复 | Product 提取筛选+表单要求；分别返回可安全规范化关系、required/forbidden 冲突、不可规范化缺能力、第二次合法/失败 | 可规范化组合四次调用且 artifact/UI 明示 normalization codes；冲突只调用 Product；不可规范化首例恰好五次调用且 repair 使用枚举错误/同一上游 artifact，最终 workers_ai/SUCCESS、attemptNo=2；二次失败不再调用模型，安全 fallback 或 FAILED，不写非法版本 | PASS |
| VT-024 | 工程质量 | 两段幂等、并发 claim、回收与旧库升级 | 同 requestId 并发 reserve/execute；重复 execute；模拟执行中断/迟到；从 CHG-006 schema 升级两次 | 仅一个 project/run/claim，四阶段各调用一次；重复 execute 只回读；2 分钟后 run/steps/project/request 收敛且迟到不能写；新增列齐全、重复迁移无错、旧项目可读 | pending |

## 可重复执行协议

### 冻结计划补充映射

`implementation-plan.md` 已在 VT-016 由验收审查新增前进入设计冻结。为保证新增用例受 acceptance hash 保护，本文件将 VT-016 正式接入 `TASK-005`、`NFR-001` 与 `NFR-005`；TASK-005 的完成定义增加“类型检查、生产构建和本地 D1 schema 连续初始化两次均通过”。该补充不改变任务范围或技术设计。

- VT-006：不暴露线上故障开关。单元/集成测试通过 orchestrator 构造参数注入 `validatorFailure` 与 `dbBatchFailure` 两种 adapter；使用临时本地 D1 先创建一个成功版本，执行失败后查询 `runs.status/error_code`、version 数量与 `projects.current_version_id`，断言失败 run 可见且版本数/指针不变。每个用例创建唯一 owner/project，测试结束删除临时数据库目录，不操作线上数据。
- VT-011：服务层的 limiter 接收只在测试构造中可覆盖的 `LimitConfig`；本地集成将 owner/global generate 设为 2/3、owner/global projects 设为 2/3，在两个 Cookie 会话中逐次提交并回查 `rate_limits(bucket_key,window_start,action,count)` 与项目数量。生产代码使用冻结默认值 6/120、20/5000，且无 HTTP 参数可覆盖。测试使用临时 D1，结束后删除整个临时目录。
- VT-012：直接对 `validateAppSpec` 表驱动测试未知 schema、悬空 target、非法 value、非法 allValue、重复 ID 与数组越界；再用临时 D1 走一次 generate service，回查 version 数量与 current pointer 不变。浏览器只验证可读错误和上一预览保留。
- VT-013：客户端 API 层接受测试 fetch adapter。组件测试让第一次 workspace GET 返回固定 500、第二次返回已保存 snapshot，断言输入 DOM value、预览标题与 project id 在失败期间不变且重试恢复；不通过公开查询参数触发。
- VT-014：临时 D1 预置 workspace_requests 三种状态并逐一重放。并发幂等测试使用同一 owner + 同一 requestId，两次 Promise 在 fake AI runner 的 barrier 前同时提交；runner 维护调用 counter，释放 barrier 后断言 counter=1、`workspace_requests(owner_key,request_id)` 仅一行、仅一个 run/version/event，rate bucket 只按一次预占计数。另用两个不同 requestId 测 PROJECT_BUSY。超时测试把 run.updated_at 回拨 3 分钟后 GET project，再模拟原 attempt token 的 guarded completion batch；分别覆盖已有 current version 和首次无版本，最终 SQL 回查 project.status、run/request/step status/error、attempt_token、version/event 数量与 current pointer。每例独立数据库，结束删除临时目录。
- VT-015：先保存所有 versions 的 `app_spec_json` 和 current pointer，再依次执行四类负向请求，最后逐字对比 JSON、版本计数与指针。
- VT-016：schema 初始化函数必须使用 `CREATE ... IF NOT EXISTS`/幂等索引；在同一空本地 D1 连续调用两次后查询 `sqlite_master`。另建首版 schema 和一组 project/run/version fixture，执行新版初始化后通过真实读取函数恢复旧项目，断言旧 run 缺 event 不影响读取。随后运行 TypeScript no-emit 与 production build。临时数据库目录在证据收集后删除。
- VT-017：当前证据必须来自部署 CHG-009 后同一 commit/Worker version，并写入 `chg007-multi-agent-2026-08-09.md`。除 execute/step/event 时延和四个 workers_ai step 外，artifact 必须记录 Product/Architecture/Design 实际 `response_format=json_object`、Engineering=`json_schema`、四个 canonical schema SHA-256、动态 Engineering 约束差异与生产构建 SHA；任一缺失即失败。随后刷新 API 恢复。CHG-006/007/008 artifact、pre-CHG009 artifact、Worker `e40dafa6`/`06eddb22`/`26733709` 或其历史 event 均不能通过当前 VT-017。
- VT-018：当前 staged adapter 接受测试 runner、fake monotonic clock 和 timeout 覆盖，生产常量精确断言 52/62/65 秒及阶段上限。成功 spy 对 Product/Architecture/Design 断言 `json_object` 且 system 内含对应 canonical schema，Engineering 断言 `json_schema` 与完整 AppSpec schema；无 GLM 遗留参数。让前三阶段平台抛 `JSON Mode couldn't be met`，断言映射 `JSON_MODE_UNMET`、不泄露原文并安全 fallback；非法/超限、timeout、原子回滚、迟到、限流/容量/busy/重放零 AI 调用等既有回归全部保留。
- VT-019：先用 CHG-009 兼容格式完成初版，再以当前 AppSpec 为 previous 执行修改链；spy 断言前三阶段仍是 json_object+canonical schema、Engineering 是 json_schema 且 context 含 current AppSpec。表驱动覆盖 default/allValue、filterValues、action target/value、required/forbidden capability 和 `null/undefined` 备注；只允许白名单规范化，随后 validator 必须通过。合法或透明降级修改创建 parent version，非法引用/数组不能直接入库，历史 JSON 不变；浏览器回归筛选/表单/toggle。
- VT-020：组件测试注入不会立即 resolve 的 generate fetch，断言 textarea value 不变、button disabled、BUILDING 文案和 spinner 可见。分别以同一 project/user message 的 BUILDING snapshot 初始化组件，断言刷新后 textarea 从最后一条 user message 恢复；使用可计数 fetch 覆盖三条序列：`BUILDING→BUILDING→READY(workers_ai/SUCCESS)`、`BUILDING→READY(deterministic/FALLBACK/MODEL_TIMEOUT)`、`BUILDING→FAILED(GENERATION_FAILED，无 event/version/assistant 成功消息)`。断言约 1.5 秒轮询、全程没有 POST、终态后不再 GET；AI READY 展示 `AI · LLAMA` 并清空 composer，fallback READY 展示 `FALLBACK` 和 `MODEL_TIMEOUT` 可读原因并清空 composer，FAILED 只展示 error_code/重试入口且保留可重试输入，不伪造 generation 来源。API 并发复用 VT-014 的同 requestId barrier/counter 证明刷新/重放不触发第二次 AI。真实浏览器在部署版本上启动一次生成，等待期间截图/DOM 记录 spinner、BUILDING、textarea value、disabled button，完成后记录来源标识；浏览器证据不得用源代码断言替代。
- VT-021：runner spy 导入生产 `STAGE_SCHEMAS` 与 `APP_SPEC_SCHEMA`。静态断言前三阶段 `response_format.type=json_object` 且 system message 各自只含对应 canonical schema 的完整序列化对象；Engineering 使用 `json_schema`、`properties.spec === APP_SPEC_SCHEMA`。调用严格串行并验证上下游哨兵、step/artifact；逐阶段非法/重复/超限矩阵仍断言下游 counter=0。线上结果写入固定 CHG-007 artifact。
- VT-022：仅本地组件测试注入模块级 fetch adapter；production build 通过静态断言不存在 test-runner binding、查询参数、header 或公开故障开关。fake reserve POST 立即返回 BUILDING，execute POST 由 barrier 持有，GET 序列返回 `product RUNNING`、`product COMPLETED/architecture RUNNING`、终态；断言 projectId、1.5 秒轮询、真实摘要/耗时与刷新只 GET。线上不注入 runner：浏览器记录实际可观察阶段（模型过快允许只看到 BUILDING→READY）、同一 runId、终态来源、筛选/表单操作及刷新；真实四阶段逐步证据以 D1 `updated_at/duration/artifact` 关闭，不用测试模式冒充线上模型。
- VT-023：除既有 52/62/65 fake-clock 与五调用 repair 临界组外，增加 CHG-009 组合矩阵：required/forbidden 同能力冲突在 Product 后停止；required filter/form/stats + forbidden toggle 的 Engineering 返回无效 default/allValue/filterValues、`null` delta、缺 set_filter/add_item，断言仅四调用、补出的 filter action 使用非 all value、AppSpec 再验证通过，artifact 精确记录 `normalized=true` 和唯一枚举 codes，UI 展示“已安全规范化”；无变化返回 `normalized=false/codes=[]`；缺目标组件、动作已满或 schema 外字段不得规范化而进入 repair/fallback。正常 repair：前三阶段和首次 Engineering 共推进到 43,000ms，第一次校验失败，repair timeout=`min(7,000,9,000)=7,000ms` 并于 50,000ms 合法返回；completion/回查于 58,000ms 完成，响应于 59,000ms，断言五调用/attempt=2/SUCCESS。其余临界、回滚和迟到断言保持不变。
- VT-024：临时 D1 用 Promise barrier 并发相同 owner+requestId 的两次 reserve 与三次 execute；runner 为每个 stage 维护 counter，断言 reserve counter=0、execute 后每阶段 counter=1，ledger/project/run/version/event 各一。重复 execute 在 RUNNING/COMPLETED/FAILED 均不新增调用。中断测试在一个 step=RUNNING、一个=COMPLETED、其余=PENDING 时将 claimed run 回拨 3 分钟后 GET，再让旧 promise resolve；断言 RUNNING/PENDING 均 FAILED/RUN_TIMEOUT、COMPLETED artifact 保留、token 清空、project/request 收敛且迟到不能改 step/version/event/current。迁移测试用两个并发 ensureSchema barrier 强制二者都在 ALTER 前读到缺列，允许其中一个收到 duplicate-column 后回读成功；随后第三次初始化，断言精确列集合与旧项目读取。线上记录写入固定 CHG-007 artifact。
