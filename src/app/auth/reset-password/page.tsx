import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Set a new password' };

export default async function ResetPasswordPage(): Promise<ReactElement> {
  const t = await getTranslations('auth');
  return (
    <AuthShell title={t('newPasswordTitle')}>
      <ResetPasswordForm />
    </AuthShell>
  );
}
