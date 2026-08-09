# CHG-007~009 真实多 Agent 在线证据

## 发布标识

- Date：2026-08-10 CST（D1 时间为 2026-08-09 UTC）
- Commit / production SHA：`86d348f4298444feb7c2081010442f4844b76bd0`
- Worker version：`812bd26c-c683-4634-a0e2-ffad09cea9af`
- URL：`https://atomize-ai-builder-demo.atomize-demo.workers.dev`
- D1：`atomize-demo-db` / `c533fda1-de8a-41f8-ae97-a498631b728e`
- Rollback：Worker `26733709-5839-4da9-8e1b-af6ba44240ed`（D1 新列保留）

## 固定格式与 Schema

- Product / Architecture / Design：`response_format=json_object`，system 分别携带对应 canonical schema。
- Engineering：`response_format=json_schema`；本次 Product required=`filter,form`，实际 schema 在 canonical Engineering 基础上增加 `spec.required += form`、`filters.minItems=1`，未修改 canonical 常量。
- canonical SHA-256：Product `67cfbe9e7f91ff5b6e55cb557ecd3251511efe91fc320697df4a00afc7f57498`；Architecture `49f9925a1124737d905c2efd283623d54cf9dbc5cc30b607d975ae0c281401a0`；Design `624fda18631ff50af021c4112826c26fae2e4885f2f0f79e51bdcf3ff622c064`；Engineering `9b585da0466c81937dfe694462a005179c79753cd79850d5f434d7b84e182104`。

## 初版 API / D1

- requestId `release-812bd26c-create-001`
- projectId `45f1f1ad-1990-4325-a639-3e5b59aaf143`
- runId `f4c15b2b-99b1-4ca9-aea0-eee3944b0cd9`
- versionId `6ecae584-e6b1-4cdb-8a1b-b0682cc77dfb`
- reserve：HTTP 202，`BUILDING`，四个 PENDING step，AI 尚未执行。
- execute：HTTP 200，wall clock `5.822057s`；event `workers_ai / @cf/meta/llama-3.1-8b-instruct-fast / SUCCESS / 5255ms`，failure_code null；project READY 且 current 指向 v1。

| ordinal | role | source/model | duration | attempt | artifact SHA-256 | 结果 |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | product | workers_ai / Llama Fast | 724ms | 1 | `44496000643a11addaba6c9d4a49e047158ea421581967eb8a99e91b48625a09` | PASS |
| 1 | architecture | workers_ai / Llama Fast | 808ms | 1 | `73272eadd1a98ebe3c11f7f63fdd44215d68b90fd9afc09bc532625b9d8484b5` | PASS |
| 2 | design | workers_ai / Llama Fast | 726ms | 1 | `15b9d4a0ea21fa11b905f5e75facf4be9e5b8047f9a395d76a32a3578e3cc3dc` | PASS |
| 3 | engineering | workers_ai / Llama Fast | 2612ms | 1 | `40dc993ecaa44ef5c40598e1e03bcfae0897be86021ac41a31c705b419bd47f5` | PASS |

逐阈值：724<7000、808<9000、726<7000、2612<22000、event 5255<52000、completion<62000、HTTP 5822<65000，全部 PASS。生成 AppSpec 有 3 张不同筛选值卡片、2 个 filters、stats、form、set_filter/add_item，且无 forbidden toggle。

## 修改与版本

- requestId `release-812bd26c-update-001` 基于 v1 请求珊瑚色修改，创建 v2 `08bcc22f-cc89-4d1c-96c6-5376f38a6557`，`parent_version_id=6ecae584-e6b1-4cdb-8a1b-b0682cc77dfb`，current 移到 v2，v1 JSON 保留。
- 本次模型返回 `INVALID_JSON`，UI/API 明示 `deterministic/FALLBACK/INVALID_JSON`；规则引擎只修改主题/统计并保留筛选、表单和卡片。这证明修改失败透明且版本仍可用，不把 fallback 冒充 AI 成功。
- 另一次线上修改 run `e99a2483-380e-407a-a186-a8c6fabab44b` 已取得四阶段 workers_ai/SUCCESS 与 parent version，证明模型修改路径可成功；该旧 run 只作补充，不用于关闭最终 Worker 主门禁。

## 浏览器

- 最终 Worker 上观察到 `BUILDING`、四角色阶段状态和禁用提交；终态显示 `构建完成`、`AI · LLAMA`、四角色真实耗时与安全校验说明。
- 生成应用显示统计（缺省备注为“实时概览”，不再显示字符串 null）、筛选控件、报名表单；填写“验收用户”后提交，新卡片可见并出现成功反馈。
- reload 后等待 1.2s，项目标题、`AI · LLAMA`、Version 1 和生成预览全部恢复；浏览器中的表单临时卡片不承诺跨刷新，持久化范围为项目/消息/AppSpec/版本/run/event。
- 浏览器曾捕获一次 `INVALID_APP_SPEC` 并明确显示 FALLBACK，随后同一最终 Worker 重试成功显示 AI 来源，验证失败透明与成功主链均真实存在。

## 本地回归

- `npm run lint`：PASS。
- `npx tsc --noEmit`：PASS。
- `npm test`：12/12 PASS（新增 capability 冲突、规范化审计与不可收窄 filter 回归）。
- `npm run build`：PASS。
- 不证明：免费 Workers AI 每次任意提示都成功；额度耗尽或模型输出不合法时仍按设计安全降级。
