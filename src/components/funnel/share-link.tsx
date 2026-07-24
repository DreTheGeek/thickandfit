'use client';
// The copy-share-link block on the thank-you page. Big tappable input + copy button, native share
// sheet on phones. This is the single highest-leverage element in the funnel per kb-funnels
// doctrine 1: dopamine peaks in the 30 seconds after signup, so the share mechanic is above the
// fold and one tap. The pre-filled `text` uses the current language's shareText from the funnel
// namespace so the message a friend receives reads native, not translated.
import { useCallback, useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';

export function ShareLink({ url }: { url: string }): ReactElement {
  const t = useTranslations('funnel');
  const [copied, setCopied] = useState(false);

  const doCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Older browsers / permission denied — fall back to a selection prompt.
      const input = document.getElementById('share-link-input') as HTMLInputElement | null;
      input?.select();
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }, [url]);

  const doShare = useCallback(async () => {
    const text = t('shareText');
    const w = typeof window !== 'undefined' ? (window as Window & { navigator: Navigator & { share?: (data: ShareData) => Promise<void> } }) : null;
    if (w?.navigator?.share) {
      try {
        await w.navigator.share({ title: 'Thick & Fit', text, url });
        return;
      } catch {
        // User dismissed the sheet — fall through to copy.
      }
    }
    void doCopy();
  }, [t, url, doCopy]);

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
      <input
        id="share-link-input"
        readOnly
        value={url}
        aria-label="Your share link"
        onFocus={(e) => e.currentTarget.select()}
        className="w-full min-w-0 flex-1 rounded-md border border-white/15 bg-black/40 px-4 py-3 text-[14px] text-white outline-none focus:border-[#ff2d55]"
      />
      <button
        type="button"
        onClick={() => void doShare()}
        className="shrink-0 rounded-full bg-[#ff2d55] px-6 py-3 text-[13px] font-bold uppercase tracking-[0.12em] text-[#0e0e0e] transition-opacity hover:opacity-90"
      >
        {copied ? t('shareCopied') : t('shareCopy')}
      </button>
    </div>
  );
}
