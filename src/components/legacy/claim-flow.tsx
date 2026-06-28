'use client';
// Claim flow (WP13). Runs once when a freshly-invited legacy client lands on /claim after setting
// their password. On mount it calls claimLegacyAction(), which reconciles their auth user with the
// legacy contact and imports their progress photos, then shows the outcome. Idempotent: safe to land
// here twice (the second claim is a no-op).
import { useEffect, useRef, useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { claimLegacyAction, type ClaimResult } from '@/lib/legacy/claim';

type State = 'checking' | 'claimed' | 'new_user' | 'error';

export function ClaimFlow(): ReactElement {
  const t = useTranslations('app.claim');
  const router = useRouter();
  const [state, setState] = useState<State>('checking');
  const [photos, setPhotos] = useState(0);
  const [pending, startTransition] = useTransition();
  const ran = useRef(false);

  function run(): void {
    startTransition(async () => {
      setState('checking');
      const res: ClaimResult = await claimLegacyAction();
      if (res.status === 'claimed') {
        setPhotos(res.photosImported);
        setState('claimed');
      } else if (res.status === 'not_legacy') {
        setState('new_user');
      } else {
        setState('error');
      }
    });
  }

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    run();
    // Intentionally run once on mount; the ref guard prevents a double-claim under StrictMode.
  }, []);

  const title =
    state === 'claimed'
      ? t('claimedTitle')
      : state === 'new_user'
        ? t('newUserTitle')
        : state === 'error'
          ? t('errorTitle')
          : t('title');

  const body =
    state === 'claimed'
      ? t('claimedBody')
      : state === 'new_user'
        ? t('newUserBody')
        : state === 'error'
          ? t('errorBody')
          : t('checking');

  return (
    <div className="mx-auto max-w-lg px-[22px] py-12 text-center">
      <h1 className="text-[22px] font-bold text-ink">{title}</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-soft">{body}</p>

      {state === 'claimed' ? (
        <p className="mt-2 text-[13px] font-semibold text-ink">
          {t('photosImported', { count: photos })}
        </p>
      ) : null}

      {state === 'checking' || pending ? (
        <div className="mt-6 text-[12px] uppercase tracking-[2px] text-muted">{t('checking')}</div>
      ) : null}

      {state === 'claimed' || state === 'new_user' ? (
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="tf-press mt-8 w-full rounded-full bg-ink py-3.5 text-[13px] font-semibold uppercase tracking-[2px] text-bg"
        >
          {t('continue')}
        </button>
      ) : null}

      {state === 'error' ? (
        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className="tf-press w-full rounded-full bg-ink py-3.5 text-[13px] font-semibold uppercase tracking-[2px] text-bg disabled:opacity-50"
          >
            {t('retry')}
          </button>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="tf-press w-full border border-line py-3.5 text-[12px] font-semibold uppercase tracking-[2px] text-muted"
          >
            {t('continue')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
