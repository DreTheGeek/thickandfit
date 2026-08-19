-- ---------------------------------------------------------------------------------------------
-- 0144: the campaign calendar, as data rather than as somebody's memory.
--
-- WHAT THIS CLOSES. .planning/OPERATOR-GAPS.md Part 3: nothing in this codebase is calendar-aware.
-- Every cron is "daily", "hourly" or "every 6h", while the business it serves is strongly seasonal —
-- January is the most profitable month of the year and December has the highest cancellation rate.
-- The December save window arrives and nothing runs.
--
-- TWO OF PART 3'S THREE ASKS ARE ALREADY CLOSED and are deliberately not rebuilt here: the
-- "hold/pause option for summer travel" is the pause feature (0140), and the "January cohort hits
-- its 90-day cliff in April, unattended" is generateLifecycleNudges, which reaches every member on
-- HER day 90 rather than approximating a cohort by the calendar.
--
-- WINDOWS ARE MONTH-DAY AND RECUR. A season is not a date, it is the same fortnight of every
-- December, and a campaign stored as an absolute date is one somebody has to remember to move —
-- which is the thing being fixed. src/lib/campaigns/season-shared.ts owns the arithmetic, including
-- the window that crosses New Year, where the obvious comparison is false on every day it should be
-- true.
--
-- THE TABLE IS EMPTY AND EVERY ROW DEFAULTS TO INACTIVE. This is the only generator in the app that
-- can address a whole cohort on one day, so it must not be able to do that by accident. Nothing
-- sends until somebody writes a campaign AND switches it on — the same shape as STARTER_PROGRAM_ID
-- and the scan auto-accept flag, and load-bearing for the same reason.
--
-- NO SEED DATA, deliberately. The obvious move is to ship a "December save" row with copy in it, and
-- that copy would be a guess at Stephanie's offers, her voice and her calendar written by someone
-- who has not seen her January numbers. An empty table with a page to write in is honest; an invented
-- campaign that goes out to 256 women in her name is not.
-- ---------------------------------------------------------------------------------------------

create table if not exists public.seasonal_campaigns (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  -- Stable, human-written, and the dedupe key. Renaming one makes it a NEW campaign that everybody
  -- receives again, which is why it is separate from the title.
  key            text not null,
  title          text not null,
  -- 'MM-DD', inclusive both ends. ends_md BEFORE starts_md means the window crosses New Year, which
  -- is legal and is the case the December campaign needs.
  starts_md      text not null,
  ends_md        text not null,
  audience       text not null default 'all',
  -- Nobody gets a "don't give up on your goals" in her first fortnight.
  min_tenure_days int not null default 14,
  title_en       text not null,
  body_en        text not null,
  title_es       text not null,
  body_es        text not null,
  -- Where the notification sends her. Must be a real in-app path.
  link           text not null default '/dashboard',
  is_active      boolean not null default false,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint seasonal_campaigns_key_per_company unique (company_id, key),
  constraint seasonal_campaigns_audience_valid check (audience in ('all', 'active', 'at_risk')),
  constraint seasonal_campaigns_tenure_sane check (min_tenure_days between 0 and 365),
  -- Format enforced at the database as well as in the resolver: a malformed window makes the
  -- resolver fail closed (sends to nobody), which is safe but silent, and a campaign that quietly
  -- never fires is the exact failure this table exists to prevent.
  constraint seasonal_campaigns_starts_md_format check (starts_md ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'),
  constraint seasonal_campaigns_ends_md_format   check (ends_md   ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'),
  -- Both languages are required. Every other member-facing string in this app exists in EN and ES,
  -- and a campaign with one filled in reaches half the roster in a language they did not choose.
  constraint seasonal_campaigns_copy_present check (
    length(trim(title_en)) > 0 and length(trim(body_en)) > 0 and
    length(trim(title_es)) > 0 and length(trim(body_es)) > 0
  )
);

alter table public.seasonal_campaigns enable row level security;

create index if not exists idx_seasonal_campaigns_active
  on public.seasonal_campaigns (company_id)
  where is_active;

-- Staff-only and tenant-scoped, in 0142's predicate shape so the boundary audit stays green.
create policy seasonal_campaigns_staff on public.seasonal_campaigns for all to authenticated
  using      (public.is_coach() and company_id = public.auth_company_id())
  with check (public.is_coach() and company_id = public.auth_company_id());

create trigger set_seasonal_campaigns_updated_at before update on public.seasonal_campaigns
  for each row execute function public.set_updated_at();

comment on table public.seasonal_campaigns is
  'Recurring date-driven campaigns. Windows are MM-DD and repeat every year; ends_md < starts_md '
  'means the window crosses New Year. Empty and inactive by default: this is the only generator '
  'that can address a whole cohort on one day.';
