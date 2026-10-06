-- 1. Logo da agência Joey Digital
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS logo_url TEXT;

UPDATE agencies
SET logo_url = 'https://wtzphiyybitcucwkfpgv.supabase.co/storage/v1/object/public/post-uploads/logos/joey-digital.png'
WHERE id = 7;

-- 2. Campos separados de Target Audience (Step 3) e Links de Redes Sociais (Step 1)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS target_age_ranges TEXT[],
  ADD COLUMN IF NOT EXISTS target_location TEXT,
  ADD COLUMN IF NOT EXISTS target_interests TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_url TEXT,
  ADD COLUMN IF NOT EXISTS google_business_url TEXT;

-- 3. Colunas para Reset de Access Key
ALTER TABLE client_users
  ADD COLUMN IF NOT EXISTS password_reset_token TEXT,
  ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;
