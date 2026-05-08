-- Adiciona campos na tabela contract_forms
ALTER TABLE contract_forms ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
ALTER TABLE contract_forms ADD COLUMN IF NOT EXISTS signed_contract_url TEXT;
ALTER TABLE contract_forms ADD COLUMN IF NOT EXISTS contract_value DECIMAL(10, 2);
ALTER TABLE contract_forms ADD COLUMN IF NOT EXISTS contract_start_date DATE;

-- Atualiza a constraint de status (se for check) ou apenas deixa aceitar 'signed' se for TEXT
-- O Supabase normalmente cria CHECK constraints se foi usado enum limitando, ou é apenas texto.
ALTER TABLE contract_forms DROP CONSTRAINT IF EXISTS contract_forms_status_check;
ALTER TABLE contract_forms ADD CONSTRAINT contract_forms_status_check CHECK (status IN ('pending', 'submitted', 'signed'));
