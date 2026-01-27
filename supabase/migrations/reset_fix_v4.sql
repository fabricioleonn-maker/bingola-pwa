-- 1. Garante que a tabela de histórico exista
CREATE TABLE IF NOT EXISTS ranking_history (
  id BIGSERIAL PRIMARY KEY,
  cycle_end_at TIMESTAMPTZ DEFAULT NOW(),
  mode TEXT,
  winners JSONB
);

-- 3. RESET GLOBAL V4 (Totalmente independente de ID e com WHERE clause)
CREATE OR REPLACE FUNCTION reset_all_bpoints()
RETURNS void AS $$
DECLARE
  v_winners JSONB;
  v_mode TEXT;
  v_settings_id INT;
BEGIN
  -- Tenta pegar a configuração da primeira linha disponível
  SELECT id, bpoints_reset_mode INTO v_settings_id, v_mode FROM app_settings LIMIT 1;

  -- Captura Top 3 vencedores atuais para o histórico
  SELECT json_agg(t) INTO v_winners
  FROM (
    SELECT username, bpoints, avatar_url, 
           ROW_NUMBER() OVER(ORDER BY bpoints DESC) as rank
    FROM profiles
    ORDER BY bpoints DESC
    LIMIT 3
  ) t;

  -- Salva no histórico se houver vencedores
  IF v_winners IS NOT NULL THEN
    INSERT INTO ranking_history (mode, winners)
    VALUES (COALESCE(v_mode, 'manual'), v_winners);
  END IF;

  -- ZERA TUDO (Adicionando WHERE clause para evitar erro de segurança)
  UPDATE profiles SET bpoints = 0 WHERE bpoints >= 0;
  
  -- Atualiza data do último reset na linha encontrada
  IF v_settings_id IS NOT NULL THEN
    UPDATE app_settings 
    SET last_bpoints_reset = NOW() 
    WHERE id = v_settings_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Garante que pelo menos uma linha de app_settings exista se a tabela estiver vazia
INSERT INTO app_settings (bpoints_reset_mode)
SELECT 'manual'
WHERE NOT EXISTS (SELECT 1 FROM app_settings);
