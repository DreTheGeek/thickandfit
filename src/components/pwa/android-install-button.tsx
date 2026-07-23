'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function AndroidInstallButton() {
  const t = useTranslations('pwa');
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferred) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        await deferred.prompt();
        await deferred.userChoice;
        setDeferred(null);
      }}
      /* Ink, not the hardcoded functional green (brand rule: green signals state, not chrome).
         Moved to bottom-left so it no longer sits on top of the quick-add FAB at bottom-right. */
      className="tf-press fixed bottom-4 left-4 z-50 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white shadow-lg"
    >
      {t('installApp')}
    </button>
  );
}
