-- PRD-04c: onboarding intake built on the form engine. One response row per profile.
create table public.onboarding_responses (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  profile_id        uuid not null references public.profiles(id) on delete cascade,
  answers           jsonb not null default '{}'::jsonb,
  predicted_goal    text,
  computed_targets  jsonb,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(profile_id)
);
alter table public.onboarding_responses enable row level security;
create index idx_onboarding_company on public.onboarding_responses(company_id);
create policy onboarding_tenant on public.onboarding_responses using (company_id = public.current_company_id());

create trigger set_onboarding_updated_at before update on public.onboarding_responses
  for each row execute function public.set_updated_at();
