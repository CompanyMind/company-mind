ALTER TABLE "query_log" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "extracted_text" text;--> statement-breakpoint
ALTER TABLE "query_log" ADD COLUMN "telegram_link_id" uuid;--> statement-breakpoint
ALTER TABLE "query_log" ADD CONSTRAINT "query_log_telegram_link_id_telegram_links_id_fk" FOREIGN KEY ("telegram_link_id") REFERENCES "public"."telegram_links"("id") ON DELETE set null ON UPDATE no action;