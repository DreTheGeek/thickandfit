-- 0096: member-to-member blocking.
--
-- App Store guideline 1.2 (user-generated content) requires FOUR controls when a community ships,
-- and all four are mandatory together:
--   1. content filtering        -> src/lib/community/content-filter.ts (this pass)
--   2. a report mechanism       -> community_reports (0093, shipped)
--   3. USER BLOCKING            -> this migration
--   4. published contact info   -> /support, live
-- Three of four is a rejection, so this is the missing leg rather than a nice-to-have.
--
-- Semantics: blocking is ONE-WAY and silent. The blocker stops seeing the blocked member's posts and
-- comments; the blocked member is never told, because a "you have been blocked" signal is itself a
-- harassment vector. Enforcement happens on the read path (feed.ts), not by deleting anything: the
-- blocked member's content stays visible to everyone else and stays intact for moderation evidence.

create table if not exists public.community_blocks (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id) on delete cascade,
  -- The member doing the blocking.
  blocker_profile_id  uuid not null references public.profiles(id) on delete cascade,
  -- The member being blocked.
  blocked_profile_id  uuid not null references public.profiles(id) on delete cascade,
  created_at          timestamptz not null default now(),
  -- Blocking yourself is nonsense and would hide your own posts from you.
  constraint community_blocks_not_self check (blocker_profile_id <> blocked_profile_id)
);

-- Idempotent: tapping Block twice must not create a second row.
create unique index if not exists idx_community_blocks_pair
  on public.community_blocks (company_id, blocker_profile_id, blocked_profile_id);

-- The read the feed does on every load: "who has this viewer blocked?"
create index if not exists idx_community_blocks_by_blocker
  on public.community_blocks (blocker_profile_id);

alter table public.community_blocks enable row level security;

-- A member manages only their OWN block list, and can only read their own. Nobody can enumerate who
-- has blocked THEM (that would leak the silent-block property this table depends on).
drop policy if exists community_blocks_select_own on public.community_blocks;
create policy community_blocks_select_own on public.community_blocks
  for select using (blocker_profile_id = auth.uid());

drop policy if exists community_blocks_insert_own on public.community_blocks;
create policy community_blocks_insert_own on public.community_blocks
  for insert with check (blocker_profile_id = auth.uid());

drop policy if exists community_blocks_delete_own on public.community_blocks;
create policy community_blocks_delete_own on public.community_blocks
  for delete using (blocker_profile_id = auth.uid());
