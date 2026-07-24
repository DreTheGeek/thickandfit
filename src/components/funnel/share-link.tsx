'use client';
// The share block on the thank-you page — the single highest-leverage element in the funnel per
// kb-funnels doctrine 1. Two rows:
//   1) Copy input + Copy button (works everywhere; falls back to selection-copy on old browsers)
//   2) Per-channel share row: iMessage / WhatsApp / X / native share sheet (on mobile)
//
// Copy vs share behavior: some browsers expose navigator.share (mobile Safari/Chrome), some don't
// (most desktop). We render explicit channel buttons ALWAYS so a desktop user has one-tap paths
// to their most-used app; the native sheet is an extra button when available.
import { useCallback, useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';

type Props = { url: string };

export function ShareLink({ url }: Props): ReactElement {
  const t = useTranslations('funnel');
  const [copied, setCopied] = useState(false);
  const shareText = t('shareText');

  const doCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.getElementById('share-link-input') as HTMLInputElement | null;
      input?.select();
      document.execCommand('copy');
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [url]);

  const doNativeShare = useCallback(async () => {
    const w = typeof window !== 'undefined' ? window : null;
    const nav = w?.navigator as (Navigator & { share?: (d: ShareData) => Promise<void> }) | undefined;
    if (nav?.share) {
      try {
        await nav.share({ title: 'Thick & Fit', text: shareText, url });
        return;
      } catch {
        // user dismissed — fall through to copy
      }
    }
    void doCopy();
  }, [shareText, url, doCopy]);

  const hasNativeShare = typeof window !== 'undefined' && typeof (window.navigator as Navigator & { share?: unknown }).share === 'function';
  const enc = encodeURIComponent;
  const message = `${shareText} ${url}`;

  // Per-channel share targets. iMessage uses `sms:` (works on iOS/macOS Messages), WhatsApp uses
  // its universal wa.me link, X (Twitter) uses the intent URL. All open in a new tab so the user's
  // /join/thanks state (position, entries) isn't lost.
  const smsHref = `sms:?body=${enc(message)}`;
  const waHref = `https://wa.me/?text=${enc(message)}`;
  const xHref = `https://twitter.com/intent/tweet?text=${enc(shareText)}&url=${enc(url)}`;

  const chipBase =
    'flex items-center justify-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:border-white/40';

  return (
    <div className="mt-4">
      <label htmlFor="share-link-input" className="sr-only">
        {t('shareLinkLabel')}
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="share-link-input"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full min-w-0 flex-1 rounded-md border border-white/15 bg-black/40 px-4 py-3 text-[14px] text-white outline-none focus:border-[#ff2d55]"
        />
        <button
          type="button"
          onClick={() => void doCopy()}
          className="shrink-0 rounded-full bg-[#ff2d55] px-6 py-3 text-[13px] font-bold uppercase tracking-[0.12em] text-[#0e0e0e] transition-opacity hover:opacity-90"
        >
          {copied ? t('shareCopied') : t('shareCopy')}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={smsHref}
          className={chipBase}
          aria-label={t('shareIMessage')}
        >
          <span aria-hidden="true">💬</span>
          {t('shareIMessage')}
        </a>
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className={chipBase}
          aria-label={t('shareWhatsApp')}
        >
          <span aria-hidden="true">🟢</span>
          {t('shareWhatsApp')}
        </a>
        <a
          href={xHref}
          target="_blank"
          rel="noopener noreferrer"
          className={chipBase}
          aria-label={t('shareX')}
        >
          <span aria-hidden="true">𝕏</span>
          {t('shareX')}
        </a>
        {hasNativeShare && (
          <button type="button" onClick={() => void doNativeShare()} className={chipBase}>
            {t('shareMore')}
          </button>
        )}
      </div>
    </div>
  );
}
