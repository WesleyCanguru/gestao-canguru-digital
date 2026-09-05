-- Migração: Suporte a SLA em templates de processos e sub-tarefas em tarefas
-- Permite vincular templates de processo a tarefas com cálculo automático de SLA

-- 1. Coluna sla_days em process_templates (prazo em dias para cada etapa do template)
ALTER TABLE process_templates ADD COLUMN IF NOT EXISTS sla_days INTEGER DEFAULT 1;

-- 2. Colunas para hierarquia de sub-tarefas e SLA em agency_tasks
ALTER TABLE agency_tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES agency_tasks(id) ON DELETE CASCADE;
ALTER TABLE agency_tasks ADD COLUMN IF NOT EXISTS task_type TEXT;
ALTER TABLE agency_tasks ADD COLUMN IF NOT EXISTS sla_days INTEGER;

-- Comentários para documentação do schema
COMMENT ON COLUMN process_templates.sla_days IS 'Prazo em dias úteis para a conclusão desta etapa do processo';
COMMENT ON COLUMN agency_tasks.parent_task_id IS 'ID da tarefa pai para sub-tarefas de processos integrados';
COMMENT ON COLUMN agency_tasks.task_type IS 'Tipo do processo/template de origem (ex: reels, carrossel, campanha_meta)';
COMMENT ON COLUMN agency_tasks.sla_days IS 'SLA individual configurado para a etapa';
