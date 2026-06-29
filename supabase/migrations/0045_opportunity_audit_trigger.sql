-- 0045 PHASE 2 — Populate opportunity_audit so the lead timeline actually has history.
-- The lead detail page (src/lib/coach/leads.ts) READS opportunity_audit to build a stage/status
-- change timeline, but nothing ever WROTE it, so every timeline was empty. This trigger records a
-- row whenever an opportunity's stage or status changes (e.g. on a GHL sync update), the
-- field-by-field history the UI already renders.

create or replace function public.log_opportunity_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stage_id is distinct from old.stage_id then
    insert into public.opportunity_audit (company_id, opportunity_id, field_name, old_value, new_value, source)
    values (new.company_id, new.id, 'stage_id', old.stage_id::text, new.stage_id::text, 'ghl_sync');
  end if;
  if new.status is distinct from old.status then
    insert into public.opportunity_audit (company_id, opportunity_id, field_name, old_value, new_value, source)
    values (new.company_id, new.id, 'status', old.status, new.status, 'ghl_sync');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_opportunity_audit on public.opportunities;
create trigger trg_opportunity_audit
  after update on public.opportunities
  for each row
  execute function public.log_opportunity_change();
