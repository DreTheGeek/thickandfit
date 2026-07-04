-- 0073 -- Add public.notifications to the Realtime publication so the in-app notification bell's
-- postgres_changes subscription actually fires. 0031 created the table + push delivery but never
-- published it for Realtime, so the bell's live badge never updated until a manual refresh.
-- Idempotent guard mirrors 0037_messages.sql.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
