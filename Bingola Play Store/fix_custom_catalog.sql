-- 1. ADD MISSING PACKAGES TO CATALOG (Backend)
INSERT INTO product_catalog (product_id, store_google_sku, store_apple_product_id, bcoins_amount) VALUES
('bcoins_pack_1260', 'bcoins_1260', 'com.bingola.bcoins.1260', 1260),
('bcoins_pack_1760', 'bcoins_1760', 'com.bingola.bcoins.1760', 1760)
ON CONFLICT (product_id) DO NOTHING;

-- 2. REPAIR FRONTEND LINKS (Store Products)
-- Links products with 1260 coins to the correct backend ID
UPDATE store_products 
SET product_id = 'bcoins_pack_1260' 
WHERE coins = 1260;

-- Links products with 1760 coins to the correct backend ID
UPDATE store_products 
SET product_id = 'bcoins_pack_1760' 
WHERE coins = 1760;

-- 3. VERIFICATION (Optional - for logs)
-- SELECT * FROM store_products WHERE coins IN (1260, 1760);
