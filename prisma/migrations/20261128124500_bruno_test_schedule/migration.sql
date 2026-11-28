ALTER TABLE "bruno_test_suites" ADD COLUMN "schedule_interval_sec" INTEGER;
ALTER TABLE "bruno_test_suites" ADD COLUMN "next_run_at" TIMESTAMPTZ(3);
