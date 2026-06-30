-- 0051 PHASE 2 -- AI physique analysis. A member uploads a progress photo and gets a supportive,
-- coach's-eye body-composition read + a personalized, staged recommendation in Stephanie's voice
-- (sibling to food photo -> macros). Body-fat is stored as a RANGE (estimate, never precise), and the
-- narrative is body-positive + safety-bounded. Company-scoped; the member sees their own, the coach sees
-- their company's. The app reads/writes via the service client; RLS is the backstop.

create table if not exists public.physique_analyses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  progress_photo_id uuid references public.progress_photos(id) on delete set null,
  -- Body-fat estimate as a RANGE (low..high %). Never a single precise number.
  bf_low numeric,
  bf_high numeric,
  weight_lb numeric,                              -- the weight the member reported with the photo (context)
  assessment jsonb not null default '{}'::jsonb,  -- { strengths[], focusAreas[], compositionNotes }
  goals jsonb not null default '{}'::jsonb,        -- { staged[], timeline, approach }
  narrative text not null default '',              -- the coaching write-up, in the member's locale
  locale text not null default 'en' check (locale in ('en', 'es')),
  model text,                                      -- which model produced it (for the eval / audit)
  flagged boolean not null default false,          -- safety: model raised a concern worth a human coach's eye
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_physique_analyses_member
  on public.physique_analyses (company_id, profile_id, created_at desc)
  where deleted_at is null;

alter table public.physique_analyses enable row level security;

-- The member reads their own analyses; the coach reads their company's.
create policy physique_read on public.physique_analyses for select
  using (
    profile_id = auth.uid()
    or (company_id = public.current_company_id() and public.is_coach())
  );
-- Insert: the member analyzing their own photo, or a coach analyzing a client's.
create policy physique_insert on public.physique_analyses for insert
  with check (
    profile_id = auth.uid()
    or (company_id = public.current_company_id() and public.is_coach())
  );
