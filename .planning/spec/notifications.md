# Living Spec: Notifications (REQ-NOTIF-*)

## REQ-NOTIF-001: Transactional email
THE SYSTEM SHALL send transactional email via Resend with SPF/DKIM/DMARC, suppression-list
checked before every send.
Added by: PRD-01 | Status: planned

## REQ-NOTIF-002: Push notifications
THE SYSTEM SHALL support web push (Android native, iOS via Capacitor in Phase 3).
Added by: PRD-39 | Status: planned

## REQ-NOTIF-003: Bounce/complaint handling
WHEN Resend reports a bounce or complaint THE SYSTEM SHALL suppress the address.
Added by: PRD-01 | Status: planned

## REQ-NOTIF-004: GHL marketing handoff
Marketing email, drip, and IG DM automation SHALL be handled by GoHighLevel, separate from
transactional Resend.
Added by: PRD-34 | Status: planned
