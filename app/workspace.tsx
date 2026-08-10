"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createSandboxDocument } from "../lib/code-bundle";
import type { AppSpec, CodeBundleV1, ProjectSnapshot, VersionSnapshot, WorkspaceSnapshot } from "../lib/types";

type ApiResult<T> = { data: T | null; error: { code: string; message: string } | null };

const templates = [
  { label: "交互计数器", prompt: "创建一个计数器，显示数字，提供 +1、-1、重置，刷新后保留结果。" },
  { label: "Todo 清单", prompt: "创建 Todo 清单，可新增、完成、删除任务，刷新后恢复。" },
  { label: "小费计算器", prompt: "Build a tip calculator with bill amount, percentage, people count, calculated total and reset." },
];

const roleInitials: Record<string, string> = { product: "EM", architecture: "BO", design: "IR", engineering: "AL" };

function randomChannelToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/gu, "");
}

async function api<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const payload = (await response.json()) as ApiResult<T>;
  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? "请求失败");
  return payload.data as T;
}

async function executeProject(projectId: string, requestId: string) {
  const response = await fetch(`/api/projects/${projectId}/execute`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId }) });
  const payload = await response.json() as ApiResult<ProjectSnapshot> | { project: ProjectSnapshot; run: { id: string; publicStatus: "FINALIZING" }; retryAfterMs: number };
  if (!response.ok && response.status !== 202) {
    const error = "error" in payload ? payload.error : null;
    throw new Error(error?.message ?? "生成失败");
  }
  if (response.status === 202 && "project" in payload) return payload.project;
  if ("data" in payload && payload.data) return payload.data;
  throw new Error("生成响应格式无效");
}

export function Workspace() {
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot>({ projects: [], activeProjectId: null });
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState("");
  const [visibleSteps, setVisibleSteps] = useState(4);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewMode, setPreviewMode] = useState<"preview" | "code">("preview");

  const activeProject = workspace.projects.find((project) => project.id === workspace.activeProjectId) ?? null;
  const isBuilding = building || activeProject?.status === "BUILDING";
  const activeVersion = activeProject?.versions.find((version) => version.id === activeProject.currentVersionId) ?? activeProject?.versions[0] ?? null;

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
      const requestId = crypto.randomUUID();
      const project = activeProject
        ? await api<ProjectSnapshot>(`/api/projects/${activeProject.id}/generate`, {
            method: "POST",
            body: JSON.stringify({ prompt: value, requestId, baseVersionId: activeProject.currentVersionId }),
          })
        : await api<ProjectSnapshot>("/api/projects", {
            method: "POST",
            body: JSON.stringify({ prompt: value, requestId }),
          });
      setWorkspace((current) => ({
        projects: [project, ...current.projects.filter((item) => item.id !== project.id)],
        activeProjectId: project.id,
      }));
      const completed = await executeProject(project.id, requestId);
      setWorkspace((current) => ({ projects: [completed, ...current.projects.filter((item) => item.id !== completed.id)], activeProjectId: completed.id }));
      if (completed.status === "READY") setPrompt("");
      setVisibleSteps(4);
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
    setPreviewMode("preview");
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
                <div className="run-head"><span className="spark">✦</span><div><strong>{isBuilding ? "Agent 团队正在构建" : activeProject.status === "FAILED" ? "构建未完成" : "构建完成"}</strong><small>{isBuilding ? "AI 正在规划并生成代码，刷新后会继续恢复" : activeProject.status === "FAILED" ? `错误：${activeProject.errorCode ?? "GENERATION_FAILED"}` : activeProject.generation?.source === "workers_ai" ? `Qwen 代码生成 · ${activeProject.generation.durationMs}ms` : `计数器编译器 · ${activeProject.generation?.fallbackReason ?? "AI_UNAVAILABLE"}`}</small></div><em>{isBuilding ? "BUILDING" : activeProject.status === "FAILED" ? "FAILED" : activeProject.generation?.source === "workers_ai" ? "AI · QWEN" : "DETERMINISTIC"}</em></div>
                <div className="agent-steps">
                  {activeProject.steps.map((step, index) => {
                    const shown = step.status === "COMPLETED" && (isBuilding || index < visibleSteps);
                    const running = step.status === "RUNNING";
                    return <div key={`${step.role}-${index}`} className={`agent-step ${shown ? "done" : "waiting"}`}>
                      <span className={`agent-avatar ${step.role}`}>{roleInitials[step.role]}</span>
                      <div><strong>{step.name}</strong><p>{shown ? `${step.summary}${step.durationMs != null ? ` · ${(step.durationMs / 1000).toFixed(1)}s` : ""}${step.attemptNo === 2 ? " · 已自动修复" : ""}${step.artifact?.normalized ? " · 已安全规范化" : ""}` : running ? "正在调用模型并校验产物…" : "等待上一阶段完成…"}</p></div>
                      <span className="step-state">{shown ? "✓" : running ? "↻" : "···"}</span>
                    </div>;
                  })}
                </div>
              </div>
              {!isBuilding && activeProject.status === "READY" && <div className="assistant-note"><span>✦</span><p>{activeProject.messages.filter((item) => item.role === "assistant").at(-1)?.content}<br /><small>{activeProject.generation?.source === "workers_ai" ? "本版本由 Cloudflare Workers AI 生成 HTML、CSS、JavaScript，并通过服务端安全校验。" : `AI 代码生成未完成（${activeProject.generation?.fallbackReason ?? "AI_UNAVAILABLE"}），本计数器由需求对齐的安全编译器生成。`} 可以继续提出具体修改。</small></p></div>}
            </div>
          )}
        </div>

        <div className="composer-wrap">
          {error && <div className="error-banner"><span>!</span>{error}<button onClick={() => setError("")}>×</button></div>}
          <form className="composer" onSubmit={submit}>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={2000} placeholder={activeProject ? "继续修改这个应用，例如：增加搜索、换成暖色并保存状态…" : "描述你想构建的纯前端应用…"} />
            <div className="composer-actions"><span>{prompt.length}/2000</span><button disabled={!prompt.trim() || isBuilding}>{isBuilding ? "构建中" : activeProject ? "继续迭代 ↗" : "开始构建 ↗"}</button></div>
          </form>
        </div>
      </section>

      <section className="preview-panel">
        <header className="preview-toolbar">
          <div className="window-dots"><i /><i /><i /></div>
          {activeVersion?.artifactKind === "code_bundle" && <div className="preview-tabs"><button className={previewMode === "preview" ? "active" : ""} onClick={() => setPreviewMode("preview")}>预览</button><button className={previewMode === "code" ? "active" : ""} onClick={() => setPreviewMode("code")}>代码</button></div>}
          <div className="device-toggle"><button className={device === "desktop" ? "active" : ""} onClick={() => setDevice("desktop")}>▱</button><button className={device === "mobile" ? "active" : ""} onClick={() => setDevice("mobile")}>▯</button></div>
          {activeProject ? <select aria-label="选择版本" value={activeProject.currentVersionId ?? ""} onChange={(event) => activate(event.target.value)}>{activeProject.versions.map((version) => <option key={version.id} value={version.id}>Version {version.versionNo}</option>)}</select> : <span className="preview-badge">LIVE PREVIEW</span>}
        </header>
        <div className={`preview-stage ${device}`}>
          {activeProject?.currentVersionId && activeVersion ? (
            activeVersion.artifactKind === "code_bundle"
              ? <CodeBundleView key={activeVersion.id} projectId={activeProject.id} version={activeVersion} mode={previewMode} />
              : <AppPreview key={activeVersion.id} spec={activeVersion.appSpec} />
          ) : <PreviewEmpty loading={loading} />}
        </div>
      </section>
    </main>
  );
}

function CodeBundleView({ projectId, version, mode }: { projectId: string; version: Extract<VersionSnapshot, { artifactKind: "code_bundle" }>; mode: "preview" | "code" }) {
  const [runtimeError, setRuntimeError] = useState("");
  const [file, setFile] = useState<keyof CodeBundleV1["files"]>("index.html");
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [channelToken, setChannelToken] = useState(randomChannelToken);
  const srcDoc = useMemo(() => createSandboxDocument(version.codeBundle, channelToken), [version.codeBundle, channelToken]);

  useEffect(() => {
    const allowedOps = new Set(["get", "set", "delete", "list", "clear"]);
    const listener = async (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow || event.origin !== "null") return;
      const data = event.data as Record<string, unknown> | null;
      if (!data || typeof data !== "object" || Array.isArray(data) || data.channelToken !== channelToken) return;
      if (data.type === "atoms:runtime:error") {
        if (typeof data.code === "string") setRuntimeError(data.code === "RUNTIME_ERROR" ? "生成应用运行时出现错误。" : "生成应用中的异步操作失败。");
        return;
      }
      if (data.type !== "atoms:storage:request" || typeof data.requestId !== "string" || typeof data.op !== "string" || !allowedOps.has(data.op)) return;
      const op = data.op;
      const expected = op === "set" ? ["type", "channelToken", "requestId", "op", "key", "value"] : op === "get" || op === "delete" ? ["type", "channelToken", "requestId", "op", "key"] : ["type", "channelToken", "requestId", "op"];
      const actual = Object.keys(data).sort(); const expectedSorted = [...expected].sort();
      if (actual.length !== expectedSorted.length || actual.some((key, index) => key !== expectedSorted[index])) return;
      if ((op === "get" || op === "set" || op === "delete") && typeof data.key !== "string") return;
      const body: Record<string, unknown> = { requestId: data.requestId, op };
      if ("key" in data) body.key = data.key;
      if (op === "set") body.value = data.value;
      try {
        const response = await fetch(`/api/projects/${projectId}/storage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        const payload = await response.json() as { ok: boolean; data?: unknown; error?: { code?: string; message?: string } };
        iframeRef.current?.contentWindow?.postMessage(payload.ok
          ? { type: "atoms:storage:response", channelToken, requestId: data.requestId, ok: true, data: payload.data }
          : { type: "atoms:storage:response", channelToken, requestId: data.requestId, ok: false, error: { code: payload.error?.code ?? "PERSISTENCE_ERROR", message: payload.error?.message ?? "状态保存失败" } }, "*");
      } catch {
        iframeRef.current?.contentWindow?.postMessage({ type: "atoms:storage:response", channelToken, requestId: data.requestId, ok: false, error: { code: "PERSISTENCE_ERROR", message: "状态服务不可用" } }, "*");
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [channelToken, projectId]);

  async function copyCode() {
    await navigator.clipboard.writeText(version.codeBundle.files[file]);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  if (mode === "code") return <div className="code-viewer">
    <div className="code-file-tabs">{(Object.keys(version.codeBundle.files) as Array<keyof CodeBundleV1["files"]>).map((name) => <button key={name} className={file === name ? "active" : ""} onClick={() => setFile(name)}>{name}</button>)}<button className="copy-code" onClick={copyCode}>{copied ? "已复制" : "复制"}</button></div>
    <pre><code>{version.codeBundle.files[file]}</code></pre>
  </div>;

  return <div className="sandbox-wrap">
    {runtimeError && <div className="sandbox-error"><span>!</span><p>{runtimeError}<small>代码仍被保留，可重置预览后重试。</small></p><button onClick={() => { setRuntimeError(""); setChannelToken(randomChannelToken()); }}>重置预览</button></div>}
    <iframe key={channelToken} ref={iframeRef} title={`${version.codeBundle.title} 交互预览`} sandbox="allow-scripts" srcDoc={srcDoc} />
  </div>;
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
    {spec.stats.length > 0 && <div className="stats-grid">{spec.stats.map((stat) => <article key={stat.id}><span>{stat.label}</span><strong>{stat.value}</strong><small>{stat.delta && !/^(null|undefined)$/i.test(stat.delta.trim()) ? stat.delta : "实时概览"}</small></article>)}</div>}
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
