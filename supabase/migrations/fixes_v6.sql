-- SQL V6: FIXES PARA ABANDONO DE MESA, RECOMPENSAS E ESTABILIDADE

-- 1. Permissões de Deleção para Participantes (CORRIGE O BOTÃO ABANDONAR)
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can delete their own participant rows" ON participants;
CREATE POLICY "Users can delete their own participant rows" ON participants
FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Hosts can remove participants" ON participants;
CREATE POLICY "Hosts can remove participants" ON participants
FOR DELETE USING (EXISTS (
  SELECT 1 FROM rooms 
  WHERE rooms.id = participants.room_id 
  AND rooms.host_id = auth.uid()
));

-- 2. Tabela para Notificações de Recompensa (Indicação)
CREATE TABLE IF NOT EXISTS referral_rewards (
  id BIGSERIAL PRIMARY KEY,
  referrer_id UUID REFERENCES profiles(id),
  buyer_name TEXT,
  amount INT DEFAULT 10,
  is_claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Referrers can view their rewards" ON referral_rewards;
CREATE POLICY "Referrers can view their rewards" ON referral_rewards
FOR SELECT USING (auth.uid() = referrer_id);

DROP POLICY IF EXISTS "Referriers can update their rewards to claimed" ON referral_rewards;
CREATE POLICY "Referriers can update their rewards to claimed" ON referral_rewards
FOR UPDATE USING (auth.uid() = referrer_id)
WITH CHECK (is_claimed = true);

-- 3. Atualiza RPC de Compra para registrar a recompensa
CREATE OR REPLACE FUNCTION process_bcoins_purchase(
  p_buyer_id UUID,
  p_coins_added INT,
  p_referrer_id UUID DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_already_referred UUID;
  v_buyer_name TEXT;
BEGIN
  -- 1. Atualiza saldo do comprador
  UPDATE profiles SET bcoins = COALESCE(bcoins, 0) + p_coins_added WHERE id = p_buyer_id;
  
  -- 2. Busca nome do comprador para a notificação
  SELECT username INTO v_buyer_name FROM profiles WHERE id = p_buyer_id;

  -- 3. Verifica se o comprador já foi indicado antes
  SELECT referred_by INTO v_already_referred FROM profiles WHERE id = p_buyer_id;

  -- 4. Se não foi indicado e o referrer_id é válido, premia o indicador
  IF v_already_referred IS NULL AND p_referrer_id IS NOT NULL AND p_referrer_id != p_buyer_id THEN
    -- Atualiza saldo do indicador
    UPDATE profiles SET bcoins = COALESCE(bcoins, 0) + 10 WHERE id = p_referrer_id;
    
    -- Marca quem indicou o comprador
    UPDATE profiles SET referred_by = p_referrer_id WHERE id = p_buyer_id;
    
    -- Registra na tabela de recompensas para o App mostrar o modal
    INSERT INTO referral_rewards (referrer_id, buyer_name, amount)
    VALUES (p_referrer_id, COALESCE(v_buyer_name, 'Um novo jogador'), 10);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
