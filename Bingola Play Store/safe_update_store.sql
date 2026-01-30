-- 1. SAFE CATALOG UPDATE (Upsert)
-- Instead of deleting, we update existing or insert new ones. This preserves purchase history.
INSERT INTO product_catalog (product_id, store_google_sku, store_apple_product_id, bcoins_amount) VALUES
('bcoins_pack_100', 'bcoins_100', 'com.bingola.bcoins.100', 100),
('bcoins_pack_260', 'bcoins_260', 'com.bingola.bcoins.260', 260),
('bcoins_pack_500', 'bcoins_500', 'com.bingola.bcoins.500', 500),
('bcoins_pack_1000', 'bcoins_1000', 'com.bingola.bcoins.1000', 1000),
('bcoins_pack_2500', 'bcoins_2500', 'com.bingola.bcoins.2500', 2500),
('bcoins_pack_5000', 'bcoins_5000', 'com.bingola.bcoins.5000', 5000)
ON CONFLICT (product_id) DO UPDATE SET
    store_google_sku = EXCLUDED.store_google_sku,
    store_apple_product_id = EXCLUDED.store_apple_product_id,
    bcoins_amount = EXCLUDED.bcoins_amount;

-- 2. RESET FRONTEND DISPLAY (Store Products)
-- We can safely delete these as they are usually just for display and re-populate them.
DELETE FROM store_products;

INSERT INTO store_products (id, title, description, price, coins, promo_price, is_active, is_hot, display_order, product_id) VALUES
-- 100 Coins
(gen_random_uuid(), 'Pacote Iniciante', 'Ideal para começar a diversão!', 4.90, 100, NULL, true, false, 1, 'bcoins_pack_100'),

-- 260 Coins
(gen_random_uuid(), 'Pacote Prata', 'O melhor custo benefício.', 12.90, 260, NULL, true, true, 2, 'bcoins_pack_260'),

-- 500 Coins
(gen_random_uuid(), 'Pacote Ouro', 'Para quem joga sério!', 24.90, 500, NULL, true, false, 3, 'bcoins_pack_500'),

-- 1000 Coins
(gen_random_uuid(), 'Pacote Diamante', 'Muitas rodadas garantidas.', 49.90, 1000, 44.90, true, false, 4, 'bcoins_pack_1000'),

-- 2500 Coins
(gen_random_uuid(), 'Pacote Mestre', 'Para os verdadeiros campeões.', 119.90, 2500, NULL, true, false, 5, 'bcoins_pack_2500'),

-- 5000 Coins
(gen_random_uuid(), 'Pacote Lendário', 'BCOINS que não acabam mais!', 229.90, 5000, 199.90, true, true, 6, 'bcoins_pack_5000');
