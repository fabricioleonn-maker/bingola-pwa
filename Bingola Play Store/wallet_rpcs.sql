-- RPC for crediting wallet atomically
CREATE OR REPLACE FUNCTION credit_wallet(
    p_user_id UUID,
    p_amount INTEGER,
    p_reason ledger_reason,
    p_purchase_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_new_balance INTEGER;
BEGIN
    -- Ensure wallet exists
    INSERT INTO wallets (user_id, bcoins_balance)
    VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;

    -- Update balance
    UPDATE wallets
    SET bcoins_balance = bcoins_balance + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING bcoins_balance INTO v_new_balance;

    -- Insert ledger entry
    INSERT INTO wallet_ledger (user_id, type, reason, amount, related_purchase_id, metadata)
    VALUES (p_user_id, 'CREDIT', p_reason, p_amount, p_purchase_id, p_metadata);

    RETURN jsonb_build_object(
        'user_id', p_user_id,
        'new_balance', v_new_balance,
        'credited_amount', p_amount
    );
END;
$$ LANGUAGE plpgsql;

-- RPC for debiting wallet atomically
CREATE OR REPLACE FUNCTION debit_wallet(
    p_user_id UUID,
    p_amount INTEGER,
    p_reason ledger_reason,
    p_table_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_current_balance INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- Get current balance
    SELECT bcoins_balance INTO v_current_balance
    FROM wallets
    WHERE user_id = p_user_id;

    IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;

    -- Update balance
    UPDATE wallets
    SET bcoins_balance = bcoins_balance - p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING bcoins_balance INTO v_new_balance;

    -- Insert ledger entry
    INSERT INTO wallet_ledger (user_id, type, reason, amount, metadata)
    VALUES (p_user_id, 'DEBIT', p_reason, p_amount, p_metadata);

    RETURN jsonb_build_object(
        'user_id', p_user_id,
        'new_balance', v_new_balance,
        'debited_amount', p_amount
    );
END;
$$ LANGUAGE plpgsql;
