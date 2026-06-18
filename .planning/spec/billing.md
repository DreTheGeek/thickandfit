# Living Spec: Billing (REQ-BILL-*)

## REQ-BILL-001: Stripe Connect subscription
WHEN a user selects a paid tier THE SYSTEM SHALL create a Stripe subscription on Stephanie's
connected account and store the subscription with money in BIGINT cents.
Added by: PRD-05 | Status: planned

## REQ-BILL-002: One-tap cancel
WHEN a subscriber taps Cancel THE SYSTEM SHALL cancel at period end and show the effective date,
with no retention dark patterns.
Added by: PRD-05 | Status: planned

## REQ-BILL-003: Pre-renewal warning
THE SYSTEM SHALL send a push and email 48 hours before any renewal.
Added by: PRD-05 | Status: planned

## REQ-BILL-004: Visible next charge
THE SYSTEM SHALL display the next charge amount and date on the subscriber billing screen.
Added by: PRD-05 | Status: planned

## REQ-BILL-005: Grandfathered migration pricing
WHEN a migrated client is billed THE SYSTEM SHALL charge their preserved per-client Lenus price.
Added by: PRD-00 / PRD-06 | Status: planned

## REQ-BILL-006: Revenue-share firewall
THE SYSTEM SHALL exclude every is_legacy_client=true record from the rev-share pool permanently.
Added by: PRD-06 | Status: planned
