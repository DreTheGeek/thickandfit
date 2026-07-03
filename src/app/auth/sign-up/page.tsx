import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthForm } from '@/components/auth/auth-form';
import { OAuthButtons } from '@/components/auth/oauth-buttons';

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
      {error != null && (
        <p role="alert" className="mb-4 bg-alert px-3 py-2 text-sm text-alert-ink">
          {error === 'oauth' ? t('oauthError') : t('authError')}
        </p>
      )}
      <AuthForm mode="sign-up" />
      {/* Config-flip social login (see sign-in). */}
      {process.env.NEXT_PUBLIC_OAUTH_GOOGLE === '1' && <OAuthButtons />}
      <p className="mt-8 text-sm text-soft">
        {t('haveAccount')}{' '}
        <Link href="/auth/sign-in" className="font-semibold text-ink underline-offset-4 hover:underline">
          {t('signIn')}
        </Link>
      </p>
    </AuthShell>
  );
}
