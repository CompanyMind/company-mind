ALTER TABLE "query_log" ADD COLUMN "degraded" text[];--> statement-breakpoint
ALTER TABLE "query_log" ADD COLUMN "timings_ms" jsonb;--> statement-breakpoint
ALTER TABLE "query_log" ADD COLUMN "candidate_counts" jsonb;--> statement-breakpoint
ALTER TABLE "query_log" ADD COLUMN "rerank_applied" boolean;--> statement-breakpoint
ALTER TABLE "query_log" ADD COLUMN "question_type" text;