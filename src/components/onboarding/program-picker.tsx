'use client';

import { useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';

/**
 * "This is your program, and here are the others."
 *
 * THE COMPLAINT: "it gave me the twelve week three day training plan, but why was that decided for
 * me, and I didn't choose?" Fair, and it was worse than he knew: nothing had decided anything. Every
 * member got one hardcoded plan regardless of her answers.
 *
 * The matcher fixed the choosing. This fixes the not-being-asked. Collapsed by default, because a
 * good default that she can override is a better experience than a list of seven programs handed to
 * somebody who has just answered twenty questions and does not yet know what any of them are.
 *
 * She can only pick from what Stephanie marked as offerable, and the API refuses the moment a coach
 * has assigned her anything. See api/programs/choose.
 */
export type PickerPlan = {
  id: string;
  name: string;
  daysPerWeek: number | null;
  level: string | null;
  location: string | null;
};

export function ProgramPicker({
  chosenId,
  plans,
}: {
  chosenId: string | null;
  plans: PickerPlan[];
}): ReactElement | null {
  const t = useTranslations('app.onboarding');
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(chosenId);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // Nothing to choose between. One option is not a choice, and offering it as one implies the app
  // has more to give than it does.
  if (plans.length < 2) return null;

  async function choose(id: string): Promise<void> {
    if (id === current) return;
    setBusy(id);
    setFailed(false);
    try {
      const res = await fetch('/api/programs/choose', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan_id: id }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setCurrent(id);
      setOpen(false);
    } catch {
      // She keeps the program she already has. Silent failure here would show her a selected row
      // for a plan the server never accepted.
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="tf-press flex w-full items-center justify-between gap-2 rounded-[14px] border border-line px-4 py-3 text-left"
      >
        <span className="text-[13px] font-semibold text-ink">{t('pickerToggle')}</span>
        <Icon
          name="chevronRight"
          size={15}
          className={`flex-none text-faint transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>

      {open && (
        <div className="mt-2 overflow-hidden rounded-[14px] border border-line">
          {failed && (
            <p role="alert" className="border-b border-divider bg-alert px-4 py-2 text-[12.5px] text-alert-ink">
              {t('pickerFailed')}
            </p>
          )}
          {plans.map((p) => {
            const on = p.id === current;
            const bits = [
              p.daysPerWeek != null ? t('planDaysV', { count: p.daysPerWeek }) : null,
              p.location === 'home' ? t('pickerNoGym') : p.location === 'gym' ? t('pickerGym') : null,
              p.level === 'advanced' ? t('pickerAdvanced') : null,
            ].filter(Boolean);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => void choose(p.id)}
                disabled={busy !== null}
                aria-pressed={on}
                className="tf-press flex w-full items-center gap-3 border-b border-divider px-4 py-3 text-left last:border-0 disabled:opacity-60"
              >
                <span
                  className={[
                    'grid h-5 w-5 flex-none place-items-center rounded-full border',
                    on ? 'border-ink bg-ink text-bg' : 'border-line',
                  ].join(' ')}
                >
                  {on && <Icon name="check" size={12} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold text-ink">{p.name}</span>
                  {bits.length > 0 && (
                    <span className="mt-0.5 block text-[11.5px] text-muted">{bits.join(' · ')}</span>
                  )}
                </span>
                {busy === p.id && <span className="flex-none text-[11px] text-faint">…</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
