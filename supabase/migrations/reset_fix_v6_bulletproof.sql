-- 5. BULLETPROOF RESET V6
-- Wraps History Insert in Exception Block so Reset NEVER fails.

CREATE OR REPLACE FUNCTION reset_all_bpoints()
RETURNS void AS $$
DECLARE
  v_winners JSONB;
  v_mode TEXT;
  v_settings_id INT;
BEGIN
  -- 1. Grab Settings
  SELECT id, bpoints_reset_mode INTO v_settings_id, v_mode FROM app_settings LIMIT 1;

  -- 2. Capture Winners (Safe aggregation)
  SELECT json_agg(t) INTO v_winners
  FROM (
    SELECT username, bpoints, avatar_url, 
           ROW_NUMBER() OVER(ORDER BY bpoints DESC) as rank
    FROM profiles
    ORDER BY bpoints DESC
    LIMIT 3
  ) t;

  -- 3. Attempt to Save History (Fail-safe)
  BEGIN
      IF v_winners IS NOT NULL THEN
        INSERT INTO ranking_history (mode, winners)
        VALUES (COALESCE(v_mode, 'manual'), v_winners);
      END IF;
  EXCEPTION WHEN OTHERS THEN
      -- Log error but continue to reset
      RAISE WARNING 'Failed to save ranking history: %', SQLERRM;
  END;

  -- 4. Execute Reset (CRITICAL)
  -- Update all profiles with > 0 points to 0.
  UPDATE profiles SET bpoints = 0 WHERE bpoints > 0;
  
  -- 5. Update Cycle Timestamp
  -- This is crucial to stop the client from calling this RPC repeatedly
  IF v_settings_id IS NOT NULL THEN
    UPDATE app_settings 
    SET last_bpoints_reset = NOW() 
    WHERE id = v_settings_id;
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
