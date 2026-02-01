-- 7. LIFETIME PREMIUM SUPPORT
-- Adds specific column for Lifetime Subscriptions

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_lifetime_premium BOOLEAN DEFAULT FALSE;

-- Update RLS or constraints if needed (usually not for simple flags)
COMMENT ON COLUMN profiles.is_lifetime_premium IS 'Indicates if the user has a lifetime subscription that never expires.';
