-- SQL Migration: Versionamento de aprovação de posts (Histórico de Revisões)

CREATE TABLE IF NOT EXISTS public.post_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  agency_id integer NOT NULL DEFAULT 1,
  version_number integer NOT NULL DEFAULT 1,
  action text NOT NULL, -- 'submitted', 'rejected', 'approved', 'revision_requested', 'status_changed', 'edited'
  actor_role text NOT NULL, -- 'agency' ou 'client'
  actor_name text,
  rejection_reason text, -- motivo da rejeicao (preenchido pelo cliente/admin)
  caption_snapshot text, -- copia da legenda no momento da acao
  status_before text, -- status anterior ao evento
  status_after text, -- status apos o evento
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast query performance
CREATE INDEX IF NOT EXISTS idx_post_revisions_post_id ON public.post_revisions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_revisions_agency_id ON public.post_revisions(agency_id);
CREATE INDEX IF NOT EXISTS idx_post_revisions_created_at ON public.post_revisions(created_at);

-- RLS (Row Level Security)
ALTER TABLE public.post_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo em post_revisions para usuarios autenticados e anonimos" ON public.post_revisions;
CREATE POLICY "Permitir tudo em post_revisions para usuarios autenticados e anonimos"
  ON public.post_revisions FOR ALL
  USING (true) WITH CHECK (true);
