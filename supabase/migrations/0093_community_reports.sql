-- 0093: community moderation queue.
--
-- Launch-day risk this closes: one bad post with no operator queue means it stays up until
-- Stephanie happens to scroll past it. A member-facing Report button writes here; the operator
-- works the queue at /admin/community/reports.
--
-- Design notes:
--   * company_id NOT NULL + RLS on, same shape as every other table (0001 convention).
--   * reporter_profile_id is nullable ON DELETE SET NULL: if a reporter deletes their account we
--     keep the report (the moderation decision and its evidence must survive the reporter).
--   * post_id CASCADEs: once the post is gone the report has no subject, so it goes too.
--   * reported_profile_id is denormalized from the post's author at insert time so a report still
--     names who was reported even after the post row is deleted by a different path.
--   * unique (company_id, post_id, reporter_profile_id) makes "report" idempotent per reporter,
--     so a double-tap does not inflate the queue.

create table if not exists public.community_reports (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies(id) on delete cascade,
  post_id              uuid not null references public.community_posts(id) on delete cascade,
  reporter_profile_id  uuid references public.profiles(id) on delete set null,
  reported_profile_id  uuid references public.profiles(id) on delete set null,
  reason               text not null check (reason in ('spam', 'harassment', 'self_harm', 'nudity', 'misinformation', 'other')),
  note                 text,
  status               text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  resolution_note      text,
  resolved_by          uuid references public.profiles(id) on delete set null,
  resolved_at          timestamptz,
  created_at           timestamptz not null default now()
);

-- One report per reporter per post.
create unique index if not exists idx_community_reports_dedupe
  on public.community_reports (company_id, post_id, reporter_profile_id);

-- The queue read: open reports for this tenant, newest first.
create index if not exists idx_community_reports_queue
  on public.community_reports (company_id, status, created_at desc);

alter table public.community_reports enable row level security;

-- A member may file a report (insert) for their own tenant and read only their own filings.
-- Operators/coaches read and resolve everything in their tenant; all resolution writes flow
-- through the service client in community-mod-actions.ts, which re-checks requireOperator.
drop policy if exists community_reports_insert_own on public.community_reports;
create policy community_reports_insert_own on public.community_reports for insert
  with check (company_id = public.current_company_id() and reporter_profile_id = auth.uid());

drop policy if exists community_reports_read on public.community_reports;
create policy community_reports_read on public.community_reports for select
  using (
    company_id = public.current_company_id()
    and (reporter_profile_id = auth.uid() or public.is_coach())
  );

comment on table public.community_reports
  is 'Member-filed reports on community posts. Operator works the queue at /admin/community/reports; status open -> dismissed|actioned.';
comment on column public.community_reports.reported_profile_id
  is 'Denormalized post author at report time so the report still names the reported member if the post row is later deleted.';

------------------------------------------------------------------------------
-- Mute (reversible) for a member who keeps breaking the community rules.
------------------------------------------------------------------------------
-- Deliberately a timestamp, not a boolean: a mute always expires on its own, so an operator can
-- act decisively without permanently removing a paying member's access. A hard ban stays a
-- deliberate, separate decision (Team page disable / account removal), never one click deep in a
-- moderation queue. The community post path must check this before accepting a write.
alter table public.profiles
  add column if not exists community_muted_until timestamptz;

comment on column public.profiles.community_muted_until
  is 'When set and in the future, the member cannot post or comment in the community. Expires on its own; set by admin.mute_member.';
