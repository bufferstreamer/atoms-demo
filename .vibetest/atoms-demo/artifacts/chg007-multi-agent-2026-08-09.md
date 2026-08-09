# CHG-009 真实多 Agent 最终在线证据

## 发布标识

- Date：2026-08-10 CST（D1 时间为 2026-08-09 UTC）
- Production code SHA：`0085c134042f68ca7b2ac1a57d08f6d7e4b3b3fe`
- Worker version：`8d3e1c98-888a-4072-bd06-788860cd59bf`
- URL：`https://atomize-ai-builder-demo.atomize-demo.workers.dev`
- Bindings：Workers AI `AI`；D1 `DB`
- D1：`atomize-demo-db` / `c533fda1-de8a-41f8-ae97-a498631b728e`
- 排除：`86d348f4298444feb7c2081010442f4844b76bd0`、Worker `812bd26c-c683-4634-a0e2-ffad09cea9af` 及所有 pre-CHG-009-fix evidence 均不能关闭本次门禁。

## 固定格式、Schema 与安全收敛

- Product / Architecture / Design：三次独立 `response_format=json_object`，system 分别携带对应 canonical schema；服务端继续执行 exact-key/type/enum/unique/12 KiB 校验。
- Engineering：独立 `response_format=json_schema`；本次 Product required=`filter,form`、forbidden=`[]`，实际派生 schema 在 canonical Engineering 基础上增加 `spec.required += form`、`filters.minItems=1`，未修改 canonical 常量。
- canonical SHA-256：Product `67cfbe9e7f91ff5b6e55cb557ecd3251511efe91fc320697df4a00afc7f57498`；Architecture `49f9925a1124737d905c2efd283623d54cf9dbc5cc30b607d975ae0c281401a0`；Design `624fda18631ff50af021c4112826c26fae2e4885f2f0f79e51bdcf3ff622c064`；Engineering `9b585da0466c81937dfe694462a005179c79753cd79850d5f434d7b84e182104`。
- base AppSpec SHA-256：`bf11ff9ecd2c744afe8fbfe0eb09ff1e1dd9f511ac2903d8eb53d6c95766bca8`；实际派生 Engineering SHA-256：`152d110bfcee1feae414bf5a5ea8682a9b470b1dbb056901192b23607bf9d708`。
- 本地 12/12 测试证明：required/forbidden 冲突在 Engineering 调用前拒绝；required filter 必须真实收窄；公共 AppSpec validator 仍严格；模型对象不被原地修改；规范化审计、repair/fallback 和能力补齐边界固定。

## 初版 API / D1

- prompt：`做一个蓝色社区活动管理看板，显示三个活动卡片和统计，支持活动类型筛选及新增报名表单；不要完成状态切换。`
- requestId：`chg009-final-20260810-004`
- projectId：`9201c966-93fd-4c1c-9afd-c8f5c109a499`
- runId：`b9485271-99f5-46c9-9c49-ab8738338eed`
- versionId：`255e9815-1f56-40bf-a46d-43aacbae6c22`
- reserve：HTTP 202，`BUILDING`，四个 PENDING step，current version 为空。
- execute：HTTP 200，wall clock `5.900679s`；event `workers_ai / @cf/meta/llama-3.1-8b-instruct-fast / SUCCESS / 5217ms`；failure_code null。
- D1 回查：run=`COMPLETED`、attempt_token=null、project=`READY`、current 指向 v1；四个 step 均 `COMPLETED/workers_ai`，event/version/current 同时存在。

| ordinal | role | duration / limit | attempt | artifact SHA-256 | 结果 |
| --- | --- | --- | --- | --- | --- |
| 0 | product | 1241ms / 7000ms | 1 | `80bf29d155d984aae178099dfcdb764f73ac2eb2044dcc224586cc97a68a0161` | PASS |
| 1 | architecture | 672ms / 9000ms | 1 | `b2a5c7cdd342ccca96c7b1dab8dd84c9c0fe0b6a038618db39d554bccc05dfc9` | PASS |
| 2 | design | 909ms / 7000ms | 1 | `c7445fcefd0f72755de43ae9d34e1c4badd059ab695a8d284d1ef9614b6b8515` | PASS |
| 3 | engineering | 2297ms / 22000ms | 1 | `866d9655ae4b84b13e501928161774b285495193fc278c2baa3bb2ae18c31c41` | PASS |

总模型 5217ms<52000ms、completion<62000ms、execute API 5901ms<65000ms。最终 AppSpec SHA-256=`7bfbb9a65ba3c93cac9a4ff23a7519055a4a3671db208d768e6c5b98fda4e104`。

Engineering D1 artifact 审计：`repaired=false`、`normalized=true`、`normalizationVersion=appspec-normalizer-v1`、codes=`CARD_FILTER_VALUES,SET_FILTER_REFERENCE,ADD_FORM_ACTION`、completedCapabilities=`form`，并持久化上述 base/derived schema SHA。最终应用有 3 张不同类型卡片、2 个 filter、stats、form、非 all set_filter 和 add_item；非 all 筛选实际只保留匹配子集。

## 修改、版本与透明降级

- requestId `chg009-final-20260810-update-001` 基于 v1 请求“保留现有能力，把主题改成珊瑚色”。
- 创建 v2 `c82629c1-40d1-41e5-9110-d28687693827`，`parent_version_id=255e9815-1f56-40bf-a46d-43aacbae6c22`，current 移到 v2；v1 仍为 blue，v2 为 coral，历史 JSON 未被覆盖。
- 本次上游 Architecture artifact 未过严格校验，D1/UI 明示 `deterministic/FALLBACK/INVALID_ARCHITECTURE_ARTIFACT`；规则引擎完成受支持修改。该结果证明修改链可用且失败透明，不把 fallback 冒充 AI 成功。

## 真实浏览器

- 同一最终 Worker 新建 project `8aa53232-6283-472d-ad58-186f2de07ab8`，run `31bdd0a1-5f87-460c-9537-5c22147669c2`，event=`workers_ai/SUCCESS/6047ms`，页面显示 `构建完成`、`AI · LLAMA` 和四角色真实耗时。
- 选择“团队活动”后只显示团队卡片；恢复“社区活动”后显示对应社区卡片，证明非默认筛选会真实改变集合。
- 表单填写“验收用户 / 13800000000”并提交后，新卡片出现且 toast=`已添加到当前预览`。
- 补充同 Worker 浏览器用例先捕获 `BUILDING`、原输入保留和 disabled `构建中`；该次模型 Design 产物未过校验后透明 fallback。终态筛选从“全部”3 张切到“筹备中”2 张，再切回“全部”恢复 3 张（DOM 实测 `3→2→3`），证明 allValue 恢复全集；该 fallback 用例仅验证 UI/降级交互，不冒充 AI 主链。
- reload 后项目标题、`AI · LLAMA`、Version 1、统计、筛选、表单和生成预览恢复；表单临时新卡片不承诺跨刷新，服务端持久化范围为项目/消息/AppSpec/版本/run/event。

## 降级抽样与本地回归

- 同一最终 Worker 的三个独立复杂请求分别得到 `FALLBACK/INVALID_JSON`，均在 3~8 秒内返回可交互应用并明确标注来源；这验证安全降级，不计作真实模型主链成功。
- `pnpm run lint`：PASS。
- `pnpm exec tsc --noEmit`：PASS。
- `pnpm test`：12/12 PASS。
- `pnpm run build`：PASS（并行双 build 曾竞争同一 dist 目录，单独重跑通过，不计产品失败）。
- 边界：免费 Workers AI 不保证任意提示每次都满足严格 JSON/AppSpec；额度耗尽或输出不合法时透明 fallback，已有项目和版本读取不受影响。
