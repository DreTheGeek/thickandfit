-- 0046 PHASE 2 — Finalize ended challenges. The close-challenges cron (/api/internal/close-challenges)
-- needs an idempotent "already finalized" marker so it processes each ended challenge exactly once:
-- award the winner badge + notify participants once, never again on the next nightly pass. Without this
-- a challenge whose ends_on has passed just silently stops being "active" with no winner, no badge, no
-- notification. Adds challenges.finalized_at and seeds the Challenge Champion badge the winner earns.

alter table public.challenges add column if not exists finalized_at timestamptz;

comment on column public.challenges.finalized_at is
  'Set by the close-challenges cron when a challenge past its ends_on has been finalized (winner badge '
  'awarded + participants notified). NULL = not yet finalized. Makes finalization idempotent.';

-- Partial index for the cron selection (challenges that ended but are not yet finalized).
create index if not exists idx_challenges_unfinalized
  on public.challenges (ends_on)
  where finalized_at is null;

-- The badge a challenge winner earns. kind='challenge' groups it apart from streak/workout badges.
-- Idempotent: badges.key is UNIQUE, so re-applying this migration is a no-op.
insert into public.badges (key, name_en, name_es, description_en, description_es, icon, threshold, kind, sort_order)
values (
  'challenge_champion',
  'Challenge Champion',
  'Campeón del Reto',
  'Finished #1 on a community challenge leaderboard.',
  'Terminaste #1 en la tabla de un reto de la comunidad.',
  '🏆',
  1,
  'challenge',
  40
)
on conflict (key) do nothing;
