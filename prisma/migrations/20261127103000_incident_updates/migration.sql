CREATE TABLE "incident_updates" (
    "id" SERIAL NOT NULL,
    "incident_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'update',
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "incident_updates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "incident_updates_incident_id_created_at_idx" ON "incident_updates"("incident_id", "created_at");

ALTER TABLE "incident_updates" ADD CONSTRAINT "incident_updates_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
