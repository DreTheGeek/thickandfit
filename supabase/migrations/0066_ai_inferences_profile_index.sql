-- 0066 -- Per-member read path on ai_inferences. The nightly scan-quality rollup reads one member's
-- photo-scan inferences for the last 30 days; the existing indexes lead on company_id and cannot
-- serve a profile-scoped scan without a full company sweep.
create index if not exists idx_ai_inferences_profile_feature
  on public.ai_inferences (profile_id, feature, created_at desc);
