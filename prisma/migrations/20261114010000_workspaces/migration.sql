BEGIN;
-- Ambiguous legacy associations require explicit operator repair; never delete data.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM maintenance_monitors x LEFT JOIN monitors m ON m.id=x.monitor_id LEFT JOIN maintenances a ON a.id=x.maintenance_id WHERE m.id IS NULL OR a.id IS NULL OR a.user_id<>m.user_id) THEN RAISE EXCEPTION 'Legacy association preflight failed: maintenance_monitors. Repair ownership before migration.'; END IF;
  IF EXISTS (SELECT 1 FROM maintenance_status_pages x LEFT JOIN status_pages s ON s.id=x.status_page_id LEFT JOIN maintenances a ON a.id=x.maintenance_id WHERE s.id IS NULL OR a.id IS NULL OR a.user_id<>s.user_id) THEN RAISE EXCEPTION 'Legacy association preflight failed: maintenance_status_pages. Repair ownership before migration.'; END IF;
  IF EXISTS (SELECT 1 FROM monitor_tags x JOIN monitors m ON m.id=x.monitor_id JOIN tags t ON t.id=x.tag_id WHERE m.user_id<>t.user_id) THEN RAISE EXCEPTION 'Legacy association preflight failed: monitor_tags. Repair ownership before migration.'; END IF;
  IF EXISTS (SELECT 1 FROM monitor_notifications x JOIN monitors m ON m.id=x.monitor_id JOIN notifications n ON n.id=x.notification_id WHERE m.user_id<>n.user_id) THEN RAISE EXCEPTION 'Legacy association preflight failed: monitor_notifications. Repair ownership before migration.'; END IF;
  IF EXISTS (SELECT 1 FROM status_page_monitors x JOIN monitors m ON m.id=x.monitor_id JOIN status_page_groups g ON g.id=x.group_id JOIN status_pages s ON s.id=g.status_page_id WHERE m.user_id<>s.user_id) THEN RAISE EXCEPTION 'Legacy association preflight failed: status_page_monitors. Repair ownership before migration.'; END IF;
  IF EXISTS (SELECT 1 FROM monitors m JOIN proxies p ON p.id=m.proxy_id WHERE m.user_id<>p.user_id) THEN RAISE EXCEPTION 'Legacy association preflight failed: monitor_proxy. Repair ownership before migration.'; END IF;
END $$;
-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "platform_admin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "session_version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "monitors" ADD COLUMN "environment_id" INTEGER,
ADD COLUMN "workspace_id" INTEGER;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "workspace_id" INTEGER;

-- AlterTable
ALTER TABLE "status_pages" ADD COLUMN "workspace_id" INTEGER;

-- AlterTable
ALTER TABLE "tags" ADD COLUMN "workspace_id" INTEGER;

-- AlterTable
ALTER TABLE "proxies" ADD COLUMN "workspace_id" INTEGER;

-- AlterTable
ALTER TABLE "docker_hosts" ADD COLUMN "workspace_id" INTEGER;

-- AlterTable
ALTER TABLE "maintenances" ADD COLUMN "workspace_id" INTEGER;

-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN     "environment_id" INTEGER,
ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'read',
ADD COLUMN "workspace_id" INTEGER;

-- AlterTable
ALTER TABLE "remote_browsers" ADD COLUMN "workspace_id" INTEGER;

-- CreateTable
CREATE TABLE "workspaces" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "personal_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "workspace_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("workspace_id","user_id")
);

-- CreateTable
CREATE TABLE "environments" (
    "id" SERIAL NOT NULL,
    "workspace_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '{}',
    "secrets" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "environments_pkey" PRIMARY KEY ("id")
);

-- Preserve each user's resources within their personal workspace.
INSERT INTO "workspaces" ("name", "personal_user_id") SELECT username || ' workspace', id FROM users;
INSERT INTO "workspace_members" ("workspace_id", "user_id", "role") SELECT id, personal_user_id, 'owner' FROM workspaces;
INSERT INTO "environments" ("workspace_id", "name") SELECT id, 'default' FROM workspaces;
UPDATE users SET platform_admin = true WHERE id = (SELECT min(id) FROM users);
UPDATE "monitors" r SET workspace_id = w.id FROM workspaces w WHERE r.user_id = w.personal_user_id;
ALTER TABLE "monitors" ALTER COLUMN workspace_id SET NOT NULL;
UPDATE "notifications" r SET workspace_id = w.id FROM workspaces w WHERE r.user_id = w.personal_user_id;
ALTER TABLE "notifications" ALTER COLUMN workspace_id SET NOT NULL;
UPDATE "status_pages" r SET workspace_id = w.id FROM workspaces w WHERE r.user_id = w.personal_user_id;
ALTER TABLE "status_pages" ALTER COLUMN workspace_id SET NOT NULL;
UPDATE "tags" r SET workspace_id = w.id FROM workspaces w WHERE r.user_id = w.personal_user_id;
ALTER TABLE "tags" ALTER COLUMN workspace_id SET NOT NULL;
UPDATE "proxies" r SET workspace_id = w.id FROM workspaces w WHERE r.user_id = w.personal_user_id;
ALTER TABLE "proxies" ALTER COLUMN workspace_id SET NOT NULL;
UPDATE "docker_hosts" r SET workspace_id = w.id FROM workspaces w WHERE r.user_id = w.personal_user_id;
ALTER TABLE "docker_hosts" ALTER COLUMN workspace_id SET NOT NULL;
UPDATE "maintenances" r SET workspace_id = w.id FROM workspaces w WHERE r.user_id = w.personal_user_id;
ALTER TABLE "maintenances" ALTER COLUMN workspace_id SET NOT NULL;
UPDATE "api_keys" r SET workspace_id = w.id FROM workspaces w WHERE r.user_id = w.personal_user_id;
ALTER TABLE "api_keys" ALTER COLUMN workspace_id SET NOT NULL;
UPDATE "remote_browsers" r SET workspace_id = w.id FROM workspaces w WHERE r.user_id = w.personal_user_id;
ALTER TABLE "remote_browsers" ALTER COLUMN workspace_id SET NOT NULL;
UPDATE monitors m SET environment_id=e.id FROM environments e WHERE e.workspace_id=m.workspace_id;
ALTER TABLE monitors ALTER COLUMN environment_id SET NOT NULL;

ALTER TABLE workspace_members ADD CONSTRAINT workspace_member_role CHECK (role IN ('owner','editor','viewer'));
ALTER TABLE api_keys ADD CONSTRAINT api_key_scope CHECK (scope IN ('read','write'));

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_personal_user_id_key" ON "workspaces"("personal_user_id");

-- CreateIndex
CREATE INDEX "workspace_members_user_id_idx" ON "workspace_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "environments_workspace_id_name_key" ON "environments"("workspace_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "environments_id_workspace_id_key" ON "environments"("id", "workspace_id");

-- CreateIndex
CREATE INDEX "monitors_workspace_id_idx" ON "monitors"("workspace_id");

-- CreateIndex
CREATE INDEX "monitors_workspace_id_environment_id_id_idx" ON "monitors"("workspace_id", "environment_id", "id");

-- CreateIndex
CREATE INDEX "notifications_workspace_id_idx" ON "notifications"("workspace_id");

-- CreateIndex
CREATE INDEX "status_pages_workspace_id_idx" ON "status_pages"("workspace_id");

-- CreateIndex
CREATE INDEX "tags_workspace_id_idx" ON "tags"("workspace_id");

-- CreateIndex
CREATE INDEX "proxies_workspace_id_idx" ON "proxies"("workspace_id");

-- CreateIndex
CREATE INDEX "docker_hosts_workspace_id_idx" ON "docker_hosts"("workspace_id");

-- CreateIndex
CREATE INDEX "maintenances_workspace_id_idx" ON "maintenances"("workspace_id");

-- CreateIndex
CREATE INDEX "api_keys_workspace_id_idx" ON "api_keys"("workspace_id");

-- CreateIndex
CREATE INDEX "remote_browsers_workspace_id_idx" ON "remote_browsers"("workspace_id");

-- AddForeignKey
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_environment_id_workspace_id_fkey" FOREIGN KEY ("environment_id", "workspace_id") REFERENCES "environments"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_pages" ADD CONSTRAINT "status_pages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proxies" ADD CONSTRAINT "proxies_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docker_hosts" ADD CONSTRAINT "docker_hosts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenances" ADD CONSTRAINT "maintenances_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_monitors" ADD CONSTRAINT "maintenance_monitors_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_status_pages" ADD CONSTRAINT "maintenance_status_pages_status_page_id_fkey" FOREIGN KEY ("status_page_id") REFERENCES "status_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remote_browsers" ADD CONSTRAINT "remote_browsers_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environments" ADD CONSTRAINT "environments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;


COMMIT;
