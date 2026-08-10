import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), title: text("title").notNull(),
  prompt: text("prompt").notNull(), status: text("status").notNull(), currentVersionId: text("current_version_id"),
  createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, (table) => [index("projects_owner_updated_idx").on(table.ownerKey, table.updatedAt)]);

export const workspaceRequests = sqliteTable("workspace_requests", {
  ownerKey: text("owner_key").notNull(), requestId: text("request_id").notNull(), projectId: text("project_id").notNull(),
  runId: text("run_id").notNull(), status: text("status").notNull(), errorCode: text("error_code"),
  createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("workspace_requests_owner_request_idx").on(table.ownerKey, table.requestId)]);

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull(), role: text("role").notNull(), content: text("content").notNull(), createdAt: text("created_at").notNull(),
}, (table) => [index("messages_project_created_idx").on(table.projectId, table.createdAt)]);

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull(), requestId: text("request_id").notNull(), baseVersionId: text("base_version_id"),
  attemptToken: text("attempt_token"), runnerClaimedAt: text("runner_claimed_at"), attemptExpiresAt: integer("attempt_expires_at"),
  status: text("status").notNull(), errorCode: text("error_code"), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("runs_project_request_idx").on(table.projectId, table.requestId),
  uniqueIndex("runs_project_running_idx").on(table.projectId).where(sql`${table.status} = 'RUNNING'`),
  uniqueIndex("runs_project_active_idx").on(table.projectId).where(sql`${table.status} IN ('RUNNING','COMPLETING','FAILING')`),
]);

export const runSteps = sqliteTable("run_steps", {
  id: text("id").primaryKey(), runId: text("run_id").notNull(), ordinal: integer("ordinal").notNull(), role: text("role").notNull(),
  name: text("name").notNull(), status: text("status").notNull(), summary: text("summary").notNull(), source: text("source"), model: text("model"),
  durationMs: integer("duration_ms"), attemptNo: integer("attempt_no"), artifactJson: text("artifact_json"), errorCode: text("error_code"), sharedCallId: text("shared_call_id"),
  createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("run_steps_run_ordinal_idx").on(table.runId, table.ordinal)]);

export const versions = sqliteTable("versions", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull(), parentVersionId: text("parent_version_id"), versionNo: integer("version_no").notNull(),
  appSpecJson: text("app_spec_json").notNull(), artifactKind: text("artifact_kind").notNull().default("app_spec"), changeSummary: text("change_summary").notNull(), createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("versions_project_number_idx").on(table.projectId, table.versionNo)]);

export const rateLimits = sqliteTable("rate_limits", {
  bucketKey: text("bucket_key").notNull(), windowStart: text("window_start").notNull(), action: text("action").notNull(), count: integer("count").notNull(),
}, (table) => [uniqueIndex("rate_limits_bucket_window_action_idx").on(table.bucketKey, table.windowStart, table.action)]);

export const generationEvents = sqliteTable("generation_events", {
  runId: text("run_id").primaryKey(), source: text("source").notNull(), model: text("model").notNull(), outcome: text("outcome").notNull(),
  failureCode: text("failure_code"), fallbackReason: text("fallback_reason"), durationMs: integer("duration_ms").notNull(), artifactKind: text("artifact_kind"),
  artifactBytes: integer("artifact_bytes"), validatorJson: text("validator_json"), inputTokens: integer("input_tokens"), outputTokens: integer("output_tokens"), createdAt: text("created_at").notNull(),
});

export const runDeadlineAudit = sqliteTable("run_deadline_audit", {
  runId: text("run_id").primaryKey(), modelDeadlineAt: integer("model_deadline_at").notNull(), persistenceDeadlineAt: integer("persistence_deadline_at").notNull(), responseDeadlineAt: integer("response_deadline_at").notNull(),
  modelDeadlineExceeded: integer("model_deadline_exceeded").notNull().default(0), persistenceDeadlineExceeded: integer("persistence_deadline_exceeded").notNull().default(0),
  responseBudgetExceeded: integer("response_budget_exceeded").notNull().default(0), leaseExpired: integer("lease_expired").notNull().default(0), observedAt: integer("observed_at").notNull(),
});

export const appState = sqliteTable("app_state", {
  ownerKey: text("owner_key").notNull(), projectId: text("project_id").notNull(), stateKey: text("state_key").notNull(),
  valueJson: text("value_json").notNull(), valueBytes: integer("value_bytes").notNull(), updatedAt: text("updated_at").notNull(),
}, (table) => [primaryKey({ columns: [table.ownerKey, table.projectId, table.stateKey] }), index("app_state_project_updated_idx").on(table.projectId, table.updatedAt)]);

export const storageRateEvents = sqliteTable("storage_rate_events", {
  id: text("id").primaryKey(), ownerKey: text("owner_key").notNull(), createdAt: integer("created_at").notNull(),
}, (table) => [index("storage_rate_owner_created_idx").on(table.ownerKey, table.createdAt), index("storage_rate_created_idx").on(table.createdAt)]);
