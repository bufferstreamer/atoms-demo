import type { Accent, AgentStep, AppKind, AppSpec } from "./types";

export class InputError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

export function cleanPrompt(value: unknown) {
  if (typeof value !== "string") throw new InputError("INVALID_PROMPT", "请输入你想构建的应用。", 400);
  const prompt = Array.from(value).filter((character) => {
    const code = character.charCodeAt(0);
    return code === 9 || code === 10 || code === 13 || code >= 32 && code !== 127;
  }).join("").trim();
  if (!prompt) throw new InputError("EMPTY_PROMPT", "先写下一句话需求，再开始生成。", 400);
  if (prompt.length > 800) throw new InputError("PROMPT_TOO_LONG", "需求最多 800 个字符，请精简后重试。", 400);
  return prompt;
}

function inferKind(prompt: string): AppKind {
  const p = prompt.toLowerCase();
  if (/清单|任务|待办|tracker|todo|进度/.test(p)) return "tracker";
  if (/落地页|官网|品牌|landing|介绍页|产品页/.test(p)) return "landing";
  return "dashboard";
}

function inferAccent(prompt: string): Accent {
  if (/暖|珊瑚|橙|coral/.test(prompt)) return "coral";
  if (/绿|薄荷|mint/.test(prompt)) return "mint";
  if (/蓝|blue/.test(prompt)) return "blue";
  return "violet";
}

function subject(prompt: string) {
  if (/旅行|行程|旅游/.test(prompt)) return { name: "Roamly", noun: "行程" };
  if (/健身|运动|训练/.test(prompt)) return { name: "Pulse", noun: "训练" };
  if (/客户|销售|crm/i.test(prompt)) return { name: "Northstar", noun: "客户" };
  if (/读书|阅读/.test(prompt)) return { name: "Bookmark", noun: "书目" };
  if (/发布|上线|launch/i.test(prompt)) return { name: "Launchpad", noun: "任务" };
  return { name: "Spark", noun: "项目" };
}

export function generateAppSpec(prompt: string, previous?: AppSpec): { spec: AppSpec; summary: string; steps: AgentStep[] } {
  const clean = cleanPrompt(prompt);
  const base = subject(clean);
  const kind = previous ? previous.kind : inferKind(clean);
  const accent = inferAccent(clean);
  const wantsCompact = /紧凑|compact/.test(clean);
  const wantsStats = /统计|数据|指标|概览|看板|dashboard/.test(clean);
  const wantsForm = /表单|新增|添加|录入|收集/.test(clean);

  let spec: AppSpec;
  if (previous) {
    const supported = /暖|珊瑚|橙|绿|薄荷|蓝|紫|紧凑|舒适|统计|数据|指标|表单|新增|添加|标题|副标题|tracker|清单/.test(clean);
    if (!supported) {
      throw new InputError(
        "UNSUPPORTED_CHANGE",
        "这次修改超出当前规则范围。你可以试试：切换珊瑚色、改为紧凑布局、增加统计卡或增加表单。",
        422,
      );
    }
    spec = structuredClone(previous);
    spec.theme.accent = accent;
    if (wantsCompact) spec.theme.density = "compact";
    if (wantsStats && spec.stats.length < 4) {
      spec.stats.push({ id: `stat-${spec.stats.length + 1}`, label: "本周增长", value: "+18%", delta: "表现良好" });
    }
    if (wantsForm && !spec.form) {
      spec.form = {
        id: "quick-add",
        title: `添加${base.noun}`,
        fields: [{ id: "title", label: `${base.noun}名称`, placeholder: "输入名称", required: true }],
        submitLabel: "添加到列表",
      };
      spec.actions.push({ id: "add-card", label: "添加", kind: "add_item", targetId: "quick-add" });
    }
  } else if (kind === "tracker") {
    spec = {
      schemaVersion: 1,
      kind,
      title: `${base.name} 发布清单`,
      subtitle: "把复杂目标拆成今天可以完成的一步。",
      theme: { accent, density: wantsCompact ? "compact" : "comfortable" },
      stats: [{ id: "progress", label: "完成率", value: "67%", delta: "4 / 6 已完成" }],
      filters: [],
      cards: [
        { id: "task-1", title: "确认核心用户旅程", description: "Owner · Emma", tag: "产品", done: true },
        { id: "task-2", title: "完成首个可用版本", description: "Owner · Alex", tag: "工程", done: false },
        { id: "task-3", title: "邀请 5 位测试用户", description: "Owner · Mike", tag: "增长", done: false },
      ],
      form: {
        id: "task-form",
        title: "添加下一步",
        fields: [{ id: "task", label: "任务名称", placeholder: "例如：准备发布说明", required: true }],
        submitLabel: "加入清单",
      },
      actions: [
        { id: "toggle-2", label: "切换完成", kind: "toggle_item", targetId: "task-2" },
        { id: "add-task", label: "添加任务", kind: "add_item", targetId: "task-form" },
      ],
    };
  } else if (kind === "landing") {
    spec = {
      schemaVersion: 1,
      kind,
      title: `${base.name}，让好想法更快被看见`,
      subtitle: "一个聚焦、清晰、可以立刻行动的产品页面。",
      theme: { accent, density: "comfortable" },
      stats: [
        { id: "users", label: "早期用户", value: "1,240+", delta: "+24% 本月" },
        { id: "rating", label: "用户评分", value: "4.9 / 5" },
      ],
      filters: [],
      cards: [
        { id: "benefit-1", title: "更快开始", description: "用一条清晰路径带用户看到价值。", tag: "简单" },
        { id: "benefit-2", title: "真实可用", description: "按钮、表单和状态都有实际反馈。", tag: "可靠" },
        { id: "benefit-3", title: "持续迭代", description: "每次反馈都能成为一个新版本。", tag: "可扩展" },
      ],
      form: {
        id: "waitlist",
        title: "加入首批体验",
        fields: [{ id: "email", label: "工作邮箱", placeholder: "you@company.com", required: true }],
        submitLabel: "申请体验",
      },
      actions: [
        { id: "join", label: "申请体验", kind: "show_toast", message: "申请已记录，我们会尽快联系你。" },
      ],
    };
  } else {
    spec = {
      schemaVersion: 1,
      kind,
      title: `${base.name} ${base.noun}看板`,
      subtitle: `把每个${base.noun}的进展、状态和下一步放在同一处。`,
      theme: { accent, density: wantsCompact ? "compact" : "comfortable" },
      stats: [
        { id: "active", label: `进行中${base.noun}`, value: "6", delta: "+2 本周" },
        { id: "done", label: "完成率", value: "72%", delta: "+8%" },
        { id: "focus", label: "今日重点", value: "3" },
      ],
      filters: [{ id: "status", label: "状态", options: ["全部", "筹备中", "已完成"], defaultValue: "全部", allValue: "全部" }],
      cards: [
        { id: "card-1", title: `${base.noun} Alpha`, description: "关键路径已确认，等待最后校验。", tag: "筹备中", filterValues: { status: "筹备中" } },
        { id: "card-2", title: `${base.noun} Aurora`, description: "所有任务已经完成并归档。", tag: "已完成", filterValues: { status: "已完成" } },
        { id: "card-3", title: `${base.noun} Atlas`, description: "正在补齐内容和协作人。", tag: "筹备中", filterValues: { status: "筹备中" } },
      ],
      actions: [
        { id: "filter-active", label: "只看筹备中", kind: "set_filter", targetId: "status", value: "筹备中" },
        { id: "notify", label: "生成周报", kind: "show_toast", message: "本周进展摘要已生成。" },
      ],
    };
  }

  validateAppSpec(spec);
  const summary = previous ? `根据反馈更新为 ${spec.theme.accent} 主题，并保留上一版本。` : `创建了一个 ${spec.kind} 应用，包含 ${spec.cards.length} 个内容模块与真实交互。`;
  const steps: AgentStep[] = [
    { role: "product", name: "Emma · Product", summary: `识别核心场景：${base.noun}管理；收敛为 ${spec.kind} MVP。`, status: "COMPLETED" },
    { role: "architecture", name: "Bob · Architect", summary: `定义 AppSpec v1、${spec.cards.length} 个内容单元与服务端持久化边界。`, status: "COMPLETED" },
    { role: "design", name: "Iris · Designer", summary: `采用 ${spec.theme.accent} 主题和 ${spec.theme.density} 信息密度。`, status: "COMPLETED" },
    { role: "engineering", name: "Alex · Engineer", summary: `完成白名单渲染与 ${spec.actions.length} 个可执行交互。`, status: "COMPLETED" },
  ];
  return { spec, summary, steps };
}

export function validateAppSpec(spec: AppSpec) {
  if (spec.schemaVersion !== 1) throw new InputError("APP_SPEC_INVALID", "不支持的应用规格版本。", 422);
  if (!spec.title || spec.title.length > 60 || spec.cards.length < 1 || spec.cards.length > 12) {
    throw new InputError("APP_SPEC_INVALID", "生成规格超出安全限制。", 422);
  }
  const filterIds = new Set(spec.filters.map((f) => f.id));
  const cardIds = new Set(spec.cards.map((c) => c.id));
  for (const filter of spec.filters) {
    if (!filter.options.includes(filter.defaultValue) || (filter.allValue && !filter.options.includes(filter.allValue))) {
      throw new InputError("APP_SPEC_INVALID", "筛选默认值无效。", 422);
    }
  }
  for (const action of spec.actions) {
    if (action.kind === "set_filter") {
      const filter = spec.filters.find((f) => f.id === action.targetId);
      if (!filter || !filter.options.includes(action.value)) throw new InputError("APP_SPEC_INVALID", "筛选动作无效。", 422);
    }
    if (action.kind === "toggle_item" && !cardIds.has(action.targetId)) throw new InputError("APP_SPEC_INVALID", "卡片动作无效。", 422);
    if (action.kind === "add_item" && spec.form?.id !== action.targetId) throw new InputError("APP_SPEC_INVALID", "表单动作无效。", 422);
  }
  for (const card of spec.cards) {
    for (const filterId of Object.keys(card.filterValues ?? {})) {
      if (!filterIds.has(filterId)) throw new InputError("APP_SPEC_INVALID", "卡片筛选关联无效。", 422);
    }
  }
}
