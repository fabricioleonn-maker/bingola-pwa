-- 8. ADD FULL NAME COLUMN
-- Allows users to have a display name separate from their unique username.

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT;

COMMENT ON COLUMN profiles.full_name IS 'Display name of the user (e.g. Fabricio Leon).';
