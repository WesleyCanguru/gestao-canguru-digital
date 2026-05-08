-- RLS Policies para contract_forms
ALTER TABLE contract_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura pública via token" ON contract_forms;
CREATE POLICY "Permitir leitura pública via token" ON contract_forms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir atualização pública via token (submit)" ON contract_forms;
CREATE POLICY "Permitir atualização pública via token (submit)" ON contract_forms FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Usuários autenticados podem gerenciar contract_forms" ON contract_forms;
CREATE POLICY "Usuários autenticados podem gerenciar contract_forms" ON contract_forms FOR ALL TO authenticated USING (true) WITH CHECK (true);
