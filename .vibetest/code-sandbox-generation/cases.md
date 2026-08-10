# VibeTest Cases — code-sandbox-generation

> 状态：`CONFIRMED_FOR_ACCEPTANCE_FREEZE`。独立复核：`codex-independent-chg010-acceptance-reviewer-r2`。所有 fixture 使用唯一 `owner/project/requestId`；本地用例只写临时 D1，线上用例只创建带 `chg010-vt-` 前缀的测试项目且不删除既有数据。

## 用例矩阵

| ID | 评分维度 | 场景 | 操作 | 精确预期 | 工具 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| VT-101 | 完成度/创新性 | 计数器核心闭环 | 提交 SEM-01，点击 +1、-1、重置，修改值后刷新 | `code_bundle`；控件/标题对齐；真实 DOM 状态变化；`counter.value` 在 D1 恢复；无 Spark 看板 | API + D1 + 浏览器 | PENDING |
| VT-102 | 工程质量 | sentinel/CodeBundle 边界 | 表驱动解析合法、marker 重复/错序/正文 marker、CRLF/孤立 CR、NUL、U+2028/2029、48KiB 边界、额外字段/文件 | 仅合法 exact bundle 通过；错误 code/path 稳定；失败不写 D1 | 单测 + D1 | PENDING |
| VT-103 | 稳定性/安全 | 危险代码与 raw-text | 注入 script/style/link/handler、外链、url/import、fetch/eval/import/parent/postMessage/loop、`</script>`/`</style>` | 对应 `DISALLOWED_*`；Qwen 最多 repair 一次；非法代码/version/event/assistant success 为 0 | validator + runner spy + D1 | PENDING |
| VT-104 | 用户体验/安全 | iframe 与 bridge | 合法应用 get/set/list/delete/clear；伪造 source/origin/token/op/extra key；尝试网络/导航/form；reset preview | 仅可信消息到 API；opaque origin、无父 DOM/Cookie；网络/导航/form 失败；reset 不删 D1 | 组件 + browser CSP report + API spy | PENDING |
| VT-105 | 完成度/稳定性 | Storage API 容量 | exact API 覆盖 get/set/list/delete/clear、非法 key/`__atoms.`、JSON depth/node/finite、8192/8193 bytes、49→50→51 keys、65536/65537 total、替换缩容 | HTTP/error 精确；set owner/count/bytes 同 SQL guard；失败前后 state hash 不变 | API + 临时 D1 | PENDING |
| VT-106 | 工程思维/安全 | owner/global 限流与隔离 | 两 Cookie 交叉读写同 project；同 owner 59/60/61 并发写；多 owner 999/1000/1001；伪造 owner/body/query | 他人统一 404；60/1000 成功边界、后续 429；rate rejection 不 mutation；HTTP 无测试阈值覆盖 | 并发 API + D1 | PENDING |
| VT-107 | 完成度/兼容 | 旧 AppSpec 历史 | 从 pre-CHG-010 fixture 升级；读取/切换旧版本；在旧项目继续修改；切回历史 | 旧行默认为 app_spec；修改生成 code_bundle parent；历史 JSON 字节不变；两 renderer 正确 | migration + API + 浏览器 | PENDING |
| VT-108 | 创新性/工程质量 | 模型调用与来源 | spy 成功、planning 非法、Qwen 非法后 repair、Qwen 全失败+counter compiler、非 counter 全失败 | 精确 1 planning + 1 Qwen，必要时总 3 调用；schema/model/token/timeout 精确；source/outcome/fallback_reason 真实 | runner spy + D1 | PENDING |
| VT-109 | 稳定性 | completion/failure 原子性 | 注入 version/event/message/pointer/run/request/step 任一 batch 失败；首版/已有版各跑 | completion 全回滚；failure 收敛；user message 保留、assistant success 禁止；已有 pointer/历史不变 | 故障注入 + D1 diff | PENDING |
| VT-110 | 工程思维/稳定性 | 并发、deadline 与迟到 | active transition 并发 reserve/activate；fake clock 51,999/52,000、59,999/60,000、61,999/62,000、64,500/65,000；pending D1 | 同项目 active≤1；null base 正确；watchdog 单 batch；202 BUILDING/FINALIZING<65s；waitUntil 后终态；旧 token 0 writes | barrier + fake clock + D1 | PENDING |
| VT-111 | 用户体验 | 生成中/失败/代码查看 | 持有 execute；刷新；重放 requestId；进入 READY/FAILED；切预览/代码并复制；runtime error/reset | composer 保留、提交禁用、只 GET 轮询、无二次 AI；终态停轮询；来源/错误透明；三文件可读复制 | 组件 + 浏览器 | PENDING |
| VT-112 | 创新性/可用性 | 固定十条语义基准 | 在同一 production commit 逐条执行 SEM-01~10，自动断言并浏览器操作每类至少一条 | ≥9/10；SEM-01/02=2/2；至少一个 counter 为 Qwen SUCCESS；无无关模板 | online API + semantic runner + browser | PENDING |
| VT-113 | 工程质量 | schema/迁移/active index | 空库重复三次、旧库升级、两个并发 ensureSchema、预置重复 active repair | 精确列/表/index；旧数据可读；重复无错；active conflict 稳定 FAILED；partial unique 生效 | 临时 D1 + barrier | PENDING |
| VT-114 | 完成度/工程质量 | 静态与测试回归 | lint、tsc noEmit、production build、全部 unit/API/D1/component tests | 全部 exit 0；无公开 test runner/fault header/query；bootstrap/schema/prompt hash 固定 | 本地命令 | PENDING |
| VT-115 | 可交付性 | production 全链路 | 新 Worker 上跑 VT-101/104/105/107/108/110/111；D1 join；两个新会话 | 同 production SHA 的模型→version→iframe→storage→refresh 闭环；无旧 artifact 代替 | Cloudflare + 浏览器 + D1 | PENDING |
| VT-116 | 可交付性 | 文档/GitHub/回滚 | 公开仓库匿名访问；比对 main/production/build SHA；按 compatibility switch 演练只读与恢复 | URL 可测；SHA 一致；README/架构/AI 工具/限制/证据清晰；关闭生成仍可读两类版本 | GitHub + Cloudflare + 文档审查 | PENDING |

## 固定语义输入（受 acceptance hash 保护）

| ID | 精确 prompt | 自动断言 | 持久化 |
| --- | --- | --- | --- |
| SEM-01 | 创建一个计数器，显示数字，提供 +1、-1、重置，刷新后保留结果。 | 三控件；+1 后 1、-1 后 0、重置 0 | `counter.value` |
| SEM-02 | Build a step counter starting at 5 with increment, decrement and reset; save across refresh. | 初始 5；三控件；reset 回 5 | `counter.value` |
| SEM-03 | 创建 Todo 清单，可新增、完成、删除任务，刷新后恢复。 | add/toggle/delete | `todo.items` 或声明的合法 storage key |
| SEM-04 | 做一个阅读清单，可添加书籍、标记已读、筛选全部/未读，保存进度。 | add/toggle/filter | 合法 storage key |
| SEM-05 | 制作四则计算器，数字键、加减乘除、等号和清空。 | 数字、四运算、等号、清空 | 禁止 storage |
| SEM-06 | Build a tip calculator with bill amount, percentage, people count, calculated total and reset. | 三输入、计算、reset | 禁止 storage |
| SEM-07 | 为 AI 写作工具做产品落地页，包含功能、价格卡和本地成功提示的申请表单。 | feature/price/form/success | 禁止外联 |
| SEM-08 | 制作活动报名页，姓名和邮箱必填，提交后在页面显示报名成功，不发送网络请求。 | required validation/success | 禁止外联 |
| SEM-09 | 制作预算记录工具，可添加收入/支出、分类、计算余额，刷新后保留。 | add/type/category/balance | 合法 storage key |
| SEM-10 | 制作每日习惯追踪器，可打卡、显示连续天数、重置，刷新后恢复。 | check-in/streak/reset | 合法 storage key |

计算规则固定：每条只有全部必需控件、至少一条真实状态转换、正确 storage capability、静态安全与需求主题一致时才 PASS；10 条至少 9 条 PASS。SEM-01/02 均必须 PASS，且二者至少一条最终 generation event 为 `workers_ai/SUCCESS`。`deterministic/SUCCESS` counter 可证明体验但不能代替该模型门禁。

## 可重复执行协议

- 固定 runner：实现阶段必须提供 `scripts/vt-chg010.ts`，CLI 仅接受 `--case VT-101..VT-116 --environment local|production --artifact <repo内artifacts路径>`；local 额外接受由 runner 自己 `mkdtemp('/private/tmp/atoms-chg010-vt-')` 创建的 DB root，production 必须显式提供 URL/Worker version 且禁止 destructive cleanup。runner 从本文件解析 SEM prompt，不能内置另一份可漂移文本。
- 通用隔离：测试 fixture ID 均为 `chg010-vt-<case>-<uuid>`。本地 runner 通过构造参数注入 `AiRunner/Clock/BackgroundTasks/D1Adapter`，production bundle 静态断言不存在 query/header/Cookie 故障开关。测试不删除线上数据；本地临时 D1 仅由创建它的 runner 清理：清理前必须 realpath 等于记录路径、前缀为 `/private/tmp/atoms-chg010-vt-`、lstat 非 symlink、枚举数量与 manifest 一致，任一检查失败立即停止而不是扩大删除。
- 固定 fixture manifest：每次运行写 `artifacts/chg010-fixtures-<environment>-<runStamp>.json`，exact 字段为 `{schemaVersion:1,feature:"code-sandbox-generation",commit,environment,workerVersion,createdAt,cases:[{caseId,ownerAlias,requestId,runId,projectId,versionIds,artifactHashes}],cleanup:{localDb:"REMOVED"|"RETAINED",onlineFixtures:"RETAINED"}}`。敏感 Cookie/ownerKey/token 不写入；local 清理后必须回查路径不存在并把 `localDb=REMOVED`，线上 fixture 永久保留作为 D1 证据且前缀可查询。
- 固定证据文件：本地为 `artifacts/chg010-local-<commit>.json`，线上 API/D1 为 `artifacts/chg010-production-<workerVersion>.json`，浏览器为 `artifacts/chg010-browser-<workerVersion>.md`。三者都必须含 schemaVersion、commit、caseIds、start/end time、command/runner version、inputs hash、actual assertions、PASS/FAIL 与 fixture manifest 相对路径；线上两份另含 public URL、Worker version、脱敏 requestId/runId/projectId、D1 query hash。旧命名、旧 commit 或缺字段 artifact 不能关闭 case。
- VT-101：先通过 reserve/execute 创建新 project，记录 owner Cookie、requestId/runId/versionId。浏览器在 iframe 内依次断言显示 0→点击 +1 显示1→点击 -1 显示0→再 +1 后 reload。API `list/get` 与 D1 `app_state` 回查 value=1，刷新后 UI=1；最后 reset=0 并再回查。源码标题与控件文本必须来自该 bundle，页面不得出现 `Spark 项目看板`。
- VT-102：导入生产 parser。raw bytes 在规范化前检查 48KiB；表格每个非法输入断言 exact error code/path。合法 CRLF 只转 LF；孤立 CR 拒绝。每例随后调用 guarded persistence adapter，非法例 version/event/message 增量均为0。
- VT-103：每个 HTML/CSS/JS pattern 分别放到最小合法 bundle；runner counter 证明首次失败最多再调用一次 repair。repair 仍非法则 failure，计数器只有严格 grammar 命中才允许 deterministic success。D1 比较前后 versions/current/generation_events/assistant message。
- VT-104：组件测试固定 iframe attribute/CSP/srcdoc bootstrap hash，并把包含 raw closing sequence 的 validated fixture经 base64传入，断言不会改变 wrapper DOM。浏览器通过 route/request spy 证明只有 source=iframe.contentWindow、origin=null、正确 token/exact envelope 发 API；网络/导航/form 用 CSP/securitypolicyviolation 与顶层 URL 不变作为证据。
- VT-105：每个边界从空 project 开始。value bytes 用服务端 canonical JSON UTF-8 计算；replacement 同 key 分别变大/变小。每次 409/400 前后查询 `COUNT/SUM/value_json` 并比对 hash。delete/clear 的 cleared/deleted 与实际行数一致。
- VT-106：先用 owner A 创建项目，再以 B、无 Cookie 和 body/query 伪造 A 操作，均 404 且响应长度/shape 一致。并发 rate 使用 D1 barrier 同时启动请求，回查 `storage_rate_events` 恰为60/1000且 state mutation 不超过相同数量；窗口使用 fake epoch，不 sleep。
- VT-107：fixture 含一个 `artifact_kind` 缺失的 AppSpec project、两版历史、消息与 current pointer。升级后真实 union reader恢复；继续修改以旧 current 作为 base，新版必须 `artifact_kind=code_bundle,parent_version_id=old`。切换前后对旧 `app_spec_json` SHA-256 不变。
- VT-108：spy 断言 planning model/`json_object`/combined schema/1800 tokens/12s，Qwen model/plain sentinel/6000 tokens/32s，repair 最多一次/8s remaining。成功 calls=2；repair calls=3；planning 失败仍 calls=2且三 planner step source deterministic；counter compiler最终 `deterministic/SUCCESS` +真实 fallback_reason；非 counter 不产生版本。
- VT-109：D1 adapter 可在 terminal batch 每个 statement 和 batch commit 位置抛错。每例预先保存整库业务表摘要；失败后允许新增 user message/run失败审计，但 version/event/assistant success/current 必须满足设计终态。failure batch 再失败后按 expired lease GET 回收并复查。
- VT-110：并发 reserve/activate 在 completion transition barrier 同时释放，回查 partial index与 public snapshot。fake clock逐边界推进而不真实等待；60s watchdog只调用一个 atomic timeoutFailureBatch。64.5s挂起 D1 时 execution context spy 收到同一个 terminalPromise，HTTP 202 body exact BUILDING/FINALIZING；释放 barrier 后只一个终态，deadline audit四 flags与实际一致，旧 token模拟 batch changes=0。另以 `BackgroundTasks=null` 调 execute，断言在 AI 前503、AI counter=0、execute业务写=0。audit-only finalizer 首次 UPDATE 注入失败时业务终态/hash不变且 waitUntil error 可观察；用同 run 重试幂等 finalizer 后 flags 正确且无新增 version/event/message，若重试仍失败则 VT-110 FAIL/GAP-110 不得关闭。
- VT-111：组件 fetch adapter返回 BUILDING→BUILDING/FINALIZING→READY、BUILDING→FAILED 三序列。断言约1.5s GET、刷新从最后 user message恢复 composer、全程 POST/AI counter不增加。代码 tab 三文件和 copy结果逐字相等；runtime error卡不泄露 stack/raw code，reset重建 token/iframe且storage保留。
- VT-112：prompt文本从本文件解析并计算 SHA-256，runner拒绝非 SEM-01~10/顺序变化。每条保存 API wall time、source/model、bundle hash、自动语义断言、browser action、D1 state；失败也保留公开 code。浏览器至少实际操作 counter、list、calculator、form、tracker各一条。
- VT-113：两个 ensureSchema 在读取缺列后以 barrier 同时继续，duplicate column/index 后必须 PRAGMA/sqlite_master 回查。旧库预置两 active run，migration D1 batch只保留 created_at/id最早者，其余 FAILED/MIGRATION_ACTIVE_RUN_CONFLICT，再创建第三 RUNNING 必须违反 active index。
- VT-114：证据记录完整命令、exit code、测试数量、build artifact SHA、schema/bootstrap/semantic input hash。`rg` 静态扫描 production route不得含 `x-test`/`fault`/`fakeRunner`/阈值 query。
- VT-115：只接受 deployment 后创建的 CHG-010 requestId；D1 同 run join `runs/steps/versions/generation_events/run_deadline_audit`。浏览器截图/DOM记录 BUILDING、FINALIZING若出现、READY来源、iframe交互和reload；两个全新无共享 Cookie context 验证隔离。pre-CHG-010 Worker/commit/artifact不能关闭本用例。
- VT-116：匿名 HTTP 验证 GitHub repo public；`git rev-parse HEAD`、GitHub main SHA、build metadata 与 Worker version metadata精确相等。关闭生成开关后新 execute维护失败但旧 AppSpec/CodeBundle/storage仍可读；恢复开关后 SEM-01可再次生成。禁止部署 pre-CHG-010 reader。

## 历史缺陷回归

| Old Bug | 捕获用例 | 必须证据 |
| --- | --- | --- |
| 输入计数器多次异常并返回无关 `Spark 项目看板` | VT-101 + SEM-01/02 | 新 request 的 bundle/title/控件、真实点击、D1恢复、source/event；任一无关模板即失败 |
