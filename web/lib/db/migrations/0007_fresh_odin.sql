CREATE TABLE "graph_build_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "graph_doc_meta" (
	"document_id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"topic_id" uuid,
	"degree" integer DEFAULT 0 NOT NULL,
	"exposure_score" double precision DEFAULT 0 NOT NULL,
	"is_orphan" boolean DEFAULT false NOT NULL,
	"last_retrieved_at" timestamp with time zone,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "graph_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"document_id" uuid NOT NULL,
	"severity" double precision DEFAULT 0 NOT NULL,
	"detail" jsonb,
	"status" text DEFAULT 'open' NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "graph_topic_members" (
	"topic_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	CONSTRAINT "graph_topic_members_topic_id_document_id_pk" PRIMARY KEY("topic_id","document_id")
);
--> statement-breakpoint
CREATE TABLE "graph_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"label" text NOT NULL,
	"keywords" text[],
	"centroid" vector(1024),
	"doc_count" integer DEFAULT 0 NOT NULL,
	"x" double precision DEFAULT 0 NOT NULL,
	"y" double precision DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "graph_build_jobs" ADD CONSTRAINT "graph_build_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_doc_meta" ADD CONSTRAINT "graph_doc_meta_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_doc_meta" ADD CONSTRAINT "graph_doc_meta_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_doc_meta" ADD CONSTRAINT "graph_doc_meta_topic_id_graph_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."graph_topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_findings" ADD CONSTRAINT "graph_findings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_findings" ADD CONSTRAINT "graph_findings_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_topic_members" ADD CONSTRAINT "graph_topic_members_topic_id_graph_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."graph_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_topic_members" ADD CONSTRAINT "graph_topic_members_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_topic_members" ADD CONSTRAINT "graph_topic_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_topics" ADD CONSTRAINT "graph_topics_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "graph_findings_workspace_idx" ON "graph_findings" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "graph_topics_workspace_idx" ON "graph_topics" USING btree ("workspace_id");