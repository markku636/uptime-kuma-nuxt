-- CreateTable
CREATE TABLE "heartbeat_hourly" (
    "monitor_id" INTEGER NOT NULL,
    "workspace_id" INTEGER NOT NULL,
    "environment_id" INTEGER NOT NULL,
    "bucket_start" TIMESTAMPTZ(3) NOT NULL,
    "up_ms" BIGINT NOT NULL,
    "down_ms" BIGINT NOT NULL,
    "maintenance_ms" BIGINT NOT NULL,
    "unknown_ms" BIGINT NOT NULL,
    "ping_sum" BIGINT NOT NULL,
    "ping_count" INTEGER NOT NULL,
    "min_ping" INTEGER,
    "max_ping" INTEGER,
    "up_count" INTEGER NOT NULL,
    "down_count" INTEGER NOT NULL,
    "total_count" INTEGER NOT NULL,
    "estimated" BOOLEAN NOT NULL DEFAULT false,
    "generation" BIGINT NOT NULL DEFAULT 1,

    CONSTRAINT "heartbeat_hourly_pkey" PRIMARY KEY ("monitor_id","bucket_start")
);

-- CreateTable
CREATE TABLE "history_checkpoints" (
    "monitor_id" INTEGER NOT NULL,
    "workspace_id" INTEGER NOT NULL,
    "environment_id" INTEGER NOT NULL,
    "first_bucket" TIMESTAMPTZ(3) NOT NULL,
    "sealed_before" TIMESTAMPTZ(3) NOT NULL,
    "raw_deleted_before" TIMESTAMPTZ(3),
    "generation" BIGINT NOT NULL DEFAULT 1,
    "clearing" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "history_checkpoints_pkey" PRIMARY KEY ("monitor_id")
);

-- CreateTable
CREATE TABLE "history_clear_jobs" (
    "id" UUID NOT NULL,
    "workspace_id" INTEGER NOT NULL,
    "max_monitor_id" INTEGER NOT NULL,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "current_monitor_id" INTEGER,
    "cutoff" TIMESTAMPTZ(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "deleted_rows" BIGINT NOT NULL DEFAULT 0,
    "processed_monitors" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "history_clear_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_dedupe" (
    "key" TEXT NOT NULL,
    "monitor_id" INTEGER NOT NULL,
    "workspace_id" INTEGER NOT NULL,
    "environment_id" INTEGER NOT NULL,
    "notification_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_dedupe_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "heartbeat_hourly_bucket_start_monitor_id_idx" ON "heartbeat_hourly"("bucket_start", "monitor_id");

-- CreateIndex
CREATE INDEX "history_checkpoints_sealed_before_monitor_id_idx" ON "history_checkpoints"("sealed_before", "monitor_id");

-- CreateIndex
CREATE INDEX "history_clear_jobs_status_created_at_idx" ON "history_clear_jobs"("status", "created_at");

-- RenameForeignKey

-- AddForeignKey
ALTER TABLE "heartbeat_hourly" ADD CONSTRAINT "heartbeat_hourly_monitor_id_workspace_id_environment_id_fkey" FOREIGN KEY ("monitor_id", "workspace_id", "environment_id") REFERENCES "monitors"("id", "workspace_id", "environment_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "history_checkpoints" ADD CONSTRAINT "history_checkpoints_monitor_id_workspace_id_environment_id_fkey" FOREIGN KEY ("monitor_id", "workspace_id", "environment_id") REFERENCES "monitors"("id", "workspace_id", "environment_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_dedupe" ADD CONSTRAINT "notification_dedupe_monitor_id_workspace_id_environment_id_fkey" FOREIGN KEY ("monitor_id", "workspace_id", "environment_id") REFERENCES "monitors"("id", "workspace_id", "environment_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_dedupe" ADD CONSTRAINT "notification_dedupe_notification_id_workspace_id_fkey" FOREIGN KEY ("notification_id", "workspace_id") REFERENCES "notifications"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Preserve TLS notification idempotency independently of outbox retention.
INSERT INTO notification_dedupe(key,monitor_id,workspace_id,environment_id,notification_id,created_at)
SELECT dedupe_key,monitor_id,workspace_id,environment_id,notification_id,created_at FROM notification_outbox WHERE event_type='tls-expiry' AND dedupe_key IS NOT NULL ON CONFLICT(key) DO NOTHING;

CREATE FUNCTION invalidate_late_heartbeat() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE checkpoint history_checkpoints%ROWTYPE;
BEGIN
 SELECT * INTO checkpoint FROM history_checkpoints WHERE monitor_id=NEW.monitor_id;
 IF FOUND AND NEW.time<checkpoint.sealed_before THEN
  PERFORM id FROM monitors WHERE id=NEW.monitor_id FOR UPDATE;
  SELECT * INTO checkpoint FROM history_checkpoints WHERE monitor_id=NEW.monitor_id FOR UPDATE;
  IF checkpoint.raw_deleted_before IS NOT NULL AND NEW.time<checkpoint.raw_deleted_before THEN
   RAISE EXCEPTION 'Late heartbeat predates retained raw history; explicit restore required';
  END IF;
  UPDATE history_checkpoints SET first_bucket=LEAST(first_bucket,date_trunc('hour',NEW.time,'UTC')),sealed_before=LEAST(sealed_before,date_trunc('hour',NEW.time,'UTC')),generation=generation+1 WHERE monitor_id=NEW.monitor_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER invalidate_late_heartbeat BEFORE INSERT ON heartbeats FOR EACH ROW EXECUTE FUNCTION invalidate_late_heartbeat();
