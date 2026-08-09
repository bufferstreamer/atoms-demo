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
| VT-014 | 工程质量 | 幂等、并发与中断 | 首次建项目分别在 workspace_request 为 RUNNING/COMPLETED/FAILED 时重放同一 owner+requestId；已有项目重放 requestId；并发生成与版本激活；把 RUNNING 回收后模拟迟到完成 | RUNNING 返回202同一项目、COMPLETED返回同一快照、FAILED返回同一错误且均不新建；已有项目只一版；生成期间激活409；迟到 batch 不插 version/不移动指针 | pending |
| VT-015 | 稳定性 | 修改负向路径 | 提交不支持修改、过期 base、错误 versionId 与并发激活 | 返回 422/409/404；不写新版本、不改 current，历史 JSON 不变 | pending |
| VT-016 | 工程质量 | 构建、类型与迁移 | 执行类型检查、生产构建；对空本地 D1 连续执行 schema 初始化两次并查询表/索引 | 全部退出 0；第二次初始化无错误且 schema 与预期一致 | pending |

## 可重复执行协议

### 冻结计划补充映射

`implementation-plan.md` 已在 VT-016 由验收审查新增前进入设计冻结。为保证新增用例受 acceptance hash 保护，本文件将 VT-016 正式接入 `TASK-005`、`NFR-001` 与 `NFR-005`；TASK-005 的完成定义增加“类型检查、生产构建和本地 D1 schema 连续初始化两次均通过”。该补充不改变任务范围或技术设计。

- VT-006：不暴露线上故障开关。单元/集成测试通过 orchestrator 构造参数注入 `validatorFailure` 与 `dbBatchFailure` 两种 adapter；使用临时本地 D1 先创建一个成功版本，执行失败后查询 `runs.status/error_code`、version 数量与 `projects.current_version_id`，断言失败 run 可见且版本数/指针不变。每个用例创建唯一 owner/project，测试结束删除临时数据库目录，不操作线上数据。
- VT-011：服务层的 limiter 接收只在测试构造中可覆盖的 `LimitConfig`；本地集成将 owner/global generate 设为 2/3、owner/global projects 设为 2/3，在两个 Cookie 会话中逐次提交并回查 `rate_limits(bucket_key,window_start,action,count)` 与项目数量。生产代码使用冻结默认值 6/120、20/5000，且无 HTTP 参数可覆盖。测试使用临时 D1，结束后删除整个临时目录。
- VT-012：直接对 `validateAppSpec` 表驱动测试未知 schema、悬空 target、非法 value、非法 allValue、重复 ID 与数组越界；再用临时 D1 走一次 generate service，回查 version 数量与 current pointer 不变。浏览器只验证可读错误和上一预览保留。
- VT-013：客户端 API 层接受测试 fetch adapter。组件测试让第一次 workspace GET 返回固定 500、第二次返回已保存 snapshot，断言输入 DOM value、预览标题与 project id 在失败期间不变且重试恢复；不通过公开查询参数触发。
- VT-014：临时 D1 预置 workspace_requests 三种状态并逐一重放；并发测试用 Promise 同时提交两个 requestId；超时测试把 run.updated_at 回拨 3 分钟后 GET project，再模拟原 run 的 guarded completion batch。最终 SQL 回查 project/run/request/step/version 五张表。每例独立数据库，结束删除临时目录。
- VT-015：先保存所有 versions 的 `app_spec_json` 和 current pointer，再依次执行四类负向请求，最后逐字对比 JSON、版本计数与指针。
- VT-016：schema 初始化函数必须使用 `CREATE ... IF NOT EXISTS`/幂等索引；在同一空本地 D1 连续调用两次后查询 `sqlite_master`。随后运行 TypeScript no-emit 与 production build。临时数据库目录在证据收集后删除。
