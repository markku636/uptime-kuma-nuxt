CREATE TABLE "security_rules" (
    "id" SERIAL NOT NULL,
    "workspace_id" INTEGER NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "source" VARCHAR(40) NOT NULL,
    "source_url" VARCHAR(512) NOT NULL,
    "product" VARCHAR(120) NOT NULL,
    "signature" VARCHAR(160) NOT NULL,
    "max_version" VARCHAR(40),
    "severity" VARCHAR(16) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "detail" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "refs" JSONB NOT NULL,
    "cwe" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "security_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "security_rule_identity" ON "security_rules"("workspace_id", "key");
CREATE INDEX "security_rule_scope" ON "security_rules"("workspace_id", "active");
ALTER TABLE "security_rules" ADD CONSTRAINT "security_rules_workspace_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
