# Living Spec: Auth (REQ-AUTH-*)
Added by PRD-01 (baseline tables) and PRD-04 (flows). Updated by applying PRD deltas in order.

## REQ-AUTH-001: Email/password sign-up
WHEN a visitor submits a valid email and password THE SYSTEM SHALL create a profile, send a
verification email via Resend, and start an unverified session.
Added by: PRD-04 | Status: planned

## REQ-AUTH-002: Google OAuth
WHEN a visitor chooses Continue with Google THE SYSTEM SHALL authenticate via Supabase Google
provider and create or link a profile.
Added by: PRD-04 | Status: planned

## REQ-AUTH-003: Apple OAuth
WHEN a visitor chooses Continue with Apple THE SYSTEM SHALL authenticate via Supabase Apple
provider and create or link a profile.
Added by: PRD-04 | Status: planned

## REQ-AUTH-004: Magic Link (logged deviation from baseline)
WHEN a visitor requests a magic link THE SYSTEM SHALL email a single-use sign-in link.
Added by: PRD-04 | Status: planned | Note: deviation from email+Google+Apple baseline, logged.

## REQ-AUTH-005: 5-role RBAC
THE SYSTEM SHALL enforce roles Subscriber, Free, Coach, Assistant Coach, Operator on every
protected route and mutation.
Added by: PRD-04 | Status: planned

## REQ-AUTH-006: Password reset
WHEN a user requests a reset THE SYSTEM SHALL email a single-use reset link via Resend.
Added by: PRD-04 | Status: planned
