ALTER TABLE notification_outbox ADD COLUMN dedupe_key TEXT;
CREATE UNIQUE INDEX notification_outbox_dedupe_key_key ON notification_outbox(dedupe_key);
CREATE INDEX notification_outbox_completed_idx ON notification_outbox(completed_at,id) WHERE completed_at IS NOT NULL;
