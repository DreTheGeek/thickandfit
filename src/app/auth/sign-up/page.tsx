import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthForm } from '@/components/auth/auth-form';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Create account' };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}): Promise<ReactElement> {
  const t = await getTranslations('auth');
  // OAuth failures redirect back here with ?error=oauth (mirrors sign-in); dropping it was silent.
  const { error } = await searchParams;
  return (
    <AuthShell title={t('signUp')}>
      {/* WHAT SHE GETS, before she is asked to commit.
          This page was a bare form: four fields, no statement of what happens next. The research on
          signup placement is consistent that people abandon when asked to commit before seeing value,
          and we cannot show the plan first because every onboarding question (weight, injuries,
          conditions, pregnancy) is consumer health data that must sit behind recorded consent. So the
          honest move is to TELL her what is coming and how long it takes, rather than move the
          questions in front of the consent that protects them. */}
      <p className="mb-5 text-[14px] leading-[1.55] text-soft">{t('signUpPromise')}</p>
      {error != null && (
        <p role="alert" className="mb-4 bg-alert px-3 py-2 text-sm text-alert-ink">
          {error === 'oauth' ? t('oauthError') : t('authError')}
        </p>
      )}
      {/* OAuthButtons owns its own gate (NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED) and returns null when
          unset. This page used to ALSO check NEXT_PUBLIC_OAUTH_GOOGLE === '1', a different variable
          with a different value format, so setting either one alone rendered nothing and looked like
          a broken flag. One gate, in the component that knows. */}
      <OAuthButtons />
      <AuthForm mode="sign-up" />

      <p className="mt-8 text-sm text-soft">
        {t('haveAccount')}{' '}
        <Link href="/auth/sign-in" className="font-semibold text-ink underline-offset-4 hover:underline">
          {t('signIn')}
        </Link>
      </p>
    </AuthShell>
  );
}
