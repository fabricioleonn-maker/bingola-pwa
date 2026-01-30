-- 1. Add missing 260 BCOINS package to backend catalog
INSERT INTO product_catalog (product_id, store_google_sku, store_apple_product_id, bcoins_amount) 
VALUES ('bcoins_pack_260', 'bcoins_260', 'com.bingola.bcoins.260', 260)
ON CONFLICT (product_id) DO NOTHING;

-- 2. Ensure store_products (frontend display) has the correct mapping
-- We assume store_products exists. We update the row with 260 coins to link to this catalog ID.
-- If product_id column doesn't exist in store_products, this query might need adjustment, 
-- but based on StoreScreen.tsx usage, it implies the column exists or is expected.

UPDATE store_products 
SET product_id = 'bcoins_pack_260'
WHERE coins = 260;

-- 3. Just in case, insert it if it doesn't exist in store_products (Optional, safe)
INSERT INTO store_products (title, price, coins, product_id, is_active, display_order)
SELECT 'Pacote Prata', 25.90, 260, 'bcoins_pack_260', true, 2
WHERE NOT EXISTS (SELECT 1 FROM store_products WHERE coins = 260);
