// The hero's proof object: the product's Today screen, rendered as real markup rather than a
// screenshot. Built this way on purpose, per the positioning brief ("show the software like a
// luxury product, not screenshots dumped into cards"): it stays sharp at any density, restyles with
// the tokens, translates, and can be edited without a designer round trip.
//
// It is a STATIC MARKETING REPLICA of /dashboard, not the live component. Numbers here are
// illustrative of the layout, not claims about a real member.
//
// Every word in it is keyed, including the row values: this card is the only product screen on the
// fold, so a Spanish visitor reading "Lower body, 45 min" inside it undoes the entire "in your
// language" promise the page just made. The thousands separator differs too, which is why the values
// are translated rather than interpolated.
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';

import { Icon } from '@/components/ui/icons';

type Row = {
  icon: 'dumbbell' | 'nutrition' | 'steps' | 'pulse';
  labelKey: string;
  valueKey: string;
  done: boolean;
};

const ROWS: readonly Row[] = [
  { icon: 'dumbbell', labelKey: 'trainLabel', valueKey: 'trainValue', done: true },
  { icon: 'nutrition', labelKey: 'fuelLabel', valueKey: 'fuelValue', done: true },
  { icon: 'steps', labelKey: 'moveLabel', valueKey: 'moveValue', done: false },
  { icon: 'pulse', labelKey: 'recoverLabel', valueKey: 'recoverValue', done: false },
];

export async function TodayCard(): Promise<ReactElement> {
  const t = await getTranslations('home.today');
  return (
    <div className="relative w-full max-w-[420px]">
      {/* Ambient crimson bloom. Decorative, and kept low so the card reads as glass on black. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-10 -z-10 rounded-full bg-[#ff2d55] opacity-[0.16] blur-[90px]"
      />

      <div className="rounded-[26px] border border-white/12 bg-[#121214]/85 p-6 shadow-[0_40px_90px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/45">
          {t('eyebrow')}
        </p>

        <div className="mt-3 flex items-end justify-between gap-4">
          <p className="text-[26px] font-extrabold leading-none tracking-[-0.02em] text-white sm:text-[30px]">
            {t('mission')}
          </p>
          <p className="text-[26px] font-extrabold leading-none tracking-[-0.02em] text-[#ff2d55] sm:text-[30px]">
            92%
          </p>
        </div>

        {/* Completion bar */}
        <div className="mt-4 h-[6px] w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-[92%] rounded-full bg-[#ff2d55]" />
        </div>

        <ul className="mt-6 flex flex-col gap-3">
          {ROWS.map((row) => (
            <li
              key={row.labelKey}
              className="flex items-center gap-3.5 rounded-2xl bg-white/[0.045] px-4 py-3.5"
            >
              <span
                className={[
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  row.done ? 'bg-[#ff2d55] text-[#0e0e0e]' : 'bg-white/10 text-white/70',
                ].join(' ')}
              >
                <Icon name={row.icon} size={18} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold uppercase tracking-[0.1em] text-white/55">
                  {t(row.labelKey)}
                </span>
                <span className="block truncate text-[15px] font-semibold text-white">
                  {t(row.valueKey)}
                </span>
              </span>
              {row.done ? (
                <span className="shrink-0 text-[#ff2d55]">
                  <Icon name="check" size={18} strokeWidth={3} />
                </span>
              ) : null}
            </li>
          ))}
        </ul>

        <div className="mt-6 border-t border-white/10 pt-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/45">
            {t('evolutionEyebrow')}
          </p>
          <p className="mt-2 text-[15px] font-semibold text-white">{t('evolutionValue')}</p>
        </div>
      </div>
    </div>
  );
}
