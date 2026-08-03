-- Operator-controlled signup switch.
--
-- Lives in admin_settings (one row per company) rather than an env var, because the operator has to
-- be able to flip it from /admin/settings without a deploy. That is the whole point: closing signups
-- is a business decision made at a moment, not a release.
--
-- NOT Supabase's own `disable_signup` auth flag, deliberately. Flipping that from the app means the
-- portal holds a Management API token and PATCHes /config/auth, and a partial PATCH to that endpoint
-- CLEARS the rest of the group: that is exactly how the SMTP block got nulled on 2026-07-30 and took
-- every auth email down for days (see CLAUDE.md, "Auth email: two config traps"). An app-level flag
-- enforced in our own code paths cannot take email down when someone toggles it.
--
-- DEFAULT TRUE so this migration cannot close signups by being applied.

alter table public.admin_settings
  add column if not exists signup_enabled boolean not null default true;

comment on column public.admin_settings.signup_enabled is
  'Operator switch for new account creation. Enforced server-side in signUpAction and in the OAuth callback, so turning it off cannot be bypassed by posting the form directly or by using Continue with Google. Default true.';
