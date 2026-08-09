// The daily total, shown TWICE and labelled: her stated target, and the sum of the five meals.
//
// This component is the reason the feature has a rule about it. Stephanie's PDF states
// "<1600 / 135 / 151 / 40". The five meals sum to 1555 / 134 / 151 / 39. Both are correct; hers is a
// deliberate round-up, and the "<" is an instruction, not an approximation. Rendering only the sum
// would silently correct a coach's own number on her own screen. Rendering only her figure would
// hide the arithmetic she is entitled to check. So: both, side by side, each one labelled with whose
// it is, and no warning icon, because there is nothing wrong here.
import type { ReactElement } from 'react';
import { COACH_COPY } from '@/lib/protocols/copy';
import type { MacroTotals, StatedTotals } from '@/lib/protocols/types';

function Figure({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="min-w-0">
      <div className="font-display text-[20px] leading-none text-ink">{value}</div>
      <div className="mt-1.5 text-[10px] uppercase tracking-[1px] text-faint">{label}</div>
    </div>
  );
}

function Column({
  heading,
  kcal,
  proteinG,
  carbG,
  fatG,
}: {
  heading: string;
  kcal: string;
  proteinG: number;
  carbG: number;
  fatG: number;
}): ReactElement {
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[1.5px] text-muted">{heading}</div>
      <div className="grid grid-cols-4 gap-3">
        <Figure label={COACH_COPY.kcal} value={kcal} />
        <Figure label={COACH_COPY.protein} value={`${proteinG}g`} />
        <Figure label={COACH_COPY.carbs} value={`${carbG}g`} />
        <Figure label={COACH_COPY.fat} value={`${fatG}g`} />
      </div>
    </div>
  );
}

export function ProtocolTotals({
  stated,
  summed,
}: {
  stated: StatedTotals;
  summed: MacroTotals;
}): ReactElement {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="tf-display mb-4 text-[18px] text-ink">{COACH_COPY.totalsTitle}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <Column
          heading={COACH_COPY.totalsStated}
          kcal={stated.kcalText}
          proteinG={stated.proteinG}
          carbG={stated.carbG}
          fatG={stated.fatG}
        />
        <Column
          heading={COACH_COPY.totalsSummed}
          kcal={summed.kcal.toLocaleString()}
          proteinG={summed.proteinG}
          carbG={summed.carbG}
          fatG={summed.fatG}
        />
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-faint">{COACH_COPY.totalsNote}</p>
    </section>
  );
}
