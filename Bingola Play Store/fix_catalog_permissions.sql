-- 1. ENABLE RLS (Ensure it's enabled)
ALTER TABLE product_catalog ENABLE ROW LEVEL SECURITY;

-- 2. DROP EXISTING POLICIES (To avoid conflicts)
DROP POLICY IF EXISTS "Enable read access for all users" ON product_catalog;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON product_catalog;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON product_catalog;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON product_catalog;

-- 3. CREATE NEW POLICIES
-- Read: Everyone (Public/Anon) can read the catalog
CREATE POLICY "Enable read access for all users" 
ON product_catalog FOR SELECT 
USING (true);

-- Write (Insert/Update/Delete): Only Authenticated Users (Admins)
CREATE POLICY "Enable insert for authenticated users" 
ON product_catalog FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" 
ON product_catalog FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Enable delete for authenticated users" 
ON product_catalog FOR DELETE 
TO authenticated 
USING (true);
