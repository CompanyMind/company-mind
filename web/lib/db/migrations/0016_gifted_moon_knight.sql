ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_one_workspace_per_user" ON "memberships" USING btree ("user_id");