import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AuthForm } from '@/components/auth/auth-form';
import { OAuthButtons } from '@/components/auth/oauth-buttons';

export default async function SignInPage() {
  const t = await getTranslations('auth');
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-16 text-black">
      <h1 className="text-3xl font-bold uppercase tracking-tight">{t('signIn')}</h1>
      <AuthForm mode="sign-in" />
      <Link href="/auth/forgot-password" className="text-sm underline">
        {t('forgotPassword')}
      </Link>
      <div className="text-center text-xs uppercase tracking-widest text-neutral-400">{t('or')}</div>
      <OAuthButtons />
      <p className="text-sm">
        {t('noAccount')}{' '}
        <Link href="/auth/sign-up" className="underline">
          {t('signUp')}
        </Link>
      </p>
    </main>
  );
}
