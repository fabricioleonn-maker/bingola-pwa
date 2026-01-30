-- Function: draw_next_number (v2 - With Throttle)
-- Description: Securely draws the next number ONLY if the interval has passed.

CREATE OR REPLACE FUNCTION draw_next_number(room_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room rooms%ROWTYPE;
  v_pool int[];
  v_new_num int;
  v_updated_at timestamptz;
  v_interval int;
  v_last_update_ts timestamptz;
  v_elapsed_sec float;
BEGIN
  -- 1. Lock the room row
  SELECT * INTO v_room FROM rooms WHERE id = room_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Room not found');
  END IF;

  -- 2. Server-Side Throttle (Critical for sync)
  v_interval := COALESCE(v_room.draw_interval, 12);
  v_last_update_ts := v_room.updated_at;
  
  -- Calculate elapsed seconds since last update
  -- Using EXTRACT(EPOCH FROM ...)
  IF v_last_update_ts IS NOT NULL THEN
    SELECT EXTRACT(EPOCH FROM (now() - v_last_update_ts)) INTO v_elapsed_sec;
    
    -- Tolerance: Allow 1s early to account for clock drifts/rounding, but generally block spam
    -- If it hasn't been enough time, return "Too Early" (Not an error, just a no-op)
    IF v_elapsed_sec < (v_interval - 1.5) THEN
      RETURN jsonb_build_object('status', 'too_early', 'wait', (v_interval - v_elapsed_sec));
    END IF;
  END IF;

  -- 3. Calculate Available Pool
  SELECT array_agg(n) INTO v_pool
  FROM generate_series(1, 75) as n
  WHERE n <> ALL(COALESCE(v_room.drawn_numbers, '{}'));

  -- 4. Check for Game Over
  IF v_pool IS NULL OR array_length(v_pool, 1) IS NULL THEN
    RETURN jsonb_build_object('error', 'Game Over');
  END IF;

  -- 5. Pick Random Number
  v_new_num := v_pool[ 1 + floor(random() * array_length(v_pool, 1))::int ];
  v_updated_at := now();

  -- 6. Update Room Atomically
  UPDATE rooms 
  SET 
    drawn_numbers = array_append(COALESCE(drawn_numbers, '{}'), v_new_num),
    updated_at = v_updated_at
  WHERE id = room_id;

  RETURN jsonb_build_object('number', v_new_num, 'ts', v_updated_at, 'status', 'drawn');
END;
$$;
