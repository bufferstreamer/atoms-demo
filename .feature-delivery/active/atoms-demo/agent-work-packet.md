# Atoms AI App Builder Demo - Agent 工作包

## 任务

执行 TASK-001~005，完成 FR-001~007 和 NFR-001~005。

## 可写边界

- 可写仓库/目录：`atoms-demo` 的 `app/`、`db/`、`drizzle/`、`.openai/hosting.json`、测试及本需求控制材料。
- 只读依赖：Sites Starter、MGX/Atoms 官方资料。
- 禁止改动：其他仓库；不得接入外部账号、密钥或收费模型。

## 权威输入

- PRD：`reference/prd.md`
- 技术方案/ADR：`design/technical-design.md`
- 跨仓契约：不适用
- VibeTest：`.vibetest/atoms-demo/`
- 当前代码/运行证据：`reference/current-project-observations.md`

## 外部快照与前置

- D1 是项目、消息、运行和版本的唯一事实源。
- AppSpec 仅允许结构化字段，预览不得执行用户 HTML 或脚本。
- 规则生成器必须随输入产生实质差异并支持版本化修改。
- 失败不得覆盖上一成功版本。

## 必须验证

执行 VT-001~009，提供构建、迁移、在线链接和真实浏览器主流程证据。

## 完成输出

- 代码变更及边界。
- 执行过的测试和证据。
- 未关闭 gap 和残余风险。
- 未修改其他仓库或未授权外部状态。
