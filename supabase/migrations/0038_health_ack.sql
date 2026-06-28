-- 0038 PHASE 2 — Health disclaimer acknowledgment (anti-get-sued).
-- A fitness/nutrition app must capture an assumption-of-risk acknowledgment before a client trains.
-- One timestamp on the profile: set when the client accepts the disclaimer; the entitlement guard
-- routes un-acknowledged clients to /disclaimer. NULL = not yet acknowledged.

alter table public.profiles
  add column if not exists health_ack_at timestamptz;

comment on column public.profiles.health_ack_at is
  'When the client accepted the health / assumption-of-risk disclaimer. NULL = not yet accepted; '
  'the app gate routes them to /disclaimer before any training content.';
