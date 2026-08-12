'use client';

// One search box for the whole product, in both portals.
//
// The complaint it answers, in the owner's words: "how is the entire customer app handled in those
// 6 tabs. i feel like this user experience sucks." He is right. The member app has five tabs and
// twenty-four screens; the coach console has thirty-one items behind six collapsible sections.
// Neither is a navigation problem you fix by adding a sixth tab.
//
// TWO DELIBERATE DEPARTURES from the ChairLord palette this is modelled on:
//
// 1. It opens on the FULL list, not on "start typing". The playbook's palette is for an owner who
//    knows her product and wants to jump; this one is also for a member on day two who does not
//    know the screen exists. An empty search box that says "start typing" cannot teach her that
//    /you/cycle is in here. Showing everything is the discovery half of the feature.
// 2. There is a visible button, not only Cmd+K. This is a phone-first product for women training
//    in a gym. A keyboard shortcut on its own would ship a feature most of the audience can never
//    press.
//
// No cmdk. The list is forty rows we filter ourselves, and hand-rolling it avoids the trap the
// playbook documents at length: cmdk's built-in filter matches each item's `value`, so a list keyed
// by database id gets silently hidden no matter what is rendered, and the fix is a `shouldFilter`
// prop that is easy to half-apply. Nothing here can drift that way, because there is only one
// filter and it is ours.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DESTINATIONS, searchDestinations, type Audience, type NavDestination } from '@/lib/nav/destinations';
import { Icon } from '@/components/ui/icons';

export function CommandPalette({
  audience,
  /**
   * Bind Ctrl/Cmd+K. Exactly ONE mounted instance may do this.
   *
   * The member shell renders the trigger twice, once in the phone top bar (lg:hidden) and once in
   * the desktop rail (hidden below lg), so only one is ever on screen. Both still MOUNT, and the
   * first version had both listening on window: Ctrl+K opened both, Enter fired two router.push
   * calls, and the invisible one stayed open behind the page afterwards. Caught by asserting the
   * dialog had closed after navigating and finding it present with offsetParent null.
   *
   * The desktop instance owns the shortcut, which is also the honest split: a phone has no Ctrl key.
   */
  withShortcut = true,
}: {
  audience: Audience;
  withShortcut?: boolean;
}): ReactElement {
  const t = useTranslations('app.nav');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const pool = useMemo(() => DESTINATIONS.filter((d) => d.audience === audience), [audience]);
  const labelOf = useCallback((d: NavDestination) => t(`dest.${d.key}` as never), [t]);

  // Empty term shows everything, which is the point: she cannot search for a screen she does not
  // know exists. Typing narrows and ranks.
  const results = useMemo(
    () => (term.trim() ? searchDestinations(pool, labelOf, term, 8) : pool),
    [pool, labelOf, term],
  );

  // Reset in the openers, not in an effect keyed on `open`. Setting state from an effect that
  // watches state schedules a second render for something the event already knew, and the lint
  // rule that bans it is right: the search term is a property of "she just opened it", not a
  // consequence of it being open.
  const openPalette = useCallback((): void => {
    setTerm('');
    setActive(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (withShortcut && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => {
          if (!o) {
            setTerm('');
            setActive(0);
          }
          return !o;
        });
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [withShortcut]);

  // Keep the highlighted row on screen when arrowing past the fold.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function go(d: NavDestination): void {
    setOpen(false);
    router.push(d.href);
  }

  function onInputKey(e: React.KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (results.length === 0 ? 0 : (i + 1) % results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (results.length === 0 ? 0 : (i - 1 + results.length) % results.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const d = results[active];
      if (d) go(d);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        aria-label={t('searchOpen')}
        className="tf-press flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-warm hover:text-ink"
      >
        <Icon name="search" size={18} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-ink/40 px-4 pt-[12vh]"
          // Backdrop click closes. The dialog itself stops propagation below.
          onMouseDown={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('searchTitle')}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-bg shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
          >
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <Icon name="search" size={16} className="shrink-0 text-faint" />
              <input
                autoFocus
                value={term}
                onChange={(e) => {
                  setTerm(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onInputKey}
                placeholder={t('searchPlaceholder')}
                aria-label={t('searchPlaceholder')}
                // The listbox is rendered below; announce the count so a screen reader knows the
                // list changed as she types.
                aria-controls="tf-palette-list"
                className="w-full bg-transparent py-3.5 text-[15px] outline-none placeholder:text-faint"
              />
              <kbd className="hidden shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-faint sm:block">
                esc
              </kbd>
            </div>

            <div id="tf-palette-list" ref={listRef} role="listbox" className="tf-scroll overflow-y-auto py-1.5">
              {results.length === 0 ? (
                <p className="px-4 py-8 text-center text-[13px] text-faint">{t('searchEmpty')}</p>
              ) : (
                results.map((d, i) => (
                  <button
                    key={d.key}
                    type="button"
                    data-idx={i}
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(d)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] ${
                      i === active ? 'bg-warm text-ink' : 'text-muted'
                    }`}
                  >
                    <Icon name={d.icon} size={16} className="shrink-0" />
                    <span className="truncate">{labelOf(d)}</span>
                  </button>
                ))
              )}
            </div>

            <p className="border-t border-line px-4 py-2 text-[11px] text-faint">{t('searchHint')}</p>
          </div>
        </div>
      )}
    </>
  );
}
