-- 0026 PHASE 2: Community (beat the dead Lenus/Alive communities).
-- A live subscriber feed: posts, emoji reactions, comments, plus coach broadcasts and time-boxed
-- challenges with a participant leaderboard. Everything is company-scoped: members read their
-- tenant's content, authors write their own. RLS on every table, no exceptions.

-- ---------------------------------------------------------------------------------------------
-- community_posts: the feed. is_broadcast = coach announcement pinned to the top of the feed.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  author_profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  media_url text,
  is_broadcast boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_community_posts_feed on public.community_posts (company_id, created_at desc);
create index if not exists idx_community_posts_author on public.community_posts (author_profile_id);

alter table public.community_posts enable row level security;

drop policy if exists community_posts_read on public.community_posts;
create policy community_posts_read on public.community_posts for select
  using (company_id = public.current_company_id());

-- Members post as themselves in their own company. Only coaches may flag a post as a broadcast.
drop policy if exists community_posts_insert on public.community_posts;
create policy community_posts_insert on public.community_posts for insert
  with check (
    company_id = public.current_company_id()
    and author_profile_id = auth.uid()
    and (is_broadcast = false or public.is_coach())
  );

drop policy if exists community_posts_update on public.community_posts;
create policy community_posts_update on public.community_posts for update
  using (author_profile_id = auth.uid() or public.is_coach())
  with check (company_id = public.current_company_id());

drop policy if exists community_posts_delete on public.community_posts;
create policy community_posts_delete on public.community_posts for delete
  using (author_profile_id = auth.uid() or public.is_coach());

-- ---------------------------------------------------------------------------------------------
-- post_reactions: one emoji per member per post (toggle). company_id denormalized for fast scope.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (post_id, profile_id, emoji)
);
create index if not exists idx_post_reactions_post on public.post_reactions (post_id);

alter table public.post_reactions enable row level security;

drop policy if exists post_reactions_read on public.post_reactions;
create policy post_reactions_read on public.post_reactions for select
  using (company_id = public.current_company_id());

drop policy if exists post_reactions_insert on public.post_reactions;
create policy post_reactions_insert on public.post_reactions for insert
  with check (company_id = public.current_company_id() and profile_id = auth.uid());

drop policy if exists post_reactions_delete on public.post_reactions;
create policy post_reactions_delete on public.post_reactions for delete
  using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- post_comments: threaded replies under a post.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_post_comments_post on public.post_comments (post_id, created_at);

alter table public.post_comments enable row level security;

drop policy if exists post_comments_read on public.post_comments;
create policy post_comments_read on public.post_comments for select
  using (company_id = public.current_company_id());

drop policy if exists post_comments_insert on public.post_comments;
create policy post_comments_insert on public.post_comments for insert
  with check (company_id = public.current_company_id() and profile_id = auth.uid());

drop policy if exists post_comments_delete on public.post_comments;
create policy post_comments_delete on public.post_comments for delete
  using (profile_id = auth.uid() or public.is_coach());

-- ---------------------------------------------------------------------------------------------
-- challenges: time-boxed group goals (e.g. "10k steps for 14 days"). Coaches author them.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  metric text not null default 'workouts',   -- workouts | steps | logs | custom
  metric_unit text,                          -- display unit, e.g. "workouts", "steps"
  goal numeric,                              -- optional target for a full progress bar
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_challenges_company on public.challenges (company_id, ends_on desc);

alter table public.challenges enable row level security;

drop policy if exists challenges_read on public.challenges;
create policy challenges_read on public.challenges for select
  using (company_id = public.current_company_id());

drop policy if exists challenges_write on public.challenges;
create policy challenges_write on public.challenges for all
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

-- ---------------------------------------------------------------------------------------------
-- challenge_participants: a member's standing in a challenge. progress drives the leaderboard.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.challenge_participants (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null,
  progress numeric not null default 0,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (challenge_id, profile_id)
);
create index if not exists idx_challenge_participants_board on public.challenge_participants (challenge_id, progress desc);

alter table public.challenge_participants enable row level security;

drop policy if exists challenge_participants_read on public.challenge_participants;
create policy challenge_participants_read on public.challenge_participants for select
  using (company_id = public.current_company_id());

drop policy if exists challenge_participants_insert on public.challenge_participants;
create policy challenge_participants_insert on public.challenge_participants for insert
  with check (company_id = public.current_company_id() and profile_id = auth.uid());

drop policy if exists challenge_participants_update on public.challenge_participants;
create policy challenge_participants_update on public.challenge_participants for update
  using (profile_id = auth.uid() or public.is_coach())
  with check (company_id = public.current_company_id());

drop policy if exists challenge_participants_delete on public.challenge_participants;
create policy challenge_participants_delete on public.challenge_participants for delete
  using (profile_id = auth.uid() or public.is_coach());
