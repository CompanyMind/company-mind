ALTER TABLE "citations" DROP CONSTRAINT "citations_chunk_id_chunks_id_fk";
--> statement-breakpoint
ALTER TABLE "citations" DROP CONSTRAINT "citations_document_id_documents_id_fk";
--> statement-breakpoint
ALTER TABLE "citations" ALTER COLUMN "chunk_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "citations" ALTER COLUMN "document_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "citations" ADD CONSTRAINT "citations_chunk_id_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."chunks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citations" ADD CONSTRAINT "citations_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;