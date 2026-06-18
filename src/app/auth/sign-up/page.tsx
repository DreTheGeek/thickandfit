import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthForm } from '@/components/auth/auth-form';
import { OAuthButtons } from '@/components/auth/oauth-buttons';

export default async function SignUpPage() {
  const t = await getTranslations('auth');
  return (
    <AuthShell title={t('signUp')}>
      <AuthForm mode="sign-up" />
      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-neutral-400">
        <span className="h-px flex-1 bg-neutral-200" />
        {t('or')}
        <span className="h-px flex-1 bg-neutral-200" />
      </div>
      <OAuthButtons />
      <p className="mt-8 text-sm text-neutral-600">
        {t('haveAccount')}{' '}
        <Link href="/auth/sign-in" className="font-semibold text-ink underline-offset-4 hover:underline">
          {t('signIn')}
        </Link>
      </p>
    </AuthShell>
  );
}
