-- Launch-blocker fixes found by live-DB probing (2026-07-21 auth+billing verification).
--
-- 1) payments.stripe_invoice_id: the app upserts with ON CONFLICT (stripe_invoice_id), but the
--    live unique index was PARTIAL (WHERE stripe_invoice_id IS NOT NULL). Postgres cannot infer a
--    partial index from a bare column-list arbiter, so EVERY invoice upsert failed with 42P10 and
--    (because the caller discarded the error) the payment row was silently lost: empty payment
--    history, refunds and disputes never matching. A FULL unique index keeps the same semantics
--    (NULLS DISTINCT: unlimited NULL rows) and is inferable by ON CONFLICT.
--
-- 2) subscriptions.stripe_customer_id was UNIQUE: cancel -> resubscribe creates a second
--    subscription row for the same customer (new stripe_subscription_id), which violated the
--    index (23505), 500'd the webhook forever, and left a paying member unentitled. A customer
--    legitimately holds a HISTORY of subscriptions; keep a plain index for lookups.
--
-- 3) foods (source, source_id): same partial-index/ON CONFLICT bug class as (1), used by the
--    external-foods cache upserts.
--
-- 4) coach_notes.author_id was NOT NULL with a NO ACTION FK to profiles: any coach who ever wrote
--    a note could never delete their account (auth.users delete cascades to profiles, which this
--    FK blocked). Notes survive with author_id NULL ("former coach").
--
-- payments and subscriptions are empty and foods has no (source, source_id) duplicates among
-- non-null source_id rows (verified live before writing this), so the rebuilds cannot fail.

-- 1) payments invoice upsert arbiter
drop index if exists public.idx_payments_invoice;
create unique index idx_payments_invoice on public.payments (stripe_invoice_id);

-- 2) allow subscription history per customer
drop index if exists public.idx_subscriptions_customer;
create index idx_subscriptions_customer on public.subscriptions (stripe_customer_id);

-- 3) foods external-source cache upsert arbiter
drop index if exists public.uq_foods_source_id;
create unique index uq_foods_source_id on public.foods (source, source_id);

-- 4) coach account deletion must not be blocked by authored notes
alter table public.coach_notes alter column author_id drop not null;
alter table public.coach_notes drop constraint coach_notes_author_id_fkey;
alter table public.coach_notes
  add constraint coach_notes_author_id_fkey
  foreign key (author_id) references public.profiles(id) on delete set null;
