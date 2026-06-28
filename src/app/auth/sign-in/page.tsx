import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthForm } from '@/components/auth/auth-form';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}): Promise<ReactElement> {
  const t = await getTranslations('auth');
  const { error } = await searchParams;
  return (
    <AuthShell title={t('signIn')}>
      {error != null && (
        <p role="alert" className="mb-4 bg-alert px-3 py-2 text-sm text-alert-ink">
          {error === 'oauth' ? t('oauthError') : t('authError')}
        </p>
      )}
      <AuthForm mode="sign-in" />
      <Link
        href="/auth/forgot-password"
        className="mt-3 inline-block text-sm text-muted underline-offset-4 transition hover:text-ink hover:underline"
      >
        {t('forgotPassword')}
      </Link>
      <p className="mt-8 text-sm text-soft">
        {t('noAccount')}{' '}
        <Link href="/auth/sign-up" className="font-semibold text-ink underline-offset-4 hover:underline">
          {t('signUp')}
        </Link>
      </p>
    </AuthShell>
  );
}
