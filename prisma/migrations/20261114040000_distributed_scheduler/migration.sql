-- AlterTable
ALTER TABLE "heartbeats" ADD COLUMN     "config_version" INTEGER,
ADD COLUMN     "run_id" UUID,
ADD COLUMN     "scheduled_for" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "monitors" ADD COLUMN     "claimed_config_version" INTEGER,
ADD COLUMN     "lease_owner" TEXT,
ADD COLUMN     "lease_token" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "lease_until" TIMESTAMPTZ(3),
ADD COLUMN     "next_check_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "run_id" UUID,
ADD COLUMN     "scheduled_for" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "monitor_states" (
    "monitor_id" INTEGER NOT NULL,
    "workspace_id" INTEGER NOT NULL,
    "environment_id" INTEGER NOT NULL,
    "heartbeat_id" BIGINT,
    "run_id" UUID,
    "status" INTEGER NOT NULL,
    "ping" INTEGER NOT NULL,
    "check_code" TEXT NOT NULL,
    "checked_at" TIMESTAMPTZ(3) NOT NULL,
    "status_changed_at" TIMESTAMPTZ(3) NOT NULL,
    "revision" BIGINT NOT NULL DEFAULT 1,

    CONSTRAINT "monitor_states_pkey" PRIMARY KEY ("monitor_id")
);

-- CreateTable
CREATE TABLE "notification_outbox" (
    "id" BIGSERIAL NOT NULL,
    "run_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "notification_id" INTEGER NOT NULL,
    "workspace_id" INTEGER NOT NULL,
    "environment_id" INTEGER NOT NULL,
    "monitor_id" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_owner" TEXT,
    "lease_token" BIGINT NOT NULL DEFAULT 0,
    "lease_until" TIMESTAMPTZ(3),
    "error_code" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_instances" (
    "instance_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "draining" BOOLEAN NOT NULL DEFAULT false,
    "concurrency" INTEGER NOT NULL,
    "inflight" INTEGER NOT NULL DEFAULT 0,
    "metrics" JSONB NOT NULL,

    CONSTRAINT "worker_instances_pkey" PRIMARY KEY ("instance_id")
);

-- CreateIndex
CREATE INDEX "monitor_states_workspace_id_environment_id_monitor_id_idx" ON "monitor_states"("workspace_id", "environment_id", "monitor_id");

-- CreateIndex
CREATE INDEX "notification_outbox_status_next_attempt_at_idx" ON "notification_outbox"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "notification_outbox_lease_until_idx" ON "notification_outbox"("lease_until");

-- CreateIndex
CREATE INDEX "notification_outbox_workspace_id_created_at_idx" ON "notification_outbox"("workspace_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_outbox_run_id_notification_id_event_type_key" ON "notification_outbox"("run_id", "notification_id", "event_type");

-- CreateIndex
CREATE INDEX "worker_instances_last_seen_idx" ON "worker_instances"("last_seen");

-- CreateIndex
CREATE UNIQUE INDEX "heartbeats_run_id_key" ON "heartbeats"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_id_workspace_key" ON "notifications"("id", "workspace_id");

-- AddForeignKey
ALTER TABLE "monitor_states" ADD CONSTRAINT "monitor_states_monitor_id_workspace_id_environment_id_fkey" FOREIGN KEY ("monitor_id", "workspace_id", "environment_id") REFERENCES "monitors"("id", "workspace_id", "environment_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_monitor_id_workspace_id_environment_id_fkey" FOREIGN KEY ("monitor_id", "workspace_id", "environment_id") REFERENCES "monitors"("id", "workspace_id", "environment_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_notification_id_workspace_id_fkey" FOREIGN KEY ("notification_id", "workspace_id") REFERENCES "notifications"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Bounded due/reclaim paths; legacy static node assignment is no longer authoritative.
CREATE INDEX monitors_due_idx ON monitors(next_check_at,id) WHERE active AND type IN ('http','keyword','json-query');
CREATE INDEX monitors_expired_lease_idx ON monitors(lease_until,id) WHERE active AND lease_until IS NOT NULL;
UPDATE monitors SET next_check_at=statement_timestamp() + make_interval(secs => ((id::bigint*2654435761)%GREATEST(interval,1))::double precision);
-- One indexed latest heartbeat lookup per monitor; never materialize all historical rows.
INSERT INTO monitor_states(monitor_id,workspace_id,environment_id,heartbeat_id,status,ping,check_code,checked_at,status_changed_at,revision)
SELECT m.id,m.workspace_id,m.environment_id,h.id,h.status,COALESCE(h.ping,0),COALESCE(h.check_code,'LEGACY_RESULT'),h.time,h.time,1
FROM monitors m CROSS JOIN LATERAL (SELECT id,status,ping,check_code,time FROM heartbeats WHERE monitor_id=m.id ORDER BY time DESC,id DESC LIMIT 1) h;
