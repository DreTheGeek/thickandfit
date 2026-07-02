-- 0063 PHASE 2 -- domain_events: the append-only behavioral event stream (FitnessOS Architecture v1,
-- section 4). This is a TELEMETRY SUBSTRATE, not an event-sourcing platform: no subscribers, no
-- projections, no replay machinery. Rows are written fire-and-forget by trusted server code (service
-- client) at the moments that matter for the learning loop (food logged/corrected, workout, weight,
-- check-in, insight, goal). The append-only history is what makes the Phase-4 knowledge graph
-- buildable retroactively: the graph is a projection over this stream, never a second source of truth.
create table if not exists public.domain_events (
  id                       uuid primary key default gen_random_uuid(),
  company_id               uuid not null references public.companies(id) on delete cascade,
  profile_id               uuid,             -- the member the event is about (null for company-level)
  aggregate_id             uuid,             -- the row the event describes (food_log id, workout_log id, ...)
  aggregate_type           text not null,    -- food_log | workout_log | weight_entry | form_response | user_insight | goal | recommendation
  event_type               text not null,    -- closed union enforced in src/lib/events/emit.ts
  event_version            integer not null default 1,
  payload                  jsonb not null default '{}'::jsonb, -- small, no PII beyond profile_id
  correlation_id           uuid,             -- e.g. the ai_inference_id that caused this event
  idempotency_key          text not null unique, -- natural key <type>:<aggregate_id> or derived hash
  source                   text not null default 'app', -- app | cron | coach | system
  device_type              text,
  locale                   text,
  timezone_offset_minutes  integer,
  created_at               timestamptz not null default now()
);

create index if not exists idx_domain_events_company_type on public.domain_events (company_id, event_type, created_at desc);
create index if not exists idx_domain_events_aggregate on public.domain_events (aggregate_type, aggregate_id) where aggregate_id is not null;
create index if not exists idx_domain_events_profile on public.domain_events (profile_id, created_at desc) where profile_id is not null;

alter table public.domain_events enable row level security;

-- Internal telemetry: coaches read their company's stream for the intelligence surfaces; nobody else.
-- All writes go through the service client in server code (no insert policy on purpose), so a direct
-- subscriber read is zero rows and a direct write is denied.
drop policy if exists domain_events_coach_read on public.domain_events;
create policy domain_events_coach_read on public.domain_events for select
  using (company_id = public.current_company_id() and public.is_coach());
