CREATE TABLE `agent_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_key` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`payload` text NOT NULL,
	`rationale` text NOT NULL,
	`confidence` integer NOT NULL,
	`risk` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`decided_by` text,
	`decided_at` text,
	`decision_note` text,
	`executed_at` text,
	`result` text,
	`run_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `proposals_status_idx` ON `agent_proposals` (`status`);--> statement-breakpoint
CREATE INDEX `proposals_target_idx` ON `agent_proposals` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `agent_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_key` text NOT NULL,
	`trigger` text NOT NULL,
	`status` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`items_reviewed` integer DEFAULT 0 NOT NULL,
	`proposals_created` integer DEFAULT 0 NOT NULL,
	`auto_executed` integer DEFAULT 0 NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cost_cents` integer DEFAULT 0 NOT NULL,
	`error` text,
	`started_at` text NOT NULL,
	`finished_at` text
);
--> statement-breakpoint
CREATE INDEX `runs_agent_idx` ON `agent_runs` (`agent_key`,`started_at`);