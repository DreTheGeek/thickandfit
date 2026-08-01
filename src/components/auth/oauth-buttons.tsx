'use client';
// Google OAuth. Server action builds the provider redirect (needs provider config in Supabase).
// Apple is intentionally hidden on main: the provider is not wired yet (see Gap Log #1).
//
// Provider-gated on NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED: renders NOTHING when the flag is unset or
// false, so a click can never 400 against a disabled Supabase provider (external_google_enabled).
// Flip the env var to "true" in Vercel prod ONLY after enabling the provider + adding the client
// id/secret in Supabase Auth. Same-request no-op keeps sign-in/sign-up shells tidy in the meantime.
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { signInWithOAuthAction } from '@/lib/auth/actions';

const btnClass =
  'tf-press flex w-full items-center justify-center gap-2 border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink transition hover:border-ink disabled:opacity-60';

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === 'true';

/**
 * Rendered ABOVE the email form, with an "or" rule beneath it.
 *
 * Social sign-in is the shorter path (no password to invent, no confirmation email to go find), and
 * burying it under the form it replaces means most people never see it. The divider makes the email
 * form read as the alternative rather than the default.
 */
export function OAuthButtons(): ReactElement | null {
  const t = useTranslations('auth');
  const [pending, start] = useTransition();
  if (!GOOGLE_ENABLED) return null;
  return (
    <div className="mb-5 flex flex-col gap-2.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => signInWithOAuthAction('google'))}
        className={btnClass}
      >
        {t('continueGoogle')}
      </button>
      <div className="flex items-center gap-3 pt-1" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        <span className="text-[11px] uppercase tracking-[1.2px] text-faint">{t('or')}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
