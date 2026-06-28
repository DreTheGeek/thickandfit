import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthForm } from '@/components/auth/auth-form';

export default async function SignUpPage(): Promise<ReactElement> {
  const t = await getTranslations('auth');
  return (
    <AuthShell title={t('signUp')}>
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
