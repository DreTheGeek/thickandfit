-- Somewhere to put the 830 files the August sweep pulled off Lenus.
--
-- contact_files.url is a full PUBLIC Cloudflare R2 link and the Files tab renders it raw, unsigned,
-- because R2 is public and durable. The sweep's files went to a PRIVATE Supabase bucket, so a raw
-- URL there resolves to nothing. They need a path plus server-side signing, which is the same
-- pattern progress-photos and exercise demos already use.
--
-- The 3,522 existing R2 rows are untouched: they work, and rewriting them would be churn with a
-- migration's risk and none of its benefit.
--
-- RECEIPTS GO ON THE TRANSACTION, NOT IN THE FILES TAB. contact_files already holds 610 rows
-- categorised billing_docs from the July export. Adding 716 more receipts beside them would double
-- that list with the same documents under a second URL scheme, and bury her actual client documents
-- under a wall of PDFs. A receipt belongs to a payment, so it hangs off contact_transactions, where
-- the row it evidences already is.

alter table public.contact_files
  add column if not exists storage_path text,
  add column if not exists bucket text;

-- Natural key for the imported rows. url stays the key for the R2 rows via the existing
-- unique (contact_id, url); this covers the ones that have a path instead.
create unique index if not exists idx_contact_files_storage_path
  on public.contact_files (company_id, storage_path)
  where storage_path is not null;

comment on column public.contact_files.storage_path is
  'Object path inside a PRIVATE Supabase bucket, for files migrated by the August 2026 sweep. Readers mint a signed URL server-side. Mutually exclusive in practice with url, which is a public R2 link from the earlier export.';
comment on column public.contact_files.bucket is
  'Which private bucket storage_path lives in. Null for the older public-R2 rows.';

alter table public.contact_transactions
  add column if not exists receipt_storage_path text;

comment on column public.contact_transactions.receipt_storage_path is
  'The receipt PDF for this payment, in the private lenus-billing-docs bucket. 716 were recovered before the Lenus account closed; the amounts live on this row regardless, so this is document retention rather than data.';
