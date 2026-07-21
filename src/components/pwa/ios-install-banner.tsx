'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

const DISMISS_KEY = 'tf-ios-install-dismissed';

export function IOSInstallBanner() {
  const t = useTranslations('pwa');
  const [show, setShow] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isIos && !isStandalone && localStorage.getItem(DISMISS_KEY) !== '1') {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 bg-black px-4 py-3 text-white">
      <p className="text-sm">
        {t.rich('iosInstall', { b: (chunks) => <span className="font-semibold">{chunks}</span> })}
      </p>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, '1');
          setShow(false);
        }}
        className="shrink-0 text-sm underline"
      >
        {t('dismiss')}
      </button>
    </div>
  );
}
