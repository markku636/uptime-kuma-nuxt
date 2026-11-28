CREATE TABLE "bruno_test_suites" (
    "id" SERIAL NOT NULL,
    "workspace_id" INTEGER NOT NULL,
    "environment_id" INTEGER NOT NULL,
    "collection_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "definition" JSONB NOT NULL,
    "test_secrets" TEXT,
    "source_fingerprint" VARCHAR(64) NOT NULL,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bruno_test_suites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bruno_test_runs" (
    "id" BIGSERIAL NOT NULL,
    "workspace_id" INTEGER NOT NULL,
    "suite_id" INTEGER NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),
    "triggered_by" INTEGER NOT NULL,
    "summary" JSONB NOT NULL,
    CONSTRAINT "bruno_test_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bruno_test_steps" (
    "id" BIGSERIAL NOT NULL,
    "run_id" BIGINT NOT NULL,
    "step_index" INTEGER NOT NULL,
    "path" VARCHAR(256) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "method" VARCHAR(16) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "http_status" INTEGER,
    "elapsed_ms" INTEGER NOT NULL,
    "error_code" VARCHAR(64),
    "assertions" JSONB NOT NULL,
    "extracted_names" TEXT[] DEFAULT ARRAY[]::TEXT[],
    CONSTRAINT "bruno_test_steps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bruno_test_suite_identity" ON "bruno_test_suites"("workspace_id", "environment_id", "collection_id", "name");
CREATE INDEX "bruno_test_run_scope" ON "bruno_test_runs"("workspace_id", "suite_id", "started_at");
CREATE UNIQUE INDEX "bruno_test_run_one_running" ON "bruno_test_runs"("suite_id") WHERE "status" = 'running';
CREATE UNIQUE INDEX "bruno_test_step_index" ON "bruno_test_steps"("run_id", "step_index");

ALTER TABLE "bruno_test_suites" ADD CONSTRAINT "bruno_test_suites_workspace_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bruno_test_runs" ADD CONSTRAINT "bruno_test_runs_suite_fkey" FOREIGN KEY ("suite_id") REFERENCES "bruno_test_suites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bruno_test_steps" ADD CONSTRAINT "bruno_test_steps_run_fkey" FOREIGN KEY ("run_id") REFERENCES "bruno_test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
