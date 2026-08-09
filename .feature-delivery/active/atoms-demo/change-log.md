# Atoms AI App Builder Demo - 冻结后变更

| CHG ID | 日期 | 原因与证据 | 影响的 FR/ADR/Contract/TASK/Case | 兼容/排期/回滚影响 | 批准者 | 重新冻结 |
| --- | --- | --- | --- | --- | --- | --- |
| CHG-001 | 2026-08-09 | 发布准备发现 S007 错把部署期会变化的 `.openai/hosting.json` 登记为不可变输入；保留初始值为受控快照，实时文件写入 Sites 项目 ID 与 D1 绑定 | DEC-001/003, TASK-002/005, VT-004/009/016 | 不改变产品范围或数据模型；部署需 `DB`，回滚为上一 Sites 版本且保留 D1 | codex（执行用户已批准的在线 Demo 交付） | source 由 `codex-independent-source-reviewer-chg001` CONFIRMED；scope/design/acceptance 已重新冻结 |
| CHG-002 | 2026-08-09 | 用户所在网络无法访问 `chatgpt.site`，要求新增可访问的 Cloudflare `workers.dev` 发布目标 | NFR-005, TASK-005, VT-009/016 | 产品和数据契约不变；新增独立 D1 与 Worker，Sites 版本保留为回退；Cloudflare 免费额度可能触发日限额 | 用户明确批准全部 Cloudflare 部署环节 | 部署后以新地址补充运行证据，不修改冻结验收语义 |
| CHG-003 | 2026-08-09 | 用户确认当前规则生成不满足“真实智能体驱动”的预期，并明确批准接入模型；官方模型页复核后，免费账户选择 `@cf/zai-org/glm-4.7-flash`，Kimi K2.7 Code 因要求 Paid 不采用 | FR-002/003/004/006, NFR-001/002/004/005, DEC-002/007/009, DESIGN-001/002/004, TASK-003/005/006, VT-002/003/005/006/009/016/017/018/019 | AppSpec、D1 项目/版本和 UI 契约保持兼容；新增 Workers AI 外部依赖、两阶段 run reservation、生成来源审计、超时/非法输出降级和日额度风险；回滚可移除 AI binding 并恢复确定性生成 | 用户于 2026-08-09 明确批准“接入模型” | 五轮独立设计/验收复核于 2026-08-09 CONFIRMED；待重新冻结 |
