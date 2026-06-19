import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { ForgotForm } from '@/components/auth/forgot-form';

export default async function ForgotPasswordPage(): Promise<ReactElement> {
  const t = await getTranslations('auth');
  return (
    <AuthShell title={t('resetTitle')}>
      <ForgotForm />
      <Link
        href="/auth/sign-in"
        className="mt-6 inline-block text-sm text-muted underline-offset-4 transition hover:text-ink hover:underline"
      >
        ← {t('signIn')}
      </Link>
    </AuthShell>
  );
}
