export type Accent = "violet" | "coral" | "mint" | "blue";
export type AppKind = "dashboard" | "tracker" | "landing";

export type AppSpec = {
  schemaVersion: 1;
  kind: AppKind;
  title: string;
  subtitle: string;
  theme: { accent: Accent; density: "comfortable" | "compact" };
  stats: Array<{ id: string; label: string; value: string; delta?: string }>;
  filters: Array<{
    id: string;
    label: string;
    options: string[];
    defaultValue: string;
    allValue?: string;
  }>;
  cards: Array<{
    id: string;
    title: string;
    description: string;
    tag: string;
    filterValues?: Record<string, string>;
    done?: boolean;
  }>;
  form?: {
    id: string;
    title: string;
    fields: Array<{
      id: string;
      label: string;
      placeholder: string;
      required: boolean;
    }>;
    submitLabel: string;
  };
  actions: Array<
    | { id: string; label: string; kind: "set_filter"; targetId: string; value: string }
    | { id: string; label: string; kind: "toggle_item"; targetId: string }
    | { id: string; label: string; kind: "add_item"; targetId: string }
    | { id: string; label: string; kind: "show_toast"; message: string }
  >;
};

export type CodeBundleV1 = {
  schemaVersion: 1;
  kind: "code_bundle";
  title: string;
  summary: string;
  entry: "index.html";
  files: {
    "index.html": string;
    "styles.css": string;
    "app.js": string;
  };
  capabilities: { storage: boolean };
};

export type ArtifactKind = "app_spec" | "code_bundle";

export type AgentStep = {
  role: "product" | "architecture" | "design" | "engineering";
  name: string;
  summary: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  source?: "workers_ai" | "deterministic" | null;
  model?: string | null;
  durationMs?: number | null;
  attemptNo?: number | null;
  artifact?: Record<string, unknown> | null;
  errorCode?: string | null;
  sharedCallId?: string | null;
};

type VersionCommon = {
  id: string;
  versionNo: number;
  parentVersionId: string | null;
  changeSummary: string;
  createdAt: string;
};

export type VersionSnapshot = VersionCommon & (
  | { artifactKind: "app_spec"; appSpec: AppSpec; codeBundle: null }
  | { artifactKind: "code_bundle"; appSpec: null; codeBundle: CodeBundleV1 }
);

export type ProjectSnapshot = {
  id: string;
  title: string;
  prompt: string;
  status: string;
  errorCode: string | null;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  latestRunId: string | null;
  latestRequestId: string | null;
  messages: Array<{ id: string; role: string; content: string; createdAt: string }>;
  steps: AgentStep[];
  generation: {
    source: "workers_ai" | "deterministic";
    model: string;
    outcome: "SUCCESS" | "FALLBACK";
    failureCode: string | null;
    fallbackReason?: string | null;
    durationMs: number;
    artifactKind?: ArtifactKind | null;
  } | null;
  versions: VersionSnapshot[];
};

export type WorkspaceSnapshot = {
  projects: ProjectSnapshot[];
  activeProjectId: string | null;
};
