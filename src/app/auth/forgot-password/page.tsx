import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ForgotForm } from '@/components/auth/forgot-form';

export default async function ForgotPasswordPage() {
  const t = await getTranslations('auth');
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-16 text-black">
      <h1 className="text-3xl font-bold uppercase tracking-tight">{t('resetTitle')}</h1>
      <ForgotForm />
      <Link href="/auth/sign-in" className="text-sm underline">
        {t('signIn')}
      </Link>
    </main>
  );
}
