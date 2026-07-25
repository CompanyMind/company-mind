DROP INDEX "chunks_workspace_idx";--> statement-breakpoint
CREATE INDEX "chunks_doc_ordinal_idx" ON "chunks" USING btree ("document_id","ordinal");--> statement-breakpoint
CREATE INDEX "citations_message_idx" ON "citations" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "citations_chunk_idx" ON "citations" USING btree ("chunk_id");--> statement-breakpoint
CREATE INDEX "citations_document_idx" ON "citations" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_groups_group_idx" ON "document_groups" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "group_members_ws_user_idx" ON "group_members" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "query_log_ws_created_idx" ON "query_log" USING btree ("workspace_id","created_at");