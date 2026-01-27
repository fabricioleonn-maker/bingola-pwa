-- SQL V5: CORREÇÃO DEFINITIVA DE PERMISSÕES E RESET
-- 1. Garante que as tabelas existem
CREATE TABLE IF NOT EXISTS app_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  bpoints_reset_mode TEXT DEFAULT 'manual',
  last_bpoints_reset TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ranking_history (
  id BIGSERIAL PRIMARY KEY,
  cycle_end_at TIMESTAMPTZ DEFAULT NOW(),
  mode TEXT,
  winners JSONB
);

-- 2. Habilita RLS (Row Level Security)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_history ENABLE ROW LEVEL SECURITY;

-- 3. Cria Políticas de Acesso
-- Permite que todos leiam as configurações
DROP POLICY IF EXISTS "Enable read for all" ON app_settings;
CREATE POLICY "Enable read for all" ON app_settings FOR SELECT USING (true);

-- Permite que todos leiam o histórico
DROP POLICY IF EXISTS "Enable read for all history" ON ranking_history;
CREATE POLICY "Enable read for all history" ON ranking_history FOR SELECT USING (true);

-- Permite que APENAS o Master atualize as configurações
DROP POLICY IF EXISTS "Master update settings" ON app_settings;
CREATE POLICY "Master update settings" ON app_settings 
FOR UPDATE USING (auth.email() = 'fabricio.leonn@gmail.com');

-- 4. RPC GLOBAL RESET V5 (Com WHERE clause para evitar erro 21000/UPDATE)
CREATE OR REPLACE FUNCTION reset_all_bpoints()
RETURNS void AS $$
DECLARE
  v_winners JSONB;
  v_mode TEXT;
  v_settings_id INT;
BEGIN
  -- Identifica o modo atual
  SELECT id, bpoints_reset_mode INTO v_settings_id, v_mode FROM app_settings LIMIT 1;

  -- Captura Top 3 atuais
  SELECT json_agg(t) INTO v_winners FROM (
    SELECT username, bpoints, avatar_url, ROW_NUMBER() OVER(ORDER BY bpoints DESC) as rank
    FROM profiles WHERE bpoints > 0 ORDER BY bpoints DESC LIMIT 3
  ) t;

  -- Salva no histórico se houver vencedores
  IF v_winners IS NOT NULL THEN
    INSERT INTO ranking_history (mode, winners) VALUES (COALESCE(v_mode, 'manual'), v_winners);
  END IF;

  -- ZERA TUDO (Adicionando WHERE para satisfazer critério de segurança do DB)
  UPDATE profiles SET bpoints = 0 WHERE bpoints >= 0;
  
  -- Atualiza carimbo de reset
  IF v_settings_id IS NOT NULL THEN
     UPDATE app_settings SET last_bpoints_reset = NOW() WHERE id = v_settings_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Inicializa linha de configurações se estiver vazia
INSERT INTO app_settings (id, bpoints_reset_mode)
VALUES (1, 'manual')
ON CONFLICT (id) DO NOTHING;
