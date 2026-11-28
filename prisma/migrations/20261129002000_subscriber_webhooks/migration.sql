ALTER TABLE "status_page_subscribers" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'email';
ALTER TABLE "status_page_subscribers" ADD COLUMN "url" TEXT;
CREATE INDEX "status_page_subscribers_status_page_id_kind_idx" ON "status_page_subscribers"("status_page_id", "kind");
