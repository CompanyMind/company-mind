CREATE TABLE "user_tour_steps" (
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"step_key" text NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_tour_steps_user_id_workspace_id_step_key_pk" PRIMARY KEY("user_id","workspace_id","step_key")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tour_dismissed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_tour_steps" ADD CONSTRAINT "user_tour_steps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tour_steps" ADD CONSTRAINT "user_tour_steps_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;