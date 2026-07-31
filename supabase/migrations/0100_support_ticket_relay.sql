-- Support ticket relay: a human-readable ticket number, PII state, and the media a reporter attaches.
--
-- Driven by the reference implementation Dre wants matched: a Telegram alert on every new ticket, and
-- a detail view showing the AI summary, the original description behind a PII warning, the
-- attachment, and a video link.

-- Human handle. Rendered as TKT-00000006 in the app; stored as an integer so it sorts and indexes.
--
-- A single global sequence rather than a per-company counter. Per-company numbering needs a lock or
-- an advisory counter on every insert, and the only thing a global sequence leaks is total ticket
-- volume across tenants. With one live tenant that is nothing; revisit if white-label ships, since a
-- second tenant could then infer the first one's support load from its own ticket numbers.
create sequence if not exists public.support_ticket_number_seq as bigint start 1;

alter table public.support_tickets
  add column if not exists ticket_number bigint not null default nextval('public.support_ticket_number_seq'),
  -- PII state, computed at intake by src/lib/support/pii.ts.
  --
  -- pii_kinds stores CATEGORIES ('ssn','card','dob'), never the matched values. The whole point is
  -- that the sensitive string exists in exactly one column (body) and nowhere else, so a column that
  -- copied it "for reference" would defeat the design.
  add column if not exists pii_flagged boolean not null default false,
  add column if not exists pii_kinds text[] not null default '{}',
  -- The body with every match replaced by a labelled token. This is what any outbound surface
  -- (Telegram, GitHub, email) is allowed to quote. `body` stays untouched and never leaves the app.
  add column if not exists redacted_body text,
  -- Media the reporter attached.
  add column if not exists attachment_url text,
  add column if not exists video_url text,
  -- Who reported it. Distinct from `email`, which is the account we matched: a coach can file on
  -- behalf of a member, and support needs to reach the PERSON who typed the words.
  add column if not exists rep_name text,
  add column if not exists rep_phone text,
  add column if not exists company_name text,
  -- Set once the Telegram relay confirms delivery, so a retry sweep can find what never went out and
  -- an operator can tell "nobody was told" from "told, ignored".
  add column if not exists notified_at timestamptz;

create unique index if not exists support_tickets_number_uidx
  on public.support_tickets (ticket_number);

-- Unsent alerts, for a retry sweep. Partial so it stays tiny.
create index if not exists support_tickets_unnotified_idx
  on public.support_tickets (created_at)
  where notified_at is null;

comment on column public.support_tickets.body is
  'The ORIGINAL reported text. May contain PII. This column must never be forwarded to Telegram, GitHub, or email: use redacted_body or the triage summary.';
comment on column public.support_tickets.pii_kinds is
  'Categories of PII detected (ssn, card, dob, passport, bank). Never the matched values.';
comment on column public.support_tickets.ticket_number is
  'Human handle, rendered TKT-%08d. Global sequence; revisit if white-label ships.';
