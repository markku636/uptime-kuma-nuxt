-- Visual-diff monitor type: 新增設定欄位與基準／比對結果表。
-- 純新增，既有 monitor 的 visual_config 為 NULL，不需資料回填。
ALTER TABLE "monitors" ADD COLUMN "visual_config" JSONB;

CREATE TABLE "visual_baselines" (
    "id" SERIAL NOT NULL,
    "monitor_id" INTEGER NOT NULL,
    "viewport_label" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "image" BYTEA NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "config_version" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visual_baselines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "visual_baselines_monitor_id_viewport_label_key" ON "visual_baselines"("monitor_id", "viewport_label");

ALTER TABLE "visual_baselines" ADD CONSTRAINT "visual_baselines_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "visual_check_artifacts" (
    "id" BIGSERIAL NOT NULL,
    "monitor_id" INTEGER NOT NULL,
    "viewport_label" TEXT NOT NULL,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" SMALLINT NOT NULL,
    "diff_ratio" DOUBLE PRECISION,
    "diff_pixels" INTEGER,
    "diff_image" BYTEA,
    "metrics" JSONB,

    CONSTRAINT "visual_check_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "visual_check_artifacts_monitor_id_checked_at_idx" ON "visual_check_artifacts"("monitor_id", "checked_at" DESC);

ALTER TABLE "visual_check_artifacts" ADD CONSTRAINT "visual_check_artifacts_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
