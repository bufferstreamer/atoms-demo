# MGX / Atoms Official Help Observations

采集日期：2026-08-09。

## 来源

- `https://support.mgx.dev/en`：入口当前被本机安全页拦截，无法直接浏览。
- `https://atomshelpcenter.pre.mgx.dev/en`：官方帮助中心公开可索引副本。
- `https://atomshelpcenter.pre.mgx.dev/en/articles/12174308-communicating-with-agents`
- `https://atomshelpcenter.pre.mgx.dev/en/articles/12129788-supabase-connect`
- `https://atomshelpcenter.pre.mgx.dev/en/articles/12174758-open-source`
- `https://atomshelpcenter.pre.mgx.dev/en/articles/13222322-github-connect`

## 已核对事实

- MGX 已更名为 Atoms，产品建立在 MetaGPT 多智能体协作理念上。
- 用户用自然语言描述目标，Agent 负责分析、规划、开发、数据处理和持续改进。
- 官方列出 Team Leader、Product Manager、Architect、Engineer、Data Analyst、Deep Researcher、SEO Specialist 七类角色。
- 官方建议复杂项目先构建 MVP，再逐模块迭代。
- Atoms 工作区包含对话、应用生成和预览；Publish 生成稳定公开链接，Share 用于导出或分享。
- 外部后端连接用于让数据跨刷新和会话保留；官方文档将“刷新后仍存在”作为持久化验证方式。
- GitHub 被定义为长期代码保存和版本协作能力，Atoms 工作区负责持续生成与修改。

## 对本期设计的启发（非现状事实）

- Demo 应让 Agent 的分工与进度可见，而不是仅显示统一加载动画。
- 应把聊天、Agent 进度和应用预览放在同一工作区，减少上下文切换。
- 应支持对生成结果继续提出修改，并保留版本历史。

