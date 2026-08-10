CREATE TABLE IF NOT EXISTS `app_state` (
	`owner_key` text NOT NULL,
	`project_id` text NOT NULL,
	`state_key` text NOT NULL,
	`value_json` text NOT NULL,
	`value_bytes` integer NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner_key`, `project_id`, `state_key`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `app_state_project_updated_idx` ON `app_state` (`project_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `generation_events` (
	`run_id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`model` text NOT NULL,
	`outcome` text NOT NULL,
	`failure_code` text,
	`fallback_reason` text,
	`duration_ms` integer NOT NULL,
	`artifact_kind` text,
	`artifact_bytes` integer,
	`validator_json` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `run_deadline_audit` (
	`run_id` text PRIMARY KEY NOT NULL,
	`model_deadline_at` integer NOT NULL,
	`persistence_deadline_at` integer NOT NULL,
	`response_deadline_at` integer NOT NULL,
	`model_deadline_exceeded` integer DEFAULT 0 NOT NULL,
	`persistence_deadline_exceeded` integer DEFAULT 0 NOT NULL,
	`response_budget_exceeded` integer DEFAULT 0 NOT NULL,
	`lease_expired` integer DEFAULT 0 NOT NULL,
	`observed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `storage_rate_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `storage_rate_owner_created_idx` ON `storage_rate_events` (`owner_key`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `storage_rate_created_idx` ON `storage_rate_events` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `runs_project_running_idx` ON `runs` (`project_id`) WHERE "runs"."status" = 'RUNNING';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `runs_project_active_idx` ON `runs` (`project_id`) WHERE "runs"."status" IN ('RUNNING','COMPLETING','FAILING');
