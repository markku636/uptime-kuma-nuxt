-- Every writer takes monitor -> checkpoint locks before inspecting sealing boundaries.
CREATE OR REPLACE FUNCTION invalidate_late_heartbeat() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE checkpoint history_checkpoints%ROWTYPE;
BEGIN
 PERFORM id FROM monitors WHERE id=NEW.monitor_id FOR UPDATE;
 SELECT * INTO checkpoint FROM history_checkpoints WHERE monitor_id=NEW.monitor_id FOR UPDATE;
 IF FOUND THEN
  IF checkpoint.raw_deleted_before IS NOT NULL AND NEW.time<checkpoint.raw_deleted_before THEN
   RAISE EXCEPTION 'Late heartbeat predates retained raw history; explicit restore required';
  END IF;
  IF NEW.time<checkpoint.sealed_before THEN
   UPDATE history_checkpoints SET first_bucket=LEAST(first_bucket,date_trunc('hour',NEW.time,'UTC')),sealed_before=LEAST(sealed_before,date_trunc('hour',NEW.time,'UTC')),generation=generation+1 WHERE monitor_id=NEW.monitor_id;
  END IF;
 END IF;
 RETURN NEW;
END $$;
