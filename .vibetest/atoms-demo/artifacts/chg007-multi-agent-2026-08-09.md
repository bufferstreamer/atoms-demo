# CHG-009 真实多 Agent 最终在线证据

## 发布标识

- Date：2026-08-10 CST（D1 时间为 2026-08-09 UTC）
- Production code SHA：`7ced0ada6fdd08e885db46243351a948d484305b`
- Worker version：`a3a2348b-f185-4020-8869-9f3e79f5f75f`
- URL：`https://atomize-ai-builder-demo.atomize-demo.workers.dev`
- Bindings：Workers AI `AI`；D1 `DB`
- D1：`atomize-demo-db` / `c533fda1-de8a-41f8-ae97-a498631b728e`
- 排除：`86d348f`/`812bd26c`、`0085c134`/`8d3e1c98` 及所有 pre-forbidden-fix evidence 均不能关闭本次门禁。

## 固定格式、Schema 与安全收敛

- Product / Architecture / Design：三次独立 `response_format=json_object`，system 分别携带对应 canonical schema；服务端继续执行 exact-key/type/enum/unique/12 KiB 校验。
- Engineering：独立 `response_format=json_schema`；本次 Product required=`filter,form`、forbidden=`[]`，实际派生 schema 在 canonical Engineering 基础上增加 `spec.required += form`、`filters.minItems=1`，未修改 canonical 常量。
- canonical SHA-256：Product `67cfbe9e7f91ff5b6e55cb557ecd3251511efe91fc320697df4a00afc7f57498`；Architecture `49f9925a1124737d905c2efd283623d54cf9dbc5cc30b607d975ae0c281401a0`；Design `624fda18631ff50af021c4112826c26fae2e4885f2f0f79e51bdcf3ff622c064`；Engineering `9b585da0466c81937dfe694462a005179c79753cd79850d5f434d7b84e182104`。
- base AppSpec SHA-256：`bf11ff9ecd2c744afe8fbfe0eb09ff1e1dd9f511ac2903d8eb53d6c95766bca8`；实际派生 Engineering SHA-256：`152d110bfcee1feae414bf5a5ea8682a9b470b1dbb056901192b23607bf9d708`。
- 本地 16/16 测试证明：required/forbidden 冲突、四类 action 全 forbidden 的无解组合均在 Engineering 调用前拒绝；五类 forbidden 均按结构二次校验；required toggle/toast 安全补齐；actions 满 8 无法补齐时 repair 后 fallback；required filter 必须真实收窄；公共 AppSpec validator 仍严格；模型对象不被原地修改；规范化审计、repair/fallback 和能力补齐边界固定。

## 初版 API / D1

- prompt：`做一个蓝色社区活动管理看板，显示三个活动卡片和统计，支持活动类型筛选及新增报名表单；不要完成状态切换。`
- requestId：`chg009-final-20260810-005`
- projectId：`e4d81170-fce5-4ad1-b158-48c4fa5c47ae`
- runId：`daee9323-3125-4622-8820-d36644a0ffb3`
- versionId：`ef452d2b-8bff-41f7-a0c6-42f3e3700794`
- reserve：HTTP 202，`BUILDING`，四个 PENDING step，current version 为空。
- execute：HTTP 200，wall clock `5.166946s`；event `workers_ai / @cf/meta/llama-3.1-8b-instruct-fast / SUCCESS / 4499ms`；failure_code null。
- D1 回查：run=`COMPLETED`、attempt_token=null、project=`READY`、current 指向 v1；四个 step 均 `COMPLETED/workers_ai`，event/version/current 同时存在。

| ordinal | role | duration / limit | attempt | artifact SHA-256 | 结果 |
| --- | --- | --- | --- | --- | --- |
| 0 | product | 813ms / 7000ms | 1 | `44496000643a11addaba6c9d4a49e047158ea421581967eb8a99e91b48625a09` | PASS |
| 1 | architecture | 737ms / 9000ms | 1 | `73272eadd1a98ebe3c11f7f63fdd44215d68b90fd9afc09bc532625b9d8484b5` | PASS |
| 2 | design | 693ms / 7000ms | 1 | `c6fe1ee73482d7394b0259a53ae4471ec9d8bea89a5a0710889b7efc62f0fabe` | PASS |
| 3 | engineering | 2150ms / 22000ms | 1 | `998d9fd1c8efede5bf4bba41d73216203e3661aabd86c54bf341353ef1fa92ab` | PASS |

总模型 4499ms<52000ms、completion<62000ms、execute API 5167ms<65000ms。最终 AppSpec SHA-256=`c1e8bc18065505dadfa205002870c807642684af66c1ed25dff2f4a705289be0`。

Engineering D1 artifact 审计：`repaired=false`、`normalized=true`、`normalizationVersion=appspec-normalizer-v1`、codes=`FILTER_DEFAULT_VALUE,FILTER_ALL_VALUE,CARD_FILTER_VALUES,SET_FILTER_REFERENCE,ADD_FORM_ACTION`、completedCapabilities=`form`，并持久化上述 base/derived schema SHA。最终应用有 3 张不同类型卡片、2 个 filter、stats、form、非 all set_filter 和 add_item；非 all 筛选实际只保留匹配子集。

## 修改、版本与透明降级

- requestId `chg009-final-20260810-update-002` 基于 v1 请求“保留现有能力，把主题改成珊瑚色”。
- 创建 v2 `039dd80a-8fba-430e-bfac-b2ed038799db`，`parent_version_id=ef452d2b-8bff-41f7-a0c6-42f3e3700794`，current 移到 v2；v1 仍为 blue，v2 为 coral，历史 JSON 未被覆盖。
- 本次上游返回非法 JSON，D1/UI 明示 `deterministic/FALLBACK/INVALID_JSON`；规则引擎完成受支持修改。该结果证明修改链可用且失败透明，不把 fallback 冒充 AI 成功。

## 真实浏览器

- 在最终 Worker `a3a2348b` 新建应用，先捕获 `BUILDING`、原输入保留、四角色等待状态和 disabled `构建中`。该浏览器请求的 Design artifact 未过校验，终态明确显示 `FALLBACK/INVALID_DESIGN_ARTIFACT`；真实模型成功主链以同 Worker 的 API/D1 run `daee9323...` 为准，不混用来源。
- 该最终 Worker 浏览器终态从“全部”3 张切到“筹备中”2 张，再切回“全部”恢复 3 张（DOM 实测 `3→2→3`）；点击“生成周报”显示真实 toast；reload 后仍显示 `FALLBACK` 与 Version 1，证明降级来源和项目持久化。
- 同一最终 Worker 读取既有 workers_ai 项目 `8aa53232-6283-472d-ad58-186f2de07ab8` 做向后兼容交互回归：选择“团队活动”只显示团队卡片；表单填写“最终验收 / 13900000000”后新卡片出现且 toast=`已添加到当前预览`。该既有 run 不用于证明最终 Worker 的模型调用，只证明最终渲染器/交互兼容历史 AppSpec。
- 表单临时新卡片不承诺跨刷新；服务端持久化范围为项目/消息/AppSpec/版本/run/event。

## 降级抽样与本地回归

- 同一最终 Worker 的三个独立复杂请求分别得到 `FALLBACK/INVALID_JSON`，均在 3~8 秒内返回可交互应用并明确标注来源；这验证安全降级，不计作真实模型主链成功。
- `pnpm run lint`：PASS。
- `pnpm exec tsc --noEmit`：PASS。
- `pnpm test`：16/16 PASS。
- `pnpm run build`：PASS（并行双 build 曾竞争同一 dist 目录，单独重跑通过，不计产品失败）。
- 边界：免费 Workers AI 不保证任意提示每次都满足严格 JSON/AppSpec；额度耗尽或输出不合法时透明 fallback，已有项目和版本读取不受影响。
