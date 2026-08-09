"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { AppSpec, ProjectSnapshot, WorkspaceSnapshot } from "../lib/types";

type ApiResult<T> = { data: T | null; error: { code: string; message: string } | null };

const templates = [
  { label: "旅行看板", prompt: "帮我做一个个人旅行计划看板，能按状态筛选行程" },
  { label: "发布清单", prompt: "创建一个产品发布任务清单，可以添加任务和切换完成状态" },
  { label: "产品官网", prompt: "为一个 AI 效率工具制作产品落地页，带真实申请表单" },
];

const roleInitials: Record<string, string> = { product: "EM", architecture: "BO", design: "IR", engineering: "AL" };

async function api<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const payload = (await response.json()) as ApiResult<T>;
  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? "请求失败");
  return payload.data as T;
}

export function Workspace() {
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot>({ projects: [], activeProjectId: null });
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState("");
  const [visibleSteps, setVisibleSteps] = useState(4);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  const activeProject = workspace.projects.find((project) => project.id === workspace.activeProjectId) ?? null;
  const isBuilding = building || activeProject?.status === "BUILDING";

  useEffect(() => {
    api<WorkspaceSnapshot>("/api/workspace")
      .then((snapshot) => {
        setWorkspace(snapshot);
        const active = snapshot.projects.find((project) => project.id === snapshot.activeProjectId);
        if (active?.status === "BUILDING") setPrompt(active.messages.filter((item) => item.role === "user").at(-1)?.content ?? active.prompt);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "加载失败"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeProject?.status !== "BUILDING") return;
    let cancelled = false;
    let timer = 0;
    const poll = async () => {
      try {
        const project = await api<ProjectSnapshot>(`/api/projects/${activeProject.id}`);
        if (cancelled) return;
        setWorkspace((current) => ({ ...current, projects: current.projects.map((item) => item.id === project.id ? project : item) }));
        if (project.status === "READY") {
          setPrompt("");
          setVisibleSteps(4);
          return;
        }
        if (project.status === "FAILED") {
          setError(project.errorCode === "RUN_TIMEOUT" ? "生成任务超时，请重新提交。" : "生成没有完成，请重新提交。");
          return;
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "恢复生成状态失败");
      }
      if (!cancelled) timer = window.setTimeout(poll, 1500);
    };
    timer = window.setTimeout(poll, 1500);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [activeProject?.id, activeProject?.status]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = prompt.trim();
    if (!value || isBuilding) return;
    setError("");
    setVisibleSteps(0);
    setBuilding(true);
    try {
      const project = activeProject
        ? await api<ProjectSnapshot>(`/api/projects/${activeProject.id}/generate`, {
            method: "POST",
            body: JSON.stringify({ prompt: value, requestId: crypto.randomUUID(), baseVersionId: activeProject.currentVersionId }),
          })
        : await api<ProjectSnapshot>("/api/projects", {
            method: "POST",
            body: JSON.stringify({ prompt: value, requestId: crypto.randomUUID() }),
          });
      setWorkspace((current) => ({
        projects: [project, ...current.projects.filter((item) => item.id !== project.id)],
        activeProjectId: project.id,
      }));
      if (project.status === "READY") setPrompt("");
      setVisibleSteps(project.status === "READY" ? 4 : 0);
      setBuilding(false);
    } catch (cause) {
      setBuilding(false);
      setError(cause instanceof Error ? cause.message : "生成失败，请重试");
    }
  }

  async function activate(versionId: string) {
    if (!activeProject?.currentVersionId || versionId === activeProject.currentVersionId) return;
    try {
      const project = await api<ProjectSnapshot>(`/api/projects/${activeProject.id}/versions/${versionId}/activate`, {
        method: "POST",
        body: JSON.stringify({ expectedCurrentVersionId: activeProject.currentVersionId }),
      });
      setWorkspace((current) => ({ ...current, projects: current.projects.map((item) => item.id === project.id ? project : item) }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "切换版本失败");
    }
  }

  function chooseProject(projectId: string | null) {
    setWorkspace((current) => ({ ...current, activeProjectId: projectId }));
    setPrompt("");
    setError("");
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">A</span><span>Atomize</span></div>
        <button className="new-project" onClick={() => chooseProject(null)}><span>＋</span> 新建应用</button>
        <div className="side-label">你的项目</div>
        <div className="project-list">
          {workspace.projects.map((project) => (
            <button key={project.id} className={`project-item ${project.id === activeProject?.id ? "active" : ""}`} onClick={() => chooseProject(project.id)}>
              <span className="project-icon">{project.title.slice(0, 1)}</span>
              <span><strong>{project.title}</strong><small>v{project.versions[0]?.versionNo ?? 1} · 已保存</small></span>
            </button>
          ))}
          {!loading && workspace.projects.length === 0 && <p className="no-project">你的第一个想法，会出现在这里。</p>}
        </div>
        <div className="sidebar-foot"><span className="status-dot" /> Workers AI + D1 已启用</div>
      </aside>

      <section className="conversation">
        <header className="topbar">
          <div><span className="eyebrow">AI APP WORKSPACE</span><h1>{activeProject?.title ?? "把一句想法，变成可用应用"}</h1></div>
          <div className="saved"><span>●</span> 自动保存</div>
        </header>

        <div className="chat-scroll">
          {!activeProject ? (
            <div className="welcome">
              <div className="orbit"><span>✦</span><i /><b /></div>
              <span className="eyebrow">MEET YOUR AI TEAM</span>
              <h2>描述你想构建的产品，<br />四位 Agent 会一起把它做出来。</h2>
              <p>从需求、架构到交互和实现，每一步都看得见。生成结果会直接出现在右侧，并且刷新后仍然保留。</p>
              <div className="templates">
                {templates.map((template) => <button key={template.label} onClick={() => setPrompt(template.prompt)}><span>↗</span><strong>{template.label}</strong><small>{template.prompt}</small></button>)}
              </div>
            </div>
          ) : (
            <div className="thread">
              <div className="user-message"><span>你</span><p>{activeProject.messages.filter((item) => item.role === "user").at(-1)?.content}</p></div>
              <div className="run-card">
                <div className="run-head"><span className="spark">✦</span><div><strong>{isBuilding ? "Agent 团队正在构建" : activeProject.status === "FAILED" ? "构建未完成" : "构建完成"}</strong><small>{isBuilding ? "真实模型正在生成，刷新后也会继续恢复" : activeProject.status === "FAILED" ? `错误：${activeProject.errorCode ?? "GENERATION_FAILED"}` : activeProject.generation?.source === "workers_ai" ? `真实模型生成 · ${activeProject.generation.durationMs}ms` : `规则引擎安全降级 · ${activeProject.generation?.failureCode ?? "AI_UNAVAILABLE"}`}</small></div><em>{isBuilding ? "BUILDING" : activeProject.status === "FAILED" ? "FAILED" : activeProject.generation?.source === "workers_ai" ? "AI · LLAMA" : "FALLBACK"}</em></div>
                <div className="agent-steps">
                  {activeProject.steps.map((step, index) => {
                    const shown = !isBuilding && index < visibleSteps && step.status === "COMPLETED";
                    return <div key={`${step.role}-${index}`} className={`agent-step ${shown ? "done" : "waiting"}`}>
                      <span className={`agent-avatar ${step.role}`}>{roleInitials[step.role]}</span>
                      <div><strong>{step.name}</strong><p>{shown ? step.summary : "等待上一阶段完成…"}</p></div>
                      <span className="step-state">{shown ? "✓" : "···"}</span>
                    </div>;
                  })}
                </div>
              </div>
              {!isBuilding && activeProject.status === "READY" && <div className="assistant-note"><span>✦</span><p>{activeProject.messages.filter((item) => item.role === "assistant").at(-1)?.content}<br /><small>{activeProject.generation?.source === "workers_ai" ? "本版本由 Cloudflare Workers AI 生成并通过 AppSpec 安全校验。" : `模型未完成（${activeProject.generation?.failureCode ?? "AI_UNAVAILABLE"}），已使用规则引擎安全降级。`} 可以继续提出任意具体修改。</small></p></div>}
            </div>
          )}
        </div>

        <div className="composer-wrap">
          {error && <div className="error-banner"><span>!</span>{error}<button onClick={() => setError("")}>×</button></div>}
          <form className="composer" onSubmit={submit}>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={800} placeholder={activeProject ? "继续修改这个应用，例如：换成暖色并增加统计卡…" : "告诉 Agent 团队你想构建什么…"} />
            <div className="composer-actions"><span>{prompt.length}/800</span><button disabled={!prompt.trim() || isBuilding}>{isBuilding ? "构建中" : activeProject ? "继续迭代 ↗" : "开始构建 ↗"}</button></div>
          </form>
        </div>
      </section>

      <section className="preview-panel">
        <header className="preview-toolbar">
          <div className="window-dots"><i /><i /><i /></div>
          <div className="device-toggle"><button className={device === "desktop" ? "active" : ""} onClick={() => setDevice("desktop")}>▱</button><button className={device === "mobile" ? "active" : ""} onClick={() => setDevice("mobile")}>▯</button></div>
          {activeProject ? <select aria-label="选择版本" value={activeProject.currentVersionId ?? ""} onChange={(event) => activate(event.target.value)}>{activeProject.versions.map((version) => <option key={version.id} value={version.id}>Version {version.versionNo}</option>)}</select> : <span className="preview-badge">LIVE PREVIEW</span>}
        </header>
        <div className={`preview-stage ${device}`}>
          {activeProject?.currentVersionId ? (
            <AppPreview key={activeProject.currentVersionId} spec={activeProject.versions.find((version) => version.id === activeProject.currentVersionId)?.appSpec ?? activeProject.versions[0].appSpec} />
          ) : <PreviewEmpty loading={loading} />}
        </div>
      </section>
    </main>
  );
}

function PreviewEmpty({ loading }: { loading: boolean }) {
  return <div className="preview-empty"><div className="empty-grid" /><span>✦</span><h3>{loading ? "正在恢复工作区" : "你的应用将在这里出现"}</h3><p>{loading ? "从服务端读取项目与版本…" : "选择一个示例，或在左侧描述你的想法。"}</p><div className="empty-chip">交互预览 · 自动保存 · 版本历史</div></div>;
}

function AppPreview({ spec }: { spec: AppSpec }) {
  const [filters, setFilters] = useState<Record<string, string>>(() => Object.fromEntries(spec.filters.map((filter) => [filter.id, filter.defaultValue])));
  const [toggled, setToggled] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [added, setAdded] = useState<AppSpec["cards"]>([]);
  const [toast, setToast] = useState("");
  const cards = useMemo(() => [...spec.cards, ...added].filter((card) => spec.filters.every((filter) => {
    const value = filters[filter.id];
    return value === filter.allValue || !card.filterValues?.[filter.id] || card.filterValues[filter.id] === value;
  })), [spec, added, filters]);

  function runAction(action: AppSpec["actions"][number]) {
    if (action.kind === "set_filter") setFilters((current) => ({ ...current, [action.targetId]: action.value }));
    if (action.kind === "toggle_item") setToggled((current) => current.includes(action.targetId) ? current.filter((id) => id !== action.targetId) : [...current, action.targetId]);
    if (action.kind === "show_toast") { setToast(action.message); window.setTimeout(() => setToast(""), 2600); }
  }

  function submitForm(event: FormEvent) {
    event.preventDefault();
    if (!spec.form) return;
    const required = spec.form.fields.find((field) => field.required && !drafts[field.id]?.trim());
    if (required) { setToast(`请填写${required.label}`); return; }
    const title = drafts[spec.form.fields[0].id]?.trim() || "新项目";
    const description = spec.form.fields.slice(1).map((field) => drafts[field.id]).filter(Boolean).join(" · ") || "刚刚添加";
    setAdded((current) => [...current, { id: `local-${Date.now()}`, title, description, tag: "新建" }]);
    setDrafts({}); setToast("已添加到当前预览"); window.setTimeout(() => setToast(""), 2600);
  }

  return <div className={`generated-app accent-${spec.theme.accent} density-${spec.theme.density}`}>
    <nav className="generated-nav"><span className="generated-logo"><i>✦</i>{spec.title.split(" ")[0]}</span><div><button>Overview</button><button>Insights</button><span className="mini-avatar">ZU</span></div></nav>
    <section className="generated-hero"><span className="generated-kicker">YOUR LIVE APP</span><h2>{spec.title}</h2><p>{spec.subtitle}</p></section>
    {spec.stats.length > 0 && <div className="stats-grid">{spec.stats.map((stat) => <article key={stat.id}><span>{stat.label}</span><strong>{stat.value}</strong><small>{stat.delta ?? "实时概览"}</small></article>)}</div>}
    {spec.filters.length > 0 && <div className="filters">{spec.filters.map((filter) => <label key={filter.id}>{filter.label}<select value={filters[filter.id]} onChange={(event) => setFilters((current) => ({ ...current, [filter.id]: event.target.value }))}>{filter.options.map((option) => <option key={option}>{option}</option>)}</select></label>)}</div>}
    <div className={`generated-content ${spec.form ? "with-form" : ""}`}>
      <div className="cards-grid">{cards.map((card) => {
        const done = Boolean(card.done) !== toggled.includes(card.id);
        const toggleAction = spec.actions.find((action) => action.kind === "toggle_item" && action.targetId === card.id);
        return <article key={card.id} className={`content-card ${done ? "done" : ""}`}><span className="tag">{card.tag}</span><h3>{card.title}</h3><p>{card.description}</p>{toggleAction && <button onClick={() => runAction(toggleAction)}>{done ? "↺ 重新打开" : "✓ 标记完成"}</button>}</article>;
      })}</div>
      {spec.form && <form className="generated-form" onSubmit={submitForm}><span className="generated-kicker">QUICK ACTION</span><h3>{spec.form.title}</h3>{spec.form.fields.map((field) => <label key={field.id}>{field.label}<input value={drafts[field.id] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [field.id]: event.target.value }))} placeholder={field.placeholder} /></label>)}<button>{spec.form.submitLabel} ↗</button></form>}
    </div>
    <div className="generated-actions">{spec.actions.filter((action) => action.kind !== "toggle_item" && action.kind !== "add_item").map((action) => <button key={action.id} onClick={() => runAction(action)}>{action.label}</button>)}</div>
    {cards.length === 0 && <div className="no-results">没有符合当前筛选的内容。</div>}
    {toast && <div className="toast">✓ {toast}</div>}
  </div>;
}
