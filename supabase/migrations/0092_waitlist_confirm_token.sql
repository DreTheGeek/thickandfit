-- 0092: waitlist double-opt-in confirmation token.
--
-- kb-funnels doctrine: confirmations gate DELIVERABILITY (drip suppression for unconfirmed), never
-- the thank-you page. Doctrine 1 is not violated — a fresh signup still lands on /join/thanks with
-- position + share link visible instantly. Confirmed vs unconfirmed only decides whether GHL bulk
-- sends fire (audience filter: confirmed_at IS NOT NULL) and Gmail's promo classifier is unlikely
-- to hard-spam once a positive-signal confirm click is on the recipient's side.
--
-- Same pgcrypto pattern as referral_code (0090): 12-hex-char default, applied per-row on INSERT.
-- Per-row default expression means every new lead gets a fresh token; unique index blocks reuse.

alter table public.waitlist_leads
  add column if not exists confirm_token text;

-- Backfill existing leads with their own tokens (single expression per row via generate_series
-- would give them all the same value and blow the unique index; use the per-row UPDATE trick).
update public.waitlist_leads
   set confirm_token = lower(encode(gen_random_bytes(12), 'hex'))
 where confirm_token is null;

alter table public.waitlist_leads
  alter column confirm_token set default lower(encode(gen_random_bytes(12), 'hex')),
  alter column confirm_token set not null;

-- Per-tenant unique. A collision at insert time is a retry-on-conflict for the caller.
create unique index if not exists idx_waitlist_confirm_token
  on public.waitlist_leads(company_id, confirm_token);

comment on column public.waitlist_leads.confirm_token
  is 'Per-tenant 24-hex-char single-use confirm token. Forms /api/funnel/confirm?t=<token>. Rotated after use is optional; today it stays stable so a resent confirmation email still resolves.';
