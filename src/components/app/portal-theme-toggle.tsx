'use client';

import { useTransition, type ReactElement } from 'react';
import { Icon } from '@/components/ui/icons';
import { setPortalThemeAction } from '@/lib/portal-theme-actions';
import type { PortalTheme } from '@/lib/portal-theme';

/**
 * Light / dark for the member portal.
 *
 * Two explicit options rather than a switch. A switch has to be labelled with the state it is going
 * TO or the state it is IN, and every product picks a different one, so half of everyone reads it
 * backwards. Two labelled pills say what they do.
 *
 * No "system" option, deliberately. The portal is a single-purpose app rather than a document
 * viewer, and following the OS would mean her app changes appearance at sunset without her asking.
 * If that is ever wanted it is a third pill, not a rewrite.
 */
export function PortalThemeToggle({ current }: { current: PortalTheme }): ReactElement {
  const [pending, start] = useTransition();

  const pick = (next: PortalTheme): void => {
    if (next === current || pending) return;
    start(async () => {
      await setPortalThemeAction(next);
    });
  };

  return (
    <div className="flex gap-2" role="group">
      {(['light', 'dark'] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => pick(t)}
          disabled={pending}
          aria-pressed={t === current}
          className={[
            'tf-press flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-[13px] font-semibold',
            t === current ? 'border-ink bg-ink text-bg' : 'border-line text-muted',
          ].join(' ')}
        >
          <Icon name={t === 'light' ? 'sun' : 'moon'} size={14} />
          {t === 'light' ? 'Light' : 'Dark'}
        </button>
      ))}
    </div>
  );
}
