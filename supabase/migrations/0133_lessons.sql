-- Her content library. Twenty-four lessons that exist nowhere but Lenus and a laptop.
--
-- WHAT EXISTED: nothing. No table, no column, no reference. The August sweep found 24 lessons on
-- her Lenus account carrying 19 videos and 15 documents: a nine-cell meal-plan matrix (1600/1800/
-- 2000 kcal x beef-poultry/pescatarian/vegetarian, each a video plus a PDF), the 2-week
-- anti-inflammatory protocol, Nutrition Guide, Fast food guide, Supplement recommendations, How to
-- do measurements, Discipline vs motivation, Fat loss vs Weight loss, and the app walkthrough she
-- sends every new client. 1,757 records say who received which one. Her account closes 31 August.
--
-- This is years of her work and the single most irreplaceable thing in the migration.
--
-- MODELLED ON 0120_protocols.sql, not invented. Protocols is the only existing table for
-- coach-authored, published, bilingual, ordered content that gets sent to a named client on a date
-- with a lifecycle, and every problem here is one it already solved: slug + unique(company_id,
-- slug), is_published, sort_order, es_status as a serve-gate, and an assignment row carrying the
-- locale it was sent in.
--
-- WHY NOT recipes/protocols/coach_knowledge:
--   recipes        models a dish with ingredients and macros. A lesson is a video and a PDF.
--   protocols      models ONE fixed eating protocol with rules, meals and a grocery list.
--   coach_knowledge is the AI grounding store: chunked text and embeddings, no delivery, no order,
--                  no assets. The lesson TEXT should also land there, but that is retrieval, not
--                  a library.
--
-- ASSETS ARE ROWS, NOT COLUMNS. A lesson has one video and one PDF today, but the nine meal-plan
-- lessons already prove she pairs them, and "Nutrition Guide & supplement recommendations" is one
-- lesson with two documents. A video_path/pdf_path pair would need a migration the first time she
-- adds a second handout.
--
-- BILINGUAL FROM THE START, English-only in practice. Every member-visible string has _en and _es.
-- Her content is English, so _es ships null and es_status ships 'missing'. A member-facing reader
-- must serve Spanish only at 'approved', the rule 0120 established and src/lib/protocols/actions.ts
-- enforces: a draft translation is not her voice.

-- ---------------------------------------------------------------------------------------------
-- 1. The lessons themselves.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.lessons (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  -- The Lenus lesson id. The import's idempotency key, and the join back to lesson_sends.
  lenus_id      text,
  slug          text not null,
  title_en      text not null,
  title_es      text,
  -- Her lesson body arrives as HTML from Lenus (<p> tags), not markdown or plain text. Stored as
  -- authored; renderers sanitise. Seven of the 24 have no body at all: the video IS the lesson.
  body_html_en  text,
  body_html_es  text,
  -- Free text, normalised on import. Hers arrive dirty: "Nutrition" 12, "Nutrition " 2 (trailing
  -- space), "" 7, "App tour " 1, "Workout essentials" 1, "Workout tips" 1.
  category      text,
  es_status     text not null default 'missing',
  is_published  boolean not null default false,
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, slug),
  constraint lessons_es_status_valid check (es_status in ('missing', 'draft', 'approved'))
);
alter table public.lessons enable row level security;
create index if not exists idx_lessons_company on public.lessons(company_id, sort_order);
create unique index if not exists idx_lessons_lenus_id
  on public.lessons (company_id, lenus_id) where lenus_id is not null;
drop policy if exists lessons_tenant on public.lessons;
create policy lessons_tenant on public.lessons
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());
drop trigger if exists set_lessons_updated_at on public.lessons;
create trigger set_lessons_updated_at before update on public.lessons
  for each row execute function public.set_updated_at();

comment on table public.lessons is
  'Her educational content library, recovered from Lenus 2026-08-12. A lesson is a short piece of teaching she sends a client: a video, a document, or both, with an optional written note.';
comment on column public.lessons.body_html_en is
  'Authored HTML as it came from Lenus. Seven of her 24 lessons have none: the video is the lesson.';
comment on column public.lessons.es_status is
  'missing = no Spanish yet. draft = translated but NOT approved by her; member-facing readers must not serve it. approved = she signed off.';
comment on column public.lessons.is_published is
  'Coach library visibility is separate from this. Ships false for every imported row so nothing reaches a member before she has seen her own content in this app.';

-- ---------------------------------------------------------------------------------------------
-- 2. Assets. One row per file, ordered, so a lesson can carry any number of them.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.lesson_assets (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  lesson_id        uuid not null references public.lessons(id) on delete cascade,
  lenus_id         text,
  kind             text not null,
  -- Object path inside the PRIVATE lenus-coach-media bucket, never a URL. Same rule as
  -- exercises.demo_storage_path (0122): readers mint a short-lived signed URL server-side, so
  -- nothing durable holds a link that outlives its signature.
  storage_path     text not null,
  mime_type        text,
  -- Poster frame for a video. Lenus generates one per upload; without it a video is a black box
  -- until it plays.
  poster_path      text,
  duration_seconds integer,
  bytes            bigint,
  sort_order       smallint not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (company_id, storage_path),
  constraint lesson_assets_kind_valid check (kind in ('video', 'document', 'cover'))
);
alter table public.lesson_assets enable row level security;
create index if not exists idx_lesson_assets_lesson on public.lesson_assets(lesson_id, sort_order);
drop policy if exists lesson_assets_tenant on public.lesson_assets;
create policy lesson_assets_tenant on public.lesson_assets
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());
drop trigger if exists set_lesson_assets_updated_at on public.lesson_assets;
create trigger set_lesson_assets_updated_at before update on public.lesson_assets
  for each row execute function public.set_updated_at();

comment on column public.lesson_assets.storage_path is
  'Path inside the private lenus-coach-media bucket. Set only after the object is confirmed uploaded; null is not allowed, so a row here means the bytes exist.';

-- ---------------------------------------------------------------------------------------------
-- 3. Content plans: her drip sequences. Lenus calls these content plans and schedules them by
--    days-since-start. Captured for 171 of 272 clients, so the sequence survives rather than
--    flattening into an unordered bag of lessons.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.lesson_plans (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  lenus_id    text,
  name_en     text not null,
  name_es     text,
  is_active   boolean not null default true,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.lesson_plans enable row level security;
create unique index if not exists idx_lesson_plans_lenus_id
  on public.lesson_plans (company_id, lenus_id) where lenus_id is not null;
drop policy if exists lesson_plans_tenant on public.lesson_plans;
create policy lesson_plans_tenant on public.lesson_plans
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());
drop trigger if exists set_lesson_plans_updated_at on public.lesson_plans;
create trigger set_lesson_plans_updated_at before update on public.lesson_plans
  for each row execute function public.set_updated_at();

create table if not exists public.lesson_plan_items (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  lesson_plan_id uuid not null references public.lesson_plans(id) on delete cascade,
  lesson_id      uuid not null references public.lessons(id) on delete cascade,
  -- Days after the client starts the product, which is how Lenus schedules a flow.
  day_offset     smallint,
  sort_order     smallint not null default 0,
  created_at     timestamptz not null default now(),
  unique (lesson_plan_id, lesson_id)
);
alter table public.lesson_plan_items enable row level security;
drop policy if exists lesson_plan_items_tenant on public.lesson_plan_items;
create policy lesson_plan_items_tenant on public.lesson_plan_items
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

comment on table public.lesson_plans is
  'Her drip sequences: "Thick & Fit 6 week body recomp challenge", "HER again challenge", "Default flow".';

-- ---------------------------------------------------------------------------------------------
-- 4. Sends. A LOG of what she already delivered on Lenus, not a queue of what to deliver here.
--
-- 1,757 of these import as history so her client records are complete. NOTHING in this app reads
-- them and sends anything: no email, no push, no notification row. Re-delivering content people
-- received months ago would be the single most damaging thing this migration could do.
--
-- Shape follows protocol_assignments (0120): contact_id NOT NULL because only a handful of these
-- clients have claimed an app account, profile_id nullable for when they do, and the locale it was
-- sent in snapshotted rather than inferred later.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.lesson_sends (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  lesson_id   uuid not null references public.lessons(id) on delete cascade,
  contact_id  uuid not null references public.contacts(id) on delete cascade,
  profile_id  uuid references public.profiles(id) on delete set null,
  lenus_id    text,
  locale      text not null default 'en',
  state       text not null default 'sent',
  sent_at     timestamptz,
  source      text not null default 'lenus',
  created_at  timestamptz not null default now(),
  constraint lesson_sends_locale_valid check (locale in ('en', 'es')),
  constraint lesson_sends_state_valid check (state in ('sent', 'received', 'opened', 'cancelled'))
);
alter table public.lesson_sends enable row level security;
create index if not exists idx_lesson_sends_contact on public.lesson_sends(company_id, contact_id, sent_at desc);
create index if not exists idx_lesson_sends_lesson on public.lesson_sends(company_id, lesson_id);
create unique index if not exists idx_lesson_sends_lenus_id
  on public.lesson_sends (company_id, lenus_id) where lenus_id is not null;
drop policy if exists lesson_sends_tenant on public.lesson_sends;
create policy lesson_sends_tenant on public.lesson_sends
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

comment on table public.lesson_sends is
  'A record of lessons ALREADY delivered on Lenus. History, never a delivery queue: nothing in this app reads these rows and sends anything.';
comment on column public.lesson_sends.locale is
  'The language it was sent in, snapshotted at send time rather than inferred from the member''s current setting later.';
