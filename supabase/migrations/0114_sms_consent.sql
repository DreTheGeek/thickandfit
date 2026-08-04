-- 0114: record the SMS consent the waitlist form already discloses.
--
-- The form shows a TCPA disclosure next to the phone field (funnel.phoneConsent in the message
-- catalog). Showing it is what PERMITS a text. It is not what DEFENDS one. Until this migration the
-- lead row carried the number and nothing about the agreement, so a demand letter would have been
-- answered with "the page said so at the time, trust us". Statutory damages run $500 to $1,500 per
-- message, so the proof has to be per-lead and durable, not per-deploy and inferred from git.
--
-- Four columns on waitlist_leads rather than a table: consent is a one-to-one fact about the lead,
-- every reader that asks "can I text her" is already holding the lead row, and a join is one more
-- place for the sender to forget to look.
--
-- WHY THE TEXT IS STORED VERBATIM. The disclosure will be reworded (a Twilio 10DLC review, a new
-- message type, a lawyer). A claim is judged against the words that were on HER screen, not against
-- whatever the file says on the day someone asks. A reference to the message key would resolve to
-- today's wording and quietly rewrite history in our favour, which is worse than useless in front of
-- a regulator.
--
-- ALL FOUR ARE NULLABLE ON PURPOSE. Leads created before today exist and never saw a disclosure, and
-- backfilling them with a default timestamp would manufacture a consent nobody gave. A null here
-- means "not textable", which is the correct and honest answer for every one of them.
--
-- Tenancy and RLS: waitlist_leads is already company_id NOT NULL with RLS enabled and the
-- waitlist_tenant select policy (0003). Columns inherit both, so there is nothing to re-declare.

alter table public.waitlist_leads
  add column if not exists sms_consent_at         timestamptz,
  add column if not exists sms_consent_ip         text,
  add column if not exists sms_consent_user_agent text,
  add column if not exists sms_consent_text       text;

-- A consent record that cannot name the number it covers, or cannot quote what was disclosed, is not
-- a defence. It is an admission that we recorded something we could not substantiate. The database
-- refuses to hold one, so no future code path can write a half-record by forgetting a field.
--
-- The IP and user agent are deliberately NOT in here: a stripped proxy header or a bot with no
-- user-agent string must not cost a real member her consent record. They are corroborating detail,
-- the timestamp and the disclosed text are the substance.
alter table public.waitlist_leads drop constraint if exists waitlist_leads_sms_consent_ck;
alter table public.waitlist_leads add constraint waitlist_leads_sms_consent_ck check (
  sms_consent_at is null
  or (
    phone is not null
    and btrim(phone) <> ''
    and sms_consent_text is not null
    and btrim(sms_consent_text) <> ''
  )
);

-- The one query the SMS sender will ever run: who, in this tenant, may be texted right now.
-- Partial so it stays small while most of the list is email-only.
create index if not exists idx_waitlist_smsable
  on public.waitlist_leads (company_id)
  where sms_consent_at is not null and unsubscribed_at is null;

comment on column public.waitlist_leads.sms_consent_at is
  'When she agreed to be texted, stamped server-side at signup. Null means never agreed: do not text. Written once and never overwritten on a resubmit, because a refreshed stamp could end up dated AFTER messages already sent under the original consent, which turns the record from a defence into evidence.';
comment on column public.waitlist_leads.sms_consent_ip is
  'Client IP at the moment of consent, from the same x-real-ip / last-XFF-hop reader the rate limiter uses. Corroborating detail, not the substance.';
comment on column public.waitlist_leads.sms_consent_user_agent is
  'User agent at the moment of consent, truncated to 500 chars. Corroborating detail, not the substance.';
comment on column public.waitlist_leads.sms_consent_text is
  'The EXACT disclosure rendered to her, resolved server-side from the same message catalog the form renders (funnel.phoneConsent, in the locale the page actually painted). Stored verbatim because the wording will change and a claim is judged against what she saw, not against the current file.';
