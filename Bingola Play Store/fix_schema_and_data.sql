-- 1. CORREÇÃO DE SCHEMA (Adiciona a coluna faltante)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'store_products' AND column_name = 'product_id') THEN
        ALTER TABLE store_products ADD COLUMN product_id TEXT;
    END IF;
END $$;

-- 2. ATUALIZAÇÃO SEGURA DO CATÁLOGO (UPSERT)
INSERT INTO product_catalog (product_id, store_google_sku, store_apple_product_id, bcoins_amount) VALUES
('bcoins_pack_100', 'bcoins_100', 'com.bingola.bcoins.100', 100),
('bcoins_pack_260', 'bcoins_260', 'com.bingola.bcoins.260', 260),
('bcoins_pack_500', 'bcoins_500', 'com.bingola.bcoins.500', 500),
('bcoins_pack_1000', 'bcoins_1000', 'com.bingola.bcoins.1000', 1000),
('bcoins_pack_2500', 'bcoins_2500', 'com.bingola.bcoins.2500', 2500),
('bcoins_pack_5000', 'bcoins_5000', 'com.bingola.bcoins.5000', 5000)
ON CONFLICT (product_id) DO UPDATE SET
    bcoins_amount = EXCLUDED.bcoins_amount;

-- 3. RESET DO DISPLAY (PWA)
DELETE FROM store_products;

INSERT INTO store_products (title, description, price, coins, is_active, display_order, product_id) VALUES
('Pacote Iniciante', 'Ideal para começar a diversão!', 4.90, 100, true, 1, 'bcoins_pack_100'),
('Pacote Prata', 'O melhor custo benefício.', 12.90, 260, true, 2, 'bcoins_pack_260'),
('Pacote Ouro', 'Para quem joga sério!', 24.90, 500, true, 3, 'bcoins_pack_500'),
('Pacote Diamante', 'Muitas rodadas garantidas.', 49.90, 1000, true, 4, 'bcoins_pack_1000'),
('Pacote Mestre', 'Para os verdadeiros campeões.', 119.90, 2500, true, 5, 'bcoins_pack_2500'),
('Pacote Lendário', 'BCOINS que não acabam mais!', 229.90, 5000, true, 6, 'bcoins_pack_5000');
