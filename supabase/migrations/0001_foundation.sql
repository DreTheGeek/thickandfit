-- PRD-01 Foundation: core tenancy, 5-role RBAC, legacy firewall, Fort Knox security suite.
-- Tenancy model (Build Profile D, consumer app): one company per profile, company_id from the JWT.
-- Stephanie is tenant 1; architecture supports white-label later. Money is BIGINT cents (none here).
-- Adapted from craneop/supabase/migrations (audit trigger, set_updated_at, helper fns).

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helper: current company from JWT claim (RLS tenant key)
-- ---------------------------------------------------------------------------
create or replace function public.current_company_id()
returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'company_id', '')::uuid;
$$;

-- ---------------------------------------------------------------------------
-- A: Core entities
-- ---------------------------------------------------------------------------
create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.companies enable row level security;
create policy company_isolation on public.companies
  using (id = public.current_company_id());

create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  company_id        uuid not null references public.companies(id) on delete cascade,
  email             text not null,
  full_name         text,
  role              text not null default 'subscriber'
                    check (role in ('subscriber','free','coach','assistant_coach','operator')),
  ui_locale         text not null default 'en' check (ui_locale in ('en','es')),
  content_locale    text not null default 'en' check (content_locale in ('en','es')),
  -- LEGACY FIREWALL (permanent, deployment-blocking)
  is_legacy_client  boolean not null default false,
  legacy_source     text,
  lenus_profile_id  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.profiles enable row level security;
create index idx_profiles_company on public.profiles(company_id);
create index idx_profiles_legacy on public.profiles(is_legacy_client) where is_legacy_client = true;
create policy profile_tenant on public.profiles
  using (company_id = public.current_company_id());
comment on column public.profiles.is_legacy_client is
  'TRUE = client existed before the app. Never expires. Never in rev-share. Only is_legacy_client=false enters rev-share. Sourced from Rodney 6/16 (rec 155315784). Missing flag on a migrated client BLOCKS deployment.';

-- ---------------------------------------------------------------------------
-- D: Lookup
-- ---------------------------------------------------------------------------
create table public.roles ( -- KALDR:GLOBAL
  key          text primary key,
  label        text not null,
  description  text
);
alter table public.roles enable row level security;
create policy roles_readable on public.roles for select using (true);
insert into public.roles (key, label, description) values
  ('subscriber',      'Subscriber',      'Paying client'),
  ('free',            'Free',            'Free / trial user'),
  ('coach',           'Coach',           'Head coach (Stephanie)'),
  ('assistant_coach', 'Assistant Coach', 'PT assistant, mid-ticket workflow'),
  ('operator',        'Operator',        'Internal admin / operator');

-- ---------------------------------------------------------------------------
-- G: Security and audit
-- ---------------------------------------------------------------------------
create table public.audit_log ( -- KALDR:GLOBAL
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid,
  user_id         uuid,
  entity_type     text not null,
  entity_id       uuid,
  action          text not null,
  previous_state  jsonb,
  new_state       jsonb,
  created_at      timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create index idx_audit_company on public.audit_log(company_id, created_at desc);
create policy audit_view_own on public.audit_log for select
  using (company_id = public.current_company_id());
create policy audit_system_insert on public.audit_log for insert with check (true);

create table public.session_logs ( -- KALDR:GLOBAL
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid,
  company_id          uuid,
  event_type          text not null,
  ip_address          text not null,
  user_agent          text,
  device_fingerprint  text,
  country             text,
  success             boolean not null,
  failure_reason      text,
  created_at          timestamptz not null default now()
);
alter table public.session_logs enable row level security;
create index idx_session_logs_user on public.session_logs(user_id, created_at desc);
create policy session_view_own on public.session_logs for select using (user_id = auth.uid());
create policy session_system_insert on public.session_logs for insert with check (true);

create table public.consent_captures (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  user_id          uuid not null,
  consent_type     text not null,
  consent_version  text not null,
  accepted         boolean not null,
  ip_address       text,
  user_agent       text,
  created_at       timestamptz not null default now()
);
alter table public.consent_captures enable row level security;
create index idx_consent_user on public.consent_captures(user_id, consent_type);
create policy consent_tenant on public.consent_captures using (company_id = public.current_company_id());

create table public.security_events ( -- KALDR:GLOBAL
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid,
  user_id      uuid,
  event_type   text not null,
  severity     text not null default 'info' check (severity in ('info','warn','high','critical')),
  detail       jsonb,
  ip_address   text,
  created_at   timestamptz not null default now()
);
alter table public.security_events enable row level security;
create index idx_security_events_type on public.security_events(event_type, created_at desc);
create policy security_events_system_insert on public.security_events for insert with check (true);
create policy security_events_view_own on public.security_events for select
  using (company_id = public.current_company_id());

create table public.rate_limit_log ( -- KALDR:GLOBAL
  id          uuid primary key default gen_random_uuid(),
  identifier  text not null,
  bucket      text not null,
  hit_at      timestamptz not null default now()
);
alter table public.rate_limit_log enable row level security;
create index idx_rate_limit_lookup on public.rate_limit_log(identifier, bucket, hit_at desc);
create policy rate_limit_system on public.rate_limit_log for all using (true) with check (true);

-- API keys (Build Profile D, internal): SHA-256 hash + indexed prefix. Never bcrypt.
create table public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  name         text not null,
  key_prefix   text not null,
  key_hash     text not null,            -- SHA-256 hex digest
  last_used_at timestamptz,
  created_at   timestamptz not null default now(),
  revoked_at   timestamptz
);
alter table public.api_keys enable row level security;
create index idx_api_keys_prefix on public.api_keys(key_prefix);
create policy api_keys_tenant on public.api_keys using (company_id = public.current_company_id());

create table public.api_usage_log ( -- KALDR:GLOBAL
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid,
  api_key_id   uuid references public.api_keys(id) on delete set null,
  route        text not null,
  method       text not null,
  status_code  int,
  latency_ms   int,
  created_at   timestamptz not null default now()
);
alter table public.api_usage_log enable row level security;
create index idx_api_usage_company on public.api_usage_log(company_id, created_at desc);
create policy api_usage_view_own on public.api_usage_log for select
  using (company_id = public.current_company_id());
create policy api_usage_system_insert on public.api_usage_log for insert with check (true);

-- ---------------------------------------------------------------------------
-- I: Notifications
-- ---------------------------------------------------------------------------
create table public.notification_preferences (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  user_id      uuid not null,
  channel      text not null check (channel in ('push','email','sms')),
  category     text not null,
  enabled      boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(user_id, channel, category)
);
alter table public.notification_preferences enable row level security;
create policy notif_pref_tenant on public.notification_preferences using (company_id = public.current_company_id());

-- ---------------------------------------------------------------------------
-- Triggers: updated_at + audit
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger set_companies_updated_at before update on public.companies
  for each row execute function public.set_updated_at();
create trigger set_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_notif_pref_updated_at before update on public.notification_preferences
  for each row execute function public.set_updated_at();

create or replace function public.audit_trigger_func()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_company_id uuid; v_old jsonb; v_new jsonb;
begin
  if TG_OP = 'DELETE' then v_old := to_jsonb(OLD); v_new := null;
  elsif TG_OP = 'UPDATE' then v_old := to_jsonb(OLD); v_new := to_jsonb(NEW);
  else v_old := null; v_new := to_jsonb(NEW); end if;
  if TG_OP != 'DELETE' then v_company_id := coalesce((v_new->>'company_id')::uuid, (v_new->>'id')::uuid);
  else v_company_id := coalesce((v_old->>'company_id')::uuid, (v_old->>'id')::uuid); end if;
  insert into public.audit_log(company_id, user_id, entity_type, entity_id, action, previous_state, new_state)
  values (v_company_id, auth.uid(), TG_TABLE_NAME,
    coalesce((v_new->>'id'), (v_old->>'id'))::uuid, TG_OP, v_old, v_new);
  return coalesce(NEW, OLD);
end;
$$;

create trigger audit_companies after insert or update or delete on public.companies
  for each row execute function public.audit_trigger_func();
create trigger audit_profiles after insert or update or delete on public.profiles
  for each row execute function public.audit_trigger_func();
