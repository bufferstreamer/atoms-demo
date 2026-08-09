# Atoms AI App Builder Demo - 冻结后变更

| CHG ID | 日期 | 原因与证据 | 影响的 FR/ADR/Contract/TASK/Case | 兼容/排期/回滚影响 | 批准者 | 重新冻结 |
| --- | --- | --- | --- | --- | --- | --- |
| CHG-001 | 2026-08-09 | 发布准备发现 S007 错把部署期会变化的 `.openai/hosting.json` 登记为不可变输入；保留初始值为受控快照，实时文件写入 Sites 项目 ID 与 D1 绑定 | DEC-001/003, TASK-002/005, VT-004/009/016 | 不改变产品范围或数据模型；部署需 `DB`，回滚为上一 Sites 版本且保留 D1 | codex（执行用户已批准的在线 Demo 交付） | source 由 `codex-independent-source-reviewer-chg001` CONFIRMED；scope/design/acceptance 已重新冻结 |
| CHG-002 | 2026-08-09 | 用户所在网络无法访问 `chatgpt.site`，要求新增可访问的 Cloudflare `workers.dev` 发布目标 | NFR-005, TASK-005, VT-009/016 | 产品和数据契约不变；新增独立 D1 与 Worker，Sites 版本保留为回退；Cloudflare 免费额度可能触发日限额 | 用户明确批准全部 Cloudflare 部署环节 | 部署后以新地址补充运行证据，不修改冻结验收语义 |
