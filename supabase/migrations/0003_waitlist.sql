-- PRD-03: pre-registration waitlist + the production tenant.
-- Seeds the real Thick & Fit company (Stephanie = tenant 1). This is the canonical tenant,
-- not demo data: public waitlist leads and, later, migrated clients belong to it.

insert into public.companies (id, name, slug) values
  ('c0ffee00-0000-4000-8000-000000000001', 'Thick & Fit', 'thick-and-fit')
on conflict (slug) do nothing;

create table public.waitlist_leads (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  email           text not null,
  locale          text not null default 'en' check (locale in ('en','es')),
  source          text,
  ghl_contact_id  text,
  created_at      timestamptz not null default now()
);
alter table public.waitlist_leads enable row level security;
create index idx_waitlist_company on public.waitlist_leads(company_id, created_at desc);
create unique index idx_waitlist_email on public.waitlist_leads(company_id, email);

-- Coaches/operators read their company's leads. Inserts happen via the validated
-- waitlist-submit route using the service client (RLS-bypassing), never anon direct insert.
create policy waitlist_tenant on public.waitlist_leads for select
  using (company_id = public.current_company_id());
