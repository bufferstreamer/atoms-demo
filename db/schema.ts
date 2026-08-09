import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
  status: text("status").notNull(), errorCode: text("error_code"), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("runs_project_request_idx").on(table.projectId, table.requestId)]);

export const runSteps = sqliteTable("run_steps", {
  id: text("id").primaryKey(), runId: text("run_id").notNull(), ordinal: integer("ordinal").notNull(), role: text("role").notNull(),
  name: text("name").notNull(), status: text("status").notNull(), summary: text("summary").notNull(), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("run_steps_run_ordinal_idx").on(table.runId, table.ordinal)]);

export const versions = sqliteTable("versions", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull(), parentVersionId: text("parent_version_id"), versionNo: integer("version_no").notNull(),
  appSpecJson: text("app_spec_json").notNull(), changeSummary: text("change_summary").notNull(), createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("versions_project_number_idx").on(table.projectId, table.versionNo)]);

export const rateLimits = sqliteTable("rate_limits", {
  bucketKey: text("bucket_key").notNull(), windowStart: text("window_start").notNull(), action: text("action").notNull(), count: integer("count").notNull(),
}, (table) => [uniqueIndex("rate_limits_bucket_window_action_idx").on(table.bucketKey, table.windowStart, table.action)]);
