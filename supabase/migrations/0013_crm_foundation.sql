-- 0013 CRM Foundation (GHL-style, better). Home for the Lenus migration: clients + leads as
-- CRM CONTACTS, decoupled from auth. A contact is a record, not a login. When a contact creates
-- an app account, contacts.profile_id links to profiles and the legacy firewall flag transfers.
-- This is an intentional, documented deviation from PRD-00's literal "profiles" wording: the
-- 256 legacy clients (mostly churned) become contacts, not dormant auth users. The firewall
-- (is_legacy) lives on the contact and on any profile they later create.
-- Money is BIGINT cents (_cents). company_id NOT NULL + RLS on every table.

-- ---------------------------------------------------------------------------
-- contacts: the CRM record (clients + leads share this; areas filter by type)
-- ---------------------------------------------------------------------------
create table public.contacts (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  type            text not null check (type in ('client','lead')),
  lifecycle_stage text not null default 'lead'
                  check (lifecycle_stage in ('lead','active','past_due','unpaid','canceled','churned','won','lost')),
  first_name      text,
  last_name       text,
  email           text,
  phone           text,
  language        text check (language in ('en','es')),
  owner           text,
  source          text not null default 'app',
  -- legacy firewall (mirrors profiles; transfers to a profile on account creation)
  is_legacy       boolean not null default false,
  legacy_source   text,
  lenus_id        text,
  profile_id      uuid references public.profiles(id) on delete set null,
  -- lead pipeline fields (used when type = 'lead')
  lead_stage      text,
  lead_type       text,
  lost_reason     text,
  is_referred     boolean not null default false,
  is_duplicate    boolean not null default false,
  was_lead        boolean not null default false,  -- client who originated as a lead (funnel link)
  -- client quick field
  product_type    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.contacts enable row level security;
create index idx_contacts_company on public.contacts(company_id);
create index idx_contacts_type on public.contacts(company_id, type);
create index idx_contacts_email on public.contacts(company_id, lower(email));
create index idx_contacts_stage on public.contacts(company_id, lifecycle_stage);
create index idx_contacts_legacy on public.contacts(is_legacy) where is_legacy = true;
create index idx_contacts_lenus on public.contacts(lenus_id);
create policy contacts_tenant on public.contacts using (company_id = public.current_company_id());
comment on column public.contacts.is_legacy is
  'TRUE = existed before the app (Lenus). Never in rev-share. Transfers to profile on account creation.';

-- ---------------------------------------------------------------------------
-- client_subscriptions: grandfathered price + status + billing health (AC-2, AC-5)
-- ---------------------------------------------------------------------------
create table public.client_subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  company_id                uuid not null references public.companies(id) on delete cascade,
  contact_id                uuid not null references public.contacts(id) on delete cascade,
  status                    text not null check (status in ('active','past_due','unpaid','canceled','churned')),
  billing_health            text,
  product_type              text,
  grandfathered_price_cents bigint,
  currency                  text not null default 'USD',
  is_auto_renew             boolean,
  started_at                date,
  ended_at                  date,
  next_billing_date         date,
  next_amount_cents         bigint,
  lifetime_paid_cents       bigint,
  is_legacy                 boolean not null default false,
  source                    text not null default 'lenus',
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
alter table public.client_subscriptions enable row level security;
create index idx_client_subs_company on public.client_subscriptions(company_id);
create index idx_client_subs_contact on public.client_subscriptions(contact_id);
create index idx_client_subs_status on public.client_subscriptions(company_id, status);
create policy subs_tenant on public.client_subscriptions using (company_id = public.current_company_id());

-- ---------------------------------------------------------------------------
-- legacy_client_snapshot: Lenus engagement counts (export is summary-level)
-- ---------------------------------------------------------------------------
create table public.legacy_client_snapshot (
  contact_id          uuid primary key references public.contacts(id) on delete cascade,
  company_id          uuid not null references public.companies(id) on delete cascade,
  meal_plans          int,
  measurements_logged int,
  checkins            int,
  workouts_completed  int,
  messages_in_window  int,
  health_assessment   int,
  weight_goal         text,
  goal_intensity      text,
  source              text not null default 'lenus',
  created_at          timestamptz not null default now()
);
alter table public.legacy_client_snapshot enable row level security;
create policy snapshot_tenant on public.legacy_client_snapshot using (company_id = public.current_company_id());

-- ---------------------------------------------------------------------------
-- contact_transactions: Lenus billing history (revenue analytics)
-- ---------------------------------------------------------------------------
create table public.contact_transactions (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  contact_id        uuid references public.contacts(id) on delete set null,
  lenus_txn_id      text,
  lenus_customer_id text,
  occurred_at       date,
  category          text,
  gross_cents       bigint,
  coach_cents       bigint,
  currency          text not null default 'USD',
  is_pt_client      boolean,
  is_independent    boolean,
  source            text not null default 'lenus',
  created_at        timestamptz not null default now()
);
alter table public.contact_transactions enable row level security;
create index idx_txn_company on public.contact_transactions(company_id, occurred_at desc);
create index idx_txn_contact on public.contact_transactions(contact_id);
create policy txn_tenant on public.contact_transactions using (company_id = public.current_company_id());

-- ---------------------------------------------------------------------------
-- tags: categorized + editable (7 categories), with contact_tags join
-- ---------------------------------------------------------------------------
create table public.tags (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  category    text not null default 'custom'
              check (category in ('program','tier','health','service','lifecycle','language','special','custom')),
  label       text not null,
  slug        text not null,
  color       text not null default '#767676',
  is_system   boolean not null default false,
  source      text not null default 'app',
  created_at  timestamptz not null default now(),
  unique (company_id, slug)
);
alter table public.tags enable row level security;
create index idx_tags_company on public.tags(company_id, category);
create policy tags_tenant on public.tags using (company_id = public.current_company_id());

create table public.contact_tags (
  contact_id  uuid not null references public.contacts(id) on delete cascade,
  tag_id      uuid not null references public.tags(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (contact_id, tag_id)
);
alter table public.contact_tags enable row level security;
create index idx_contact_tags_tag on public.contact_tags(tag_id);
create policy contact_tags_tenant on public.contact_tags using (company_id = public.current_company_id());

-- ---------------------------------------------------------------------------
-- migration_log: traceability per PRD-00
-- ---------------------------------------------------------------------------
create table public.migration_log (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  lenus_id         text not null,
  target_id        uuid,
  dataset          text not null,
  records_imported integer not null default 0,
  status           text not null default 'pending' check (status in ('pending','imported','failed')),
  error            text,
  created_at       timestamptz not null default now()
);
alter table public.migration_log enable row level security;
create index idx_migration_lenus on public.migration_log(lenus_id);
create policy migration_log_tenant on public.migration_log using (company_id = public.current_company_id());

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger set_contacts_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();
create trigger set_subs_updated_at before update on public.client_subscriptions
  for each row execute function public.set_updated_at();
