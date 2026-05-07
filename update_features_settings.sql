-- Adiciona a coluna para configurações de exibição na tabela clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS features_settings JSONB DEFAULT '{}'::jsonb;
