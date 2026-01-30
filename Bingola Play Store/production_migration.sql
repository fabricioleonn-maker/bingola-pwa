-- ENUMS (if not exist)
DO $$ BEGIN
    CREATE TYPE purchase_status AS ENUM ('RECEIVED', 'VERIFIED', 'GRANTED', 'REJECTED', 'ERROR');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_platform AS ENUM ('android', 'ios');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_store AS ENUM ('google_play', 'apple_app_store');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ledger_type AS ENUM ('CREDIT', 'DEBIT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ledger_reason AS ENUM ('PLAY_PURCHASE', 'APPLE_PURCHASE', 'CREATE_TABLE', 'REFUND', 'ADMIN_ADJUST');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- TABLES
CREATE TABLE IF NOT EXISTS product_catalog (
    product_id TEXT PRIMARY KEY,
    store_google_sku TEXT,
    store_apple_product_id TEXT,
    bcoins_amount INTEGER NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: We use the existing 'profiles' table instead of a new 'wallets' table
-- We just need to ensure 'bcoins' column exists (it already does per my check)

CREATE TABLE IF NOT EXISTS store_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    platform payment_platform NOT NULL,
    store payment_store NOT NULL,
    product_id TEXT NOT NULL REFERENCES product_catalog(product_id),
    store_product_id TEXT NOT NULL,
    token_or_tx_id TEXT UNIQUE NOT NULL,
    order_id TEXT,
    purchase_time TIMESTAMPTZ,
    status purchase_status DEFAULT 'RECEIVED',
    raw_provider_response JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    type ledger_type NOT NULL,
    reason ledger_reason NOT NULL,
    amount INTEGER NOT NULL CHECK (amount >= 0),
    related_purchase_id UUID REFERENCES store_purchases(id),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RPC for crediting wallet atomically (Targeting profiles table)
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
    -- Update balance directly in profiles
    UPDATE profiles
    SET bcoins = COALESCE(bcoins, 0) + p_amount,
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING bcoins INTO v_new_balance;

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

-- RPC for debiting wallet atomically (Targeting profiles table)
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
    SELECT bcoins INTO v_current_balance
    FROM profiles
    WHERE id = p_user_id;

    IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;

    -- Update balance
    UPDATE profiles
    SET bcoins = bcoins - p_amount,
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING bcoins INTO v_new_balance;

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

-- INITIAL SEED (Examples)
INSERT INTO product_catalog (product_id, store_google_sku, store_apple_product_id, bcoins_amount) VALUES
('bcoins_pack_100', 'bcoins_100', 'com.bingola.bcoins.100', 100),
('bcoins_pack_500', 'bcoins_500', 'com.bingola.bcoins.500', 500),
('bcoins_pack_1000', 'bcoins_1000', 'com.bingola.bcoins.1000', 1000)
ON CONFLICT (product_id) DO NOTHING;
