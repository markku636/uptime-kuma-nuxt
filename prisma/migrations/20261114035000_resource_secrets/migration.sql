ALTER TABLE "notifications" ADD COLUMN "resource_secrets" TEXT;
ALTER TABLE "proxies" ADD COLUMN "resource_secrets" TEXT;
ALTER TABLE "docker_hosts" ADD COLUMN "resource_secrets" TEXT;
ALTER TABLE "remote_browsers" ADD COLUMN "resource_secrets" TEXT;
