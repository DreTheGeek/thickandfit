import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AuthForm } from '@/components/auth/auth-form';
import { OAuthButtons } from '@/components/auth/oauth-buttons';

export default async function SignUpPage() {
  const t = await getTranslations('auth');
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-16 text-black">
      <h1 className="text-3xl font-bold uppercase tracking-tight">{t('signUp')}</h1>
      <AuthForm mode="sign-up" />
      <div className="text-center text-xs uppercase tracking-widest text-neutral-400">{t('or')}</div>
      <OAuthButtons />
      <p className="text-sm">
        {t('haveAccount')}{' '}
        <Link href="/auth/sign-in" className="underline">
          {t('signIn')}
        </Link>
      </p>
    </main>
  );
}
