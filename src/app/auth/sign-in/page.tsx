import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthForm } from '@/components/auth/auth-form';
import { OAuthButtons } from '@/components/auth/oauth-buttons';

export default async function SignInPage(): Promise<ReactElement> {
  const t = await getTranslations('auth');
  return (
    <AuthShell title={t('signIn')}>
      <AuthForm mode="sign-in" />
      <Link
        href="/auth/forgot-password"
        className="mt-3 inline-block text-sm text-muted underline-offset-4 transition hover:text-ink hover:underline"
      >
        {t('forgotPassword')}
      </Link>
      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-faint">
        <span className="h-px flex-1 bg-line" />
        {t('or')}
        <span className="h-px flex-1 bg-line" />
      </div>
      <OAuthButtons />
      <p className="mt-8 text-sm text-soft">
        {t('noAccount')}{' '}
        <Link href="/auth/sign-up" className="font-semibold text-ink underline-offset-4 hover:underline">
          {t('signUp')}
        </Link>
      </p>
    </AuthShell>
  );
}
