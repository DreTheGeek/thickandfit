-- 0041 PHASE 2: Mid-ticket coaching workflow (PRD-30). The "last-eyes" gate.
--
-- Two tables: coaching_assignments (an assistant_coach is assigned mid-ticket clients, each carrying
-- the monthly rate the assistant is paid, tracking only, no payment execution) + approval_queue (a
-- draft an assistant submits that NOTHING publishes until a coach/operator approves).
--
-- THE SECURITY MODEL (read before touching this file):
--   public.is_coach() (0018) returns TRUE for assistant_coach, and the whole coach app reads/writes
--   through the service client which BYPASSES RLS. So RLS CANNOT be the gate that stops an assistant
--   from approving their own draft. The gate is enforced in the server action layer (requireApprover,
--   coach/operator only). What this migration contributes to defense-in-depth:
--     1. is_approver() SQL helper: like is_coach() but EXCLUDES assistant_coach (coach/operator only).
--     2. approval_queue has NO client UPDATE/DELETE policy at all. The only approved/rejected transition
--        runs under the service role inside decide(), exactly the craneop employee_invitations idiom
--        ("UPDATE has no client policy; the transition runs under supabaseAdmin").
--     3. The insert policy forces status='pending' via WITH CHECK, so a draft can never be born approved.
--   Even a hand-crafted PostgREST call from an assistant's JWT cannot set status='approved'.
--
-- ID-SPACE NOTE: coaching_assignments.client_id + approval_queue.client_id reference profiles(id) (the
-- app subscriber). meal_plans.contact_id references contacts(id) (a CRM contact). They are DIFFERENT id
-- spaces. The meal-plan publish target is carried in approval_queue.payload.contactId, NOT client_id.
--
-- Conventions: company_id NOT NULL + RLS + created_at/updated_at; money is bigint _cents; set_updated_at
-- trigger (0001) + audit_trigger_func (0001) on both tables (CLAUDE.md Anti-Get-Sued: audit destructive
-- transitions). 0039 (WP11) and 0040 (WP3) are taken, so this is 0041.

-- ---------------------------------------------------------------------------------------------
-- is_approver(): the approval/assignment authority. Mirrors is_coach() (0018:11) but EXCLUDES
-- assistant_coach. Reads the same user_role JWT claim injected by the access-token hook (0004:25).
-- This is the SQL-side reflection of requireApprover(); the action layer is the real enforcement.
-- ---------------------------------------------------------------------------------------------
create or replace function public.is_approver()
returns boolean language sql stable as $$
  select coalesce((auth.jwt() ->> 'user_role'), '') in ('coach', 'operator');
$$;

-- ---------------------------------------------------------------------------------------------
-- Table A: coaching_assignments. assistant_coach <-> client (both profiles) + monthly payout rate.
-- An assistant sees ONLY their own assignment rows; coach/operator see all in the tenant. Writes are
-- approver-only (is_approver), re-enforced at the action layer.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.coaching_assignments (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies(id) on delete cascade,
  assistant_id       uuid not null references public.profiles(id) on delete cascade,
  client_id          uuid not null references public.profiles(id) on delete cascade,
  monthly_rate_cents bigint not null default 0,         -- $25/mo assumption = 2500; rate is a column
  status             text not null default 'active' check (status in ('active', 'paused', 'ended')),
  assigned_by        uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (company_id, assistant_id, client_id)          -- one assignment per assistant<->client pair
);
create index if not exists idx_assignments_assistant
  on public.coaching_assignments (company_id, assistant_id) where status = 'active';
create index if not exists idx_assignments_client
  on public.coaching_assignments (company_id, client_id);

alter table public.coaching_assignments enable row level security;
-- Read: assistant sees own rows; approver (coach/operator) sees all. is_coach() includes assistant, so
-- we must NARROW assistants to their own rows explicitly (assistant_id = auth.uid()).
drop policy if exists assignments_read on public.coaching_assignments;
create policy assignments_read on public.coaching_assignments for select
  using (
    company_id = public.current_company_id()
    and (assistant_id = auth.uid() or public.is_approver())
  );
-- Write (insert/update/delete): approver only. The coach app uses the service client which bypasses
-- this, so the action layer (requireApprover) is the real gate; this blocks any direct assistant JWT.
drop policy if exists assignments_write on public.coaching_assignments;
create policy assignments_write on public.coaching_assignments for all
  using (company_id = public.current_company_id() and public.is_approver())
  with check (company_id = public.current_company_id() and public.is_approver());

create trigger set_assignments_updated_at before update on public.coaching_assignments
  for each row execute function public.set_updated_at();
create trigger audit_assignments after insert or update or delete on public.coaching_assignments
  for each row execute function public.audit_trigger_func();

-- ---------------------------------------------------------------------------------------------
-- Table B: approval_queue. The last-eyes gate. An assistant inserts a 'pending' draft; an approver
-- flips it to approved/rejected ONLY via the service role inside decide(). The PUBLISH (writing the
-- real messages / meal_plans row) happens ONLY in that action, never on insert, never by an assistant.
-- payload carries the full draft; for meal_plan drafts payload.contactId is the contacts(id) target.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.approval_queue (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  item_type     text not null check (item_type in ('message', 'meal_plan')),  -- 'program' is forward-compat
  client_id     uuid not null references public.profiles(id) on delete cascade, -- whose client (profile)
  item_ref      uuid,                                  -- optional resolved target id (set on publish)
  drafted_by    uuid not null references public.profiles(id) on delete cascade,
  payload       jsonb not null default '{}'::jsonb,    -- full draft content (+ contactId for meal_plan)
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_by   uuid references public.profiles(id) on delete set null,
  approved_at   timestamptz,
  decision_note text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_queue_pending
  on public.approval_queue (company_id, created_at desc) where status = 'pending';
create index if not exists idx_queue_drafter
  on public.approval_queue (company_id, drafted_by, status);

alter table public.approval_queue enable row level security;
-- Read: drafter sees own rows; approver sees all in the tenant.
drop policy if exists queue_read on public.approval_queue;
create policy queue_read on public.approval_queue for select
  using (
    company_id = public.current_company_id()
    and (drafted_by = auth.uid() or public.is_approver())
  );
-- Insert: any coach role may draft, but ONLY as themselves and ALWAYS status='pending'. This forces a
-- draft to be born pending (defense-in-depth: an assistant cannot insert a pre-approved row).
drop policy if exists queue_insert on public.approval_queue;
create policy queue_insert on public.approval_queue for insert
  with check (
    company_id = public.current_company_id()
    and public.is_coach()                  -- assistant / coach / operator may DRAFT
    and drafted_by = auth.uid()
    and status = 'pending'
  );
-- NO client UPDATE / DELETE policy by design. The only approved/rejected transition runs under the
-- service role inside decide() (guarded by requireApprover). Mirrors craneop employee_invitations:
-- a hand-crafted PostgREST call from an assistant's JWT cannot set status='approved'.

create trigger set_queue_updated_at before update on public.approval_queue
  for each row execute function public.set_updated_at();
create trigger audit_queue after insert or update or delete on public.approval_queue
  for each row execute function public.audit_trigger_func();
