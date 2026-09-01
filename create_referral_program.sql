-- SQL Migration: Programa de Indicação (Parceiros e Comissões)

-- 1. Criar tabela de parceiros de indicação
CREATE TABLE IF NOT EXISTS public.referral_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  contact TEXT,
  commission_rate NUMERIC(5,2) DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Criar tabela de comissões de indicação
CREATE TABLE IF NOT EXISTS public.referral_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id INTEGER NOT NULL,
  partner_id UUID NOT NULL REFERENCES public.referral_partners(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  billing_id UUID REFERENCES public.agency_billing(id) ON DELETE SET NULL,
  commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  client_paid_at DATE,
  partner_due_date DATE,
  paid_to_partner BOOLEAN DEFAULT false,
  paid_to_partner_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Adicionar coluna referral_partner_id na tabela clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS referral_partner_id UUID REFERENCES public.referral_partners(id) ON DELETE SET NULL;

-- 4. RLS (Row Level Security) - Habilitar e configurar permissões
ALTER TABLE public.referral_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo em referral_partners para agencia" ON public.referral_partners;
CREATE POLICY "Permitir tudo em referral_partners para agencia"
  ON public.referral_partners FOR ALL
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo em referral_commissions para agencia" ON public.referral_commissions;
CREATE POLICY "Permitir tudo em referral_commissions para agencia"
  ON public.referral_commissions FOR ALL
  USING (true) WITH CHECK (true);

-- 5. Inserção de Dados Iniciais
DO $$
DECLARE
  v_eric_id UUID;
  v_zizi_id UUID;
  v_varejao_id UUID;
BEGIN
  -- Inserir Eric (10% comissão)
  IF NOT EXISTS (SELECT 1 FROM public.referral_partners WHERE name = 'Eric' AND agency_id = 1) THEN
    INSERT INTO public.referral_partners (agency_id, name, commission_rate, notes, is_active)
    VALUES (1, 'Eric', 10.00, 'Parceiro comercial (10% de comissão)', true)
    RETURNING id INTO v_eric_id;
  ELSE
    SELECT id INTO v_eric_id FROM public.referral_partners WHERE name = 'Eric' AND agency_id = 1 LIMIT 1;
  END IF;

  -- Inserir Zizi (A definir - 0%)
  IF NOT EXISTS (SELECT 1 FROM public.referral_partners WHERE name = 'Zizi' AND agency_id = 1) THEN
    INSERT INTO public.referral_partners (agency_id, name, commission_rate, notes, is_active)
    VALUES (1, 'Zizi', 0.00, 'Prospect em andamento (comissão a definir)', true)
    RETURNING id INTO v_zizi_id;
  END IF;

  -- Vincular "Varejão do Ferro" ao Eric
  SELECT id INTO v_varejao_id FROM public.clients WHERE name ILIKE '%Varejão do ferro%' AND agency_id = 1 LIMIT 1;
  IF v_varejao_id IS NOT NULL AND v_eric_id IS NOT NULL THEN
    UPDATE public.clients SET referral_partner_id = v_eric_id WHERE id = v_varejao_id;
  END IF;
END $$;
