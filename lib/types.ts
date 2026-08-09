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

export type AgentStep = {
  role: "product" | "architecture" | "design" | "engineering";
  name: string;
  summary: string;
  status: "COMPLETED" | "FAILED";
};

export type VersionSnapshot = {
  id: string;
  versionNo: number;
  parentVersionId: string | null;
  changeSummary: string;
  appSpec: AppSpec;
  createdAt: string;
};

export type ProjectSnapshot = {
  id: string;
  title: string;
  prompt: string;
  status: string;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  messages: Array<{ id: string; role: string; content: string; createdAt: string }>;
  steps: AgentStep[];
  versions: VersionSnapshot[];
};

export type WorkspaceSnapshot = {
  projects: ProjectSnapshot[];
  activeProjectId: string | null;
};
