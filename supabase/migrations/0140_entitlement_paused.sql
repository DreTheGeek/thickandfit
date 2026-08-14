-- 0140: a member can be PAUSED.
--
-- Stephanie offers pauses and has several live right now. On 2026-08-13 she asked how to record one
-- ("I have a few clients that are paused... to resume on 9-8") and the answer was "give it to me and
-- I can put it in the system." Nothing in the system knew what a pause was: entitlements.status ran
-- active | trialing | past_due | canceled | expired | revoked, and the closest available answer,
-- 'canceled', is both wrong and destructive — it tells the app she left.
--
-- WHY A NEW STATUS AND NOT A FLAG SOMEWHERE. public.entitlements is the single authoritative read
-- for access (see 0095 and src/lib/billing/entitlement.ts). A pause IS an access state, so putting
-- it anywhere else means two places decide who gets in and they will disagree. That is the exact
-- failure 0095 was created to end.
--
-- WHAT PAUSED MEANS, decided 2026-08-14: she keeps everything of her own and can reach nothing else.
-- Her history, photos, measurements, messages and past plans stay readable; new training, the AI
-- coach and the rest of the paid surface do not. isActiveEntitlementStatus does NOT include it, so
-- the grant does not grant, and guards.ts routes her to /paused rather than /checkout — showing a
-- paywall to somebody who asked for a break is how a pause becomes a cancellation.
--
-- expires_at carries the resume date, matching how manual comps already use the column.

alter table public.entitlements
  drop constraint if exists entitlements_status_check;

alter table public.entitlements
  add constraint entitlements_status_check
  check (status in ('active', 'trialing', 'past_due', 'paused', 'canceled', 'expired', 'revoked'));

comment on column public.entitlements.status is
  'Provider-normalized lifecycle. Only active and trialing grant access (isActiveEntitlementStatus). '
  'paused is a coach-granted break: no access to paid surfaces, her own records stay readable, '
  'expires_at holds the resume date.';
