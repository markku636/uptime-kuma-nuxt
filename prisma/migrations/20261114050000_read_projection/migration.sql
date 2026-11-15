ALTER TABLE heartbeats ADD COLUMN coverage_seconds INTEGER;
ALTER TABLE heartbeats ADD CONSTRAINT heartbeats_coverage_seconds_check CHECK(coverage_seconds BETWEEN 0 AND 7200);
ALTER TABLE monitor_states ADD COLUMN assertion_results JSONB;
CREATE INDEX heartbeats_monitor_id_time_id_idx ON heartbeats(monitor_id,time DESC,id DESC);
DROP INDEX heartbeats_monitor_id_time_idx;
CREATE INDEX heartbeats_time_id_idx ON heartbeats(time,id);
CREATE INDEX heartbeats_important_monitor_idx ON heartbeats(monitor_id,time DESC,id DESC) WHERE important=true;
