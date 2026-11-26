-- 保存本次截圖，讓「接受為新基準」不必再跑一次檢查。
ALTER TABLE "visual_check_artifacts" ADD COLUMN "current_image" BYTEA;
