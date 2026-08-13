-- A natural key on contact_transactions, so the Lenus billing re-sync cannot duplicate revenue.
--
-- The table already holds 1,539 rows imported from a Lenus CSV export whose lenus_txn_id is a
-- sequential integer ("1", "2", "3"). The August sweep pulled 863 payment INSTALLMENTS from the
-- GraphQL API, whose ids are uuids. Two id spaces for the same money: zero overlap by id, and 553
-- of the 726 settled installments are rows the CSV already has under a different id.
--
-- Without a key here, re-running the importer duplicates every row it wrote. With only this key,
-- the first run still double-counts the 553 the CSV already covers. The importer therefore does
-- BOTH: this index makes re-runs safe, and a (contact, day, amount) existence check keeps the first
-- run from inventing revenue that already exists under an integer id.
--
-- Partial on lenus_txn_id is not null, because a row created by any future native path has no
-- Lenus id and must not collide with another one.

create unique index if not exists idx_contact_transactions_lenus_txn
  on public.contact_transactions (company_id, lenus_txn_id)
  where lenus_txn_id is not null;

-- The dedupe check runs per candidate row, so it needs to be an index seek rather than a scan of
-- 1,539 rows times 726 candidates.
create index if not exists idx_contact_transactions_natural
  on public.contact_transactions (company_id, contact_id, occurred_at, gross_cents);

comment on index public.idx_contact_transactions_lenus_txn is
  'Re-run key for the Lenus billing import. NOT sufficient on its own: the CSV export and the GraphQL export use different id spaces for the same payments, so the importer also checks (contact, day, amount).';
