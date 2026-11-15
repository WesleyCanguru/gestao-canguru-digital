-- Tarefas: dono para todas, um status só, recorrentes voltam a "pending" (o ciclo é controlado por completed_at),
-- e dono padrão = quem criou.
create schema if not exists bkp;
create table if not exists bkp.agency_tasks_20261115 as select * from public.agency_tasks;

update public.agency_tasks
   set assignee_user_id = '5f8f7e4c-aebc-494c-8377-ec05e467dee8', assignee_name = 'Wesley Camelo'
 where agency_id = 1 and assignee_user_id is null;

update public.agency_tasks set status = 'completed' where status = 'done';

update public.agency_tasks set status = 'pending'
 where coalesce(recurrence_type, 'none') <> 'none' and status = 'completed';

create or replace function public.agency_tasks_default_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is null then new.created_by := auth.uid(); end if;
  if new.assignee_user_id is null then new.assignee_user_id := new.created_by; end if;
  if new.assignee_user_id is not null and (new.assignee_name is null or new.assignee_name = '') then
    select display_name into new.assignee_name from public.agency_members
     where user_id = new.assignee_user_id and agency_id = new.agency_id limit 1;
  end if;
  if new.status = 'done' then new.status := 'completed'; end if;
  return new;
end $$;

drop trigger if exists trg_agency_tasks_default_owner on public.agency_tasks;
create trigger trg_agency_tasks_default_owner before insert or update of status on public.agency_tasks
for each row execute function public.agency_tasks_default_owner();
