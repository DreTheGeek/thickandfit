-- 0029 PHASE 2: make user_insights idempotent per (profile_id, generated_at).
-- The nightly insight engine (api/internal/generate-insights) upserts one snapshot per subscriber
-- per day. Without a unique key, re-running the cron (retry, manual trigger) would stack duplicate
-- rows for the same day. This adds the natural key the upsert conflicts on so a day's insight is
-- replaced in place, not duplicated. company_id is unchanged (a profile belongs to one company).

-- Collapse any pre-existing duplicates to the newest row per (profile_id, generated_at) first,
-- so the unique index can be created without error.
delete from public.user_insights ui
using public.user_insights newer
where ui.profile_id = newer.profile_id
  and ui.generated_at = newer.generated_at
  and ui.created_at < newer.created_at;

create unique index if not exists uq_user_insights_profile_day
  on public.user_insights (profile_id, generated_at);
