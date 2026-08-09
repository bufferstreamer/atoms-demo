CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `messages_project_created_idx` ON `messages` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`title` text NOT NULL,
	`prompt` text NOT NULL,
	`status` text NOT NULL,
	`current_version_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `projects_owner_updated_idx` ON `projects` (`owner_key`,`updated_at`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`bucket_key` text NOT NULL,
	`window_start` text NOT NULL,
	`action` text NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limits_bucket_window_action_idx` ON `rate_limits` (`bucket_key`,`window_start`,`action`);--> statement-breakpoint
CREATE TABLE `run_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`role` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`summary` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `run_steps_run_ordinal_idx` ON `run_steps` (`run_id`,`ordinal`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`request_id` text NOT NULL,
	`base_version_id` text,
	`status` text NOT NULL,
	`error_code` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `runs_project_request_idx` ON `runs` (`project_id`,`request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `runs_project_running_idx` ON `runs` (`project_id`) WHERE `status` = 'RUNNING';--> statement-breakpoint
CREATE TABLE `versions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`parent_version_id` text,
	`version_no` integer NOT NULL,
	`app_spec_json` text NOT NULL,
	`change_summary` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `versions_project_number_idx` ON `versions` (`project_id`,`version_no`);--> statement-breakpoint
CREATE TABLE `workspace_requests` (
	`owner_key` text NOT NULL,
	`request_id` text NOT NULL,
	`project_id` text NOT NULL,
	`run_id` text NOT NULL,
	`status` text NOT NULL,
	`error_code` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_requests_owner_request_idx` ON `workspace_requests` (`owner_key`,`request_id`);
