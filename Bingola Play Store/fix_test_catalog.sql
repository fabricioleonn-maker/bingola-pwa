-- 1. ADD TEST PACKAGES TO CATALOG (Backend)
INSERT INTO product_catalog (product_id, store_google_sku, store_apple_product_id, bcoins_amount) VALUES
('bcoins_pack_10', 'bcoins_10', 'com.bingola.bcoins.10', 10),
('bcoins_pack_50', 'bcoins_50', 'com.bingola.bcoins.50', 50)
ON CONFLICT (product_id) DO NOTHING;

-- 2. REPAIR FRONTEND LINKS
-- If the user created them manually, they might be linked to default or nothing.
-- We try to find them by coin amount and link them to the correct new IDs.

UPDATE store_products 
SET product_id = 'bcoins_pack_10' 
WHERE coins = 10;

UPDATE store_products 
SET product_id = 'bcoins_pack_50' 
WHERE coins = 50;
