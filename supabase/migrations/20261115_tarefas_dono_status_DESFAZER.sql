-- Desfaz: tira o gatilho e volta dono/status das tarefas como estavam em 15/11 (cópia em bkp.agency_tasks_20261115).
drop trigger if exists trg_agency_tasks_default_owner on public.agency_tasks;
drop function if exists public.agency_tasks_default_owner();
update public.agency_tasks t
   set assignee_user_id = b.assignee_user_id, assignee_name = b.assignee_name, status = b.status
  from bkp.agency_tasks_20261115 b where b.id = t.id;
