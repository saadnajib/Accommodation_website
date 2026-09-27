CREATE TABLE `application_events` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`status` text NOT NULL,
	`by` text NOT NULL,
	`actor_id` text,
	`note` text,
	`at` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `events_app_idx` ON `application_events` (`application_id`);--> statement-breakpoint
CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`renter_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`proposed_price` integer NOT NULL,
	`agreed_price` integer NOT NULL,
	`move_in_date` text NOT NULL,
	`stay_months` integer NOT NULL,
	`message` text NOT NULL,
	`agreement_accepted` integer NOT NULL,
	`agreement_accepted_at` text,
	`agreement_version` text DEFAULT 'v1' NOT NULL,
	`id_type` text,
	`id_number_masked` text,
	`id_document_file_id` text,
	`selfie_file_id` text,
	`proof_of_income_file_id` text,
	`verification_submitted_at` text,
	`profile` text,
	`status` text DEFAULT 'submitted' NOT NULL,
	`renter_fee` integer NOT NULL,
	`owner_fee` integer NOT NULL,
	`renter_fee_paid` integer DEFAULT false NOT NULL,
	`owner_fee_paid` integer DEFAULT false NOT NULL,
	`contact_unlocked` integer DEFAULT false NOT NULL,
	`admin_notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`renter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `apps_renter_idx` ON `applications` (`renter_id`);--> statement-breakpoint
CREATE INDEX `apps_owner_idx` ON `applications` (`owner_id`);--> statement-breakpoint
CREATE INDEX `apps_listing_idx` ON `applications` (`listing_id`);--> statement-breakpoint
CREATE INDEX `apps_status_idx` ON `applications` (`status`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`target` text,
	`meta` text,
	`ip` text,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_actor_idx` ON `audit_log` (`actor_id`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`kind` text NOT NULL,
	`visibility` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`storage_path` text NOT NULL,
	`original_name` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`type` text NOT NULL,
	`city` text NOT NULL,
	`area` text NOT NULL,
	`address` text NOT NULL,
	`price` integer NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`deposit` integer NOT NULL,
	`bills_included` integer DEFAULT false NOT NULL,
	`available_from` text NOT NULL,
	`min_stay_months` integer NOT NULL,
	`bedrooms` integer NOT NULL,
	`bathrooms` integer NOT NULL,
	`size_sqm` integer NOT NULL,
	`furnished` integer DEFAULT false NOT NULL,
	`amenities` text DEFAULT '[]' NOT NULL,
	`house_rules` text DEFAULT '[]' NOT NULL,
	`images` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`featured_until` text,
	`views` integer DEFAULT 0 NOT NULL,
	`rejection_reason` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `listings_owner_idx` ON `listings` (`owner_id`);--> statement-breakpoint
CREATE INDEX `listings_status_city_idx` ON `listings` (`status`,`city`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`from_id` text NOT NULL,
	`text` text NOT NULL,
	`at` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `messages_app_idx` ON `messages` (`application_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`link` text,
	`read` integer DEFAULT false NOT NULL,
	`at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`payer_id` text NOT NULL,
	`side` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`provider` text DEFAULT 'mock' NOT NULL,
	`provider_ref` text,
	`status` text NOT NULL,
	`recorded_by` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product` text NOT NULL,
	`listing_id` text,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`provider` text DEFAULT 'mock' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`from_id` text NOT NULL,
	`to_id` text NOT NULL,
	`rating` integer NOT NULL,
	`text` text NOT NULL,
	`at` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reviews_to_idx` ON `reviews` (`to_id`);--> statement-breakpoint
CREATE TABLE `saved_listings` (
	`user_id` text NOT NULL,
	`listing_id` text NOT NULL,
	`at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `saved_user_idx` ON `saved_listings` (`user_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`ip` text,
	`user_agent` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`phone` text,
	`bio` text,
	`avatar_url` text,
	`verification` text DEFAULT 'unverified' NOT NULL,
	`has_tenant_pass` integer DEFAULT false NOT NULL,
	`failed_logins` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);