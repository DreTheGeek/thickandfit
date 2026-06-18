# Living Spec: Migration (REQ-MIG-*)

## REQ-MIG-001: Legacy flag firewall
THE SYSTEM SHALL stamp every migrated client is_legacy_client=true, legacy_source='lenus',
lenus_profile_id stored. Deployment is blocked if any migrated record lacks the flag.
Added by: PRD-00 | Status: planned | criticality: critical

## REQ-MIG-002: History import
THE SYSTEM SHALL import measurements, check-ins, workout history, habits, chat, meal plans, and
tags for all 256 clients.
Added by: PRD-00 | Status: planned

## REQ-MIG-003: Grandfathered pricing
THE SYSTEM SHALL preserve each migrated client's exact Lenus per-client price in BIGINT cents.
Added by: PRD-00 | Status: planned
