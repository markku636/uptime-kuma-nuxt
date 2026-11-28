CREATE TABLE "status_page_subscribers" (
    "id" SERIAL NOT NULL,
    "status_page_id" INTEGER NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "status_page_subscribers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "status_page_subscribers_token_key" ON "status_page_subscribers"("token");
CREATE UNIQUE INDEX "status_page_subscribers_status_page_id_email_key" ON "status_page_subscribers"("status_page_id", "email");
CREATE INDEX "status_page_subscribers_status_page_id_verified_at_idx" ON "status_page_subscribers"("status_page_id", "verified_at");

CREATE TABLE "status_page_notification_outbox" (
    "id" BIGSERIAL NOT NULL,
    "status_page_id" INTEGER NOT NULL,
    "subscriber_id" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),
    CONSTRAINT "status_page_notification_outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "status_page_notification_outbox_status_next_attempt_at_idx" ON "status_page_notification_outbox"("status", "next_attempt_at");

ALTER TABLE "status_page_subscribers" ADD CONSTRAINT "status_page_subscribers_status_page_id_fkey" FOREIGN KEY ("status_page_id") REFERENCES "status_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "status_page_notification_outbox" ADD CONSTRAINT "status_page_notification_outbox_status_page_id_fkey" FOREIGN KEY ("status_page_id") REFERENCES "status_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
