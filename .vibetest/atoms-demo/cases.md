# VibeTest Cases — atoms-demo

| ID | 评分维度 | 场景 | 操作 | 预期结果 | 状态 |
| --- | --- | --- | --- | --- | --- |
| VT-001 | 完成度 | 首次进入 | 打开页面并选择示例需求 | 可直接进入工作区 | pending |
| VT-002 | 完成度/创新性 | 创建应用 | 输入“个人旅行计划看板”并生成，依次选择具体状态与 allValue“全部”，再操作卡片按钮 | Agent 四阶段完成；具体筛选缩小卡片集，“全部”恢复全集，按钮改变可见状态 | pending |
| VT-003 | 创新性 | 差异化生成 | 分别生成旅行看板和发布清单，操作各自筛选/表单/toggle | AppSpec kind、布局、组件、文案和交互存在实质差异 | pending |
| VT-004 | 完成度 | 持久化 | 生成后刷新 | 项目、对话、版本与预览恢复 | pending |
| VT-005 | 创新性 | 继续修改 | 基于当前版本要求切换珊瑚色并增加统计卡片，再激活旧版本 | 新版本记录 parent，旧版本不可变且可切换 | pending |
| VT-006 | 稳定性 | 生成失败 | 模拟 AppSpec 或持久化失败 | run 标为失败；四阶段错误可读；保留上一成功版本并允许重试 | pending |
| VT-007 | 用户体验 | 空与边界输入 | 提交空输入和超长输入 | 禁止提交或给出明确反馈 | pending |
| VT-008 | 用户体验 | 窄屏可访问性 | 在窄屏视口打开已生成项目 | 关键内容可见，输入和预览可访问 | pending |
| VT-009 | 可交付性 | 在线验收 | 访问发布链接执行 VT-002/004/005，并用两个独立浏览器会话执行 VT-010 | 在线生成、刷新、修改/版本与 owner 隔离全部通过 | pending |
| VT-010 | 安全性 | 工作区隔离 | 使用两个独立 Cookie 会话访问同一项目 ID；丢失 Cookie 后重试；伪造 owner 字段 | 均不能读取或修改原项目，响应不泄露项目存在性 | pending |
| VT-011 | 稳定性/容量 | 滥用与输入边界 | 提交超长/控制字符；同 owner 跨两客户端快速生成 7 次；不同 Cookie 合计触发全局测试阈值；创建到 owner/global 项目上限 | 分别 400/429/409或503；窗口恢复后可用；不淘汰已有数据 | pending |
| VT-012 | 完成度 | 预览恢复 | 向渲染器传未知 schema、悬空 action、set_filter 非法 value、allValue 不在 options 或越界 AppSpec | 服务端拒绝写入；客户端保留上一预览并显示恢复操作 | pending |
| VT-013 | 稳定性 | 读取失败 | 模拟 workspace/project GET 500 后重试 | 当前画面和输入不清空；错误明确；重试成功恢复 | pending |
| VT-014 | 工程质量 | 幂等、并发与中断 | 首次建项目分别在 workspace_request 为 RUNNING/COMPLETED/FAILED 时重放同一 owner+requestId；两个请求并发相同 requestId；已有项目重放 requestId；并发生成与版本激活；把 RUNNING 回收后模拟迟到完成 | RUNNING 返回202同一项目、COMPLETED返回同一快照、FAILED返回同一错误且均不新建；相同 requestId 只有一个 reservation 且 AI runner 只调用一次；已有项目只一版；生成期间激活409且 AI 调用为0；超时后 run/request/steps 失败、token 清空、project 有版本回 READY/无版本为 FAILED；迟到 batch 不插 version/event、不移动指针 | pending |
| VT-015 | 稳定性 | 修改负向路径 | 提交不支持修改、过期 base、错误 versionId 与并发激活 | 返回 422/409/404；不写新版本、不改 current，历史 JSON 不变 | pending |
| VT-016 | 工程质量 | 构建、类型与迁移 | 执行类型检查、生产构建；对空本地 D1 连续执行 schema 初始化两次；再用包含首版 project/run/version 的旧库执行升级并读取旧项目 | 全部退出 0；第二次初始化无错误；新增 `generation_events` 后旧项目/版本仍可读且旧 run 可无 event | pending |
| VT-017 | 创新性/完成度 | 真实模型生成 | 注入成功的 AI binding，随后在线提交一个未命中旧模板的具体需求并查询项目快照与 D1 审计 | `generation.durationMs < 55000` 且完整 API `< 65000ms`；AppSpec 和四角色摘要来自模型响应；`generation_events` 为 `workers_ai/SUCCESS`；刷新后恢复 | pending |
| VT-018 | 稳定性 | 模型失败安全降级 | 分别注入 binding 缺失、抛错、超时、空响应、超过 48 KiB、非法 JSON、额外字段、错误类型、超长摘要、错误/重复角色、非法 AppSpec，以及 event/completion/failure batch 异常 | 可降级场景由确定性生成器完成并审计 `deterministic/FALLBACK`；completion 失败时不产生 version/event/current/assistant 成功消息，预占 run/request/steps 进入 FAILED、token 清空、project 恢复 READY 或 FAILED，阶段一 user message 保留；失败码不含 prompt/原始响应 | pending |
| VT-019 | 安全性/兼容性 | 结构化输出与版本迭代 | 模型基于当前版本生成修改版；再返回悬空 action/越界数组 | 合法修改创建 parent version；非法输出不直接入库而走受校验的降级；旧版本 JSON 不变且 UI 只渲染白名单 | pending |
| VT-020 | 用户体验/稳定性 | 长生成等待与刷新 | 用 barrier fake runner 或线上慢调用启动生成；等待中检查 UI，刷新页面，并用同 requestId 重放；完成后观察来源 | spinner/BUILDING 持续，composer 原文保留、提交禁用；刷新只轮询同一 project；重放不产生新 run/AI 调用；READY/FAILED 后停止 timer 并展示真实来源或降级原因 | pending |

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
- VT-017：单测以 fake `AiBinding` 返回唯一标题、完整 AppSpec 与四个唯一角色摘要，证明解析器使用返回内容而非固定模板。线上证据必须来自部署 CHG-006 后的同一 commit/Worker version；先记录 `wrangler deployments status` 的 Worker version、Worker `AI`/`DB` bindings 和 D1 database id，再用独立 Cookie 与固定 requestId 提交独特需求，在发出 HTTP 请求前记录单调时钟 `api_started_ms`，完整读取响应 body 后记录 `api_finished_ms`，相减得到 API wall-clock。从响应取得 projectId 和 `generation.durationMs`，按 `workspace_requests(owner_key,request_id)` 关联同一 runId，再查 `runs.id/status`、`generation_events.run_id/source/model/outcome/failure_code/duration_ms`、`versions.project_id`。断言响应 durationMs 与 D1 duration_ms 相等且 `<55000`，API wall-clock `<65000`；任一等于或超过阈值即失败。只接受同一次 requestId 对应的 `workers_ai/@cf/meta/llama-3.1-8b-instruct-fast/SUCCESS/null`，随后刷新 API 证明该 version 恢复；两个原始时间戳、两个 duration、阈值判断、requestId/runId/projectId、commit/Worker version/bindings 写入 `.vibetest/atoms-demo/artifacts/chg006-online-model-2026-08-09.md`。`adce530c`、CHG-005 artifact 或任意历史 event 均不得作为通过证据。
- VT-018：模型适配层接受测试 runner、fake monotonic clock 和 timeout 覆盖，生产默认值断言为 55,000ms。成功 spy 必须逐字段断言 `AiBinding.run` 收到精确模型 ID `@cf/meta/llama-3.1-8b-instruct-fast`、`max_tokens:2200`、`response_format.type:"json_schema"` 和与 DESIGN-004 唯一 schema 逐字段一致的对象，且不存在 `max_completion_tokens`、`reasoning_effort` 等 GLM 遗留参数；相同合法 envelope 分别以 `response` 字符串和对象返回都必须成功且产生相同结果。对象分支以表驱动覆盖 `null`、数组、数字、布尔值、不可安全序列化对象、序列化后超过 48 KiB、顶层/嵌套额外字段和非法 AppSpec：分别断言 `INVALID_ENVELOPE`、`RESPONSE_TOO_LARGE` 或既有精确校验码，全部透明 fallback，不记录原始响应且不产生非法 version/event/current。JSON Mode 平台拒绝映射为 `MODEL_ERROR`；schema 静态测试断言 `$schema`、所有 required/数组上限/四类 action/四步顺序、封闭对象和 `filterValues` string map。MODEL_TIMEOUT 用例把 fake clock 推进到 55,000ms 触发降级，再为确定性生成、completion batch/回查推进小于 10,000ms，断言完整 service/API 预算 `<65,000ms`、event 为 `deterministic/FALLBACK/MODEL_TIMEOUT`；达到 65,000ms 即失败。表驱动继续覆盖 `AI_UNAVAILABLE`、`MODEL_ERROR`、`EMPTY_RESPONSE`、`RESPONSE_TOO_LARGE`、`INVALID_JSON`、`INVALID_ENVELOPE`、`INVALID_APP_SPEC`；每例断言 fallback AppSpec 仍通过 validator，审计失败码为枚举且不包含输入正文。服务层另注入 event insert failure、completion batch failure 与 current/base/attempt token 守卫失效，断言 completion batch 内 version/event/current/run-complete 全回滚；随后 failure batch 使预占 run/request/steps FAILED、token 清空、project 有版本回 READY/无版本为 FAILED，阶段一 user message 恰好一条且没有 assistant 成功消息。再注入 failure batch 失败并通过读取超时回收收敛。模型超时后 resolve fake promise，断言迟到结果不能新增 run/version/event；限流、容量、PROJECT_BUSY 与相同 requestId 重放均断言 AI runner 调用次数为 0。
- VT-019：fake 模型第一次返回合法完整修改版，第二次返回非法引用/数组；服务层比较 versions 数量、parent、current pointer 和历史 JSON。浏览器回归合法版本的筛选/表单/toggle。
- VT-020：组件测试注入不会立即 resolve 的 generate fetch，断言 textarea value 不变、button disabled、BUILDING 文案和 spinner 可见。分别以同一 project/user message 的 BUILDING snapshot 初始化组件，断言刷新后 textarea 从最后一条 user message 恢复；使用可计数 fetch 覆盖三条序列：`BUILDING→BUILDING→READY(workers_ai/SUCCESS)`、`BUILDING→READY(deterministic/FALLBACK/MODEL_TIMEOUT)`、`BUILDING→FAILED(GENERATION_FAILED，无 event/version/assistant 成功消息)`。断言约 1.5 秒轮询、全程没有 POST、终态后不再 GET；AI READY 展示 `AI · LLAMA` 并清空 composer，fallback READY 展示 `FALLBACK` 和 `MODEL_TIMEOUT` 可读原因并清空 composer，FAILED 只展示 error_code/重试入口且保留可重试输入，不伪造 generation 来源。API 并发复用 VT-014 的同 requestId barrier/counter 证明刷新/重放不触发第二次 AI。真实浏览器在部署版本上启动一次生成，等待期间截图/DOM 记录 spinner、BUILDING、textarea value、disabled button，完成后记录来源标识；浏览器证据不得用源代码断言替代。
