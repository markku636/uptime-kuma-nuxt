ALTER TABLE "monitors" ADD COLUMN "snmp_oid" TEXT;
ALTER TABLE "monitors" ADD COLUMN "snmp_version" TEXT DEFAULT '2c';
ALTER TABLE "monitors" ADD COLUMN "cache_bust" BOOLEAN NOT NULL DEFAULT false;
