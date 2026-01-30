-- ENUMS
CREATE TYPE purchase_status AS ENUM ('RECEIVED', 'VERIFIED', 'GRANTED', 'REJECTED', 'ERROR');
CREATE TYPE payment_platform AS ENUM ('android', 'ios');
CREATE TYPE payment_store AS ENUM ('google_play', 'apple_app_store');
CREATE TYPE ledger_type AS ENUM ('CREDIT', 'DEBIT');
CREATE TYPE ledger_reason AS ENUM ('PLAY_PURCHASE', 'APPLE_PURCHASE', 'CREATE_TABLE', 'REFUND', 'ADMIN_ADJUST');

-- TABLES
CREATE TABLE IF NOT EXISTS product_catalog (
    product_id TEXT PRIMARY KEY,
    store_google_sku TEXT,
    store_apple_product_id TEXT,
    bcoins_amount INTEGER NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallets (
    user_id UUID PRIMARY KEY,
    bcoins_balance INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS store_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
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
    user_id UUID NOT NULL REFERENCES wallets(user_id),
    type ledger_type NOT NULL,
    reason ledger_reason NOT NULL,
    amount INTEGER NOT NULL CHECK (amount >= 0),
    related_purchase_id UUID REFERENCES store_purchases(id),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INITIAL SEED (Examples)
INSERT INTO product_catalog (product_id, store_google_sku, store_apple_product_id, bcoins_amount) VALUES
('bcoins_pack_100', 'bcoins_100', 'com.bingola.bcoins.100', 100),
('bcoins_pack_500', 'bcoins_500', 'com.bingola.bcoins.500', 500),
('bcoins_pack_1000', 'bcoins_1000', 'com.bingola.bcoins.1000', 1000);
