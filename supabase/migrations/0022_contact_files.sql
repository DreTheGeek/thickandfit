-- 0022 Client files + progress photos. Lenus media was re-hosted to public Cloudflare R2 (durable,
-- non-expiring) but lives in the hidden lenus schema; import the client-scoped items into public so
-- the app can read them. Role-gated like the rest of the CRM PII.
create table if not exists public.contact_files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  category text,
  url text not null,
  bytes bigint,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_contact_files_url on public.contact_files (contact_id, url);
create index if not exists idx_contact_files_contact on public.contact_files (company_id, contact_id);

alter table public.contact_files enable row level security;

drop policy if exists contact_files_coach on public.contact_files;
create policy contact_files_coach on public.contact_files
  for all to authenticated
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());
