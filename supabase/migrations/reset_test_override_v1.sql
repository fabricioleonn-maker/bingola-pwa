-- 6. CYCLE TEST OVERRIDE V1
-- Adds support for 'test_1min' mode that reverts to previous mode after reset.

-- 1. Add column to store the original mode before testing
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS previous_reset_mode TEXT;

-- 2. Update Function to handle override reversion
CREATE OR REPLACE FUNCTION reset_all_bpoints()
RETURNS void AS $$
DECLARE
  v_winners JSONB;
  v_mode TEXT;
  v_prev_mode TEXT;
  v_settings_id INT;
BEGIN
  -- 1. Grab Settings
  SELECT id, bpoints_reset_mode, previous_reset_mode INTO v_settings_id, v_mode, v_prev_mode FROM app_settings LIMIT 1;

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
      RAISE WARNING 'Failed to save ranking history: %', SQLERRM;
  END;

  -- 4. Execute Reset (CRITICAL)
  UPDATE profiles SET bpoints = 0 WHERE bpoints > 0;
  
  -- 5. Update Cycle & Mode logic
  IF v_settings_id IS NOT NULL THEN
    
    -- If we are in TEST OVERRIDE mode, restore the previous mode
    IF v_mode = 'test_1min' AND v_prev_mode IS NOT NULL THEN
       UPDATE app_settings 
       SET 
         bpoints_reset_mode = v_prev_mode, -- Restore original mode (e.g. 'daily')
         previous_reset_mode = NULL,       -- Clear backup
         last_bpoints_reset = NOW()        -- Restart cycle from now
       WHERE id = v_settings_id;
    ELSE
       -- Standard reset
       UPDATE app_settings 
       SET last_bpoints_reset = NOW() 
       WHERE id = v_settings_id;
    END IF;

  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
