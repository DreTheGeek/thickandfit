-- Support triage: structured agent read attached to a ticket, plus the GitHub issue it opened.
--
-- Context: /admin/support existed but every ticket was typed by hand (source was always 'manual')
-- and carried nothing but a subject. This migration is the storage half of giving tickets a real
-- intake (public form + inbound email) and an agent that enriches them before a human reads them.
--
-- No new table on purpose. Triage is a property OF a ticket, one row per ticket, always read with
-- the ticket. A side table would buy a join and nothing else.

alter table public.support_tickets
  -- The agent's structured read: category, priority, summary, member_context, likely_area,
  -- suggested_reply, confidence. jsonb because the shape will change as the prompt improves, and a
  -- column-per-field migration for every iteration is not worth it for an internal triage surface.
  add column if not exists triage jsonb,
  add column if not exists triaged_at timestamptz,
  -- Set when triage opens a GitHub issue, so the board can link out and, more importantly, so a
  -- re-triage cannot open a second issue for the same ticket.
  add column if not exists github_issue_url text;

-- Dedupe key for inbound email + form submissions. Resend can deliver the same message more than
-- once (webhook retries), and a member double-tapping Send is normal. Without this, one complaint
-- becomes three tickets and the board loses its meaning during launch week, which is exactly when
-- it matters most.
alter table public.support_tickets
  add column if not exists dedupe_key text;

create unique index if not exists support_tickets_dedupe_key_uidx
  on public.support_tickets (company_id, dedupe_key)
  where dedupe_key is not null;

-- The board's default read: newest open work first.
create index if not exists support_tickets_status_created_idx
  on public.support_tickets (company_id, status, created_at desc);

-- Untriaged queue, for a retry sweep. Partial so it stays tiny.
create index if not exists support_tickets_untriaged_idx
  on public.support_tickets (company_id, created_at)
  where triaged_at is null;

comment on column public.support_tickets.triage is
  'Agent triage output (jsonb). Advisory only: suggested_reply is a DRAFT and is never sent to a member automatically.';
comment on column public.support_tickets.dedupe_key is
  'Stable key per inbound source (email message-id, or hash of email+subject+body for the web form) so webhook retries and double submits collapse into one ticket.';
