-- Add subscription_end_date to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMPTZ DEFAULT NULL;

-- Comment on column
COMMENT ON COLUMN public.profiles.subscription_end_date IS 'Timestamp when the user subscription ends. If NULL or past, user is free tier.';
