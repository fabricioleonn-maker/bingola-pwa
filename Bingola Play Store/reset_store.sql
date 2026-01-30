-- 1. CLEANUP (Safe delete)
-- Delete frontend products first due to potential FK (if any, though usually loose loose coupling here)
DELETE FROM store_products;
DELETE FROM product_catalog;

-- 2. INSERT BACKEND CATALOG (The source of truth for Validation)
INSERT INTO product_catalog (product_id, store_google_sku, store_apple_product_id, bcoins_amount) VALUES
('bcoins_pack_100', 'bcoins_100', 'com.bingola.bcoins.100', 100),
('bcoins_pack_260', 'bcoins_260', 'com.bingola.bcoins.260', 260),
('bcoins_pack_500', 'bcoins_500', 'com.bingola.bcoins.500', 500),
('bcoins_pack_1000', 'bcoins_1000', 'com.bingola.bcoins.1000', 1000),
('bcoins_pack_2500', 'bcoins_2500', 'com.bingola.bcoins.2500', 2500),
('bcoins_pack_5000', 'bcoins_5000', 'com.bingola.bcoins.5000', 5000);

-- 3. INSERT FRONTEND STORE PRODUCTS (Display info linked to Backend Catalog)
INSERT INTO store_products (id, title, description, price, coins, promo_price, is_active, is_hot, display_order, product_id) VALUES
-- 100 Coins
(gen_random_uuid(), 'Pacote Iniciante', 'Ideal para começar a diversão!', 4.90, 100, NULL, true, false, 1, 'bcoins_pack_100'),

-- 260 Coins (O que estava faltando)
(gen_random_uuid(), 'Pacote Prata', 'O melhor custo benefício para iniciantes.', 12.90, 260, NULL, true, true, 2, 'bcoins_pack_260'),

-- 500 Coins
(gen_random_uuid(), 'Pacote Ouro', 'Para quem joga sério!', 24.90, 500, NULL, true, false, 3, 'bcoins_pack_500'),

-- 1000 Coins
(gen_random_uuid(), 'Pacote Diamante', 'Muitas rodadas garantidas.', 49.90, 1000, 44.90, true, false, 4, 'bcoins_pack_1000'),

-- 2500 Coins
(gen_random_uuid(), 'Pacote Mestre', 'Para os verdadeiros campeões.', 119.90, 2500, NULL, true, false, 5, 'bcoins_pack_2500'),

-- 5000 Coins
(gen_random_uuid(), 'Pacote Lendário', 'BCOINS que não acabam mais!', 229.90, 5000, 199.90, true, true, 6, 'bcoins_pack_5000');
