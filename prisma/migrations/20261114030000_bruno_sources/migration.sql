ALTER TABLE "monitors" ADD CONSTRAINT "monitors_id_workspace_environment_key" UNIQUE ("id","workspace_id","environment_id");
CREATE TABLE "bruno_sources" (
 "id" SERIAL PRIMARY KEY,
 "workspace_id" INTEGER NOT NULL,
 "environment_id" INTEGER NOT NULL,
 "collection_id" TEXT NOT NULL,
 "source_environment" TEXT NOT NULL DEFAULT '',
 "path" TEXT NOT NULL,
 "monitor_id" INTEGER NOT NULL UNIQUE,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "bruno_sources_monitor_fkey" FOREIGN KEY ("monitor_id","workspace_id","environment_id") REFERENCES "monitors"("id","workspace_id","environment_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "bruno_source_identity" ON "bruno_sources"("workspace_id","environment_id","collection_id","source_environment","path");
