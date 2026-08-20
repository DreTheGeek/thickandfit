import type { ReactElement } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import type { Activation, ActivationStep } from '@/lib/member/activation';

// Day one, for a member whose program has not been written yet.
//
// WHAT THIS REPLACES, and why it mattered. The old state said "Your program's on the way. Your coach
// will assign your program soon." Nothing in the system made that true: no queue, no coach task, no
// reminder, no deadline. It was a promise with no delivery mechanism, and it bought her silence with
// her own patience during the exact week a fitness app is most likely to lose her.
//
// The fix is not better wording. It is to stop making waiting the activity. Everything below is
// something she can finish in the next ten minutes, in the order that actually compounds: food first
// because it moves the needle most and starts teaching the engine how she eats, then the baseline
// she will want to have taken, then the people.
//
// The program note stays, demoted to a footnote and phrased honestly. She should know it is coming
// and that a human is writing it. She should not be told to sit still until it does.

// COPY is ours; DONE comes from the database (lib/member/activation.ts). The step list used to live
// here as three hardcoded cards with no completion state at all, so a member who had logged forty
// meals and taken her starting photos was still told to go and do both. The playbook's rule is the
// fix: a stored "I did that" flag for something the database could answer is a lie waiting to
// happen, so nothing is stored and every tick is a live count.
const COPY: Record<ActivationStep['key'], { titleKey: string; bodyKey: string }> = {
  food: { titleKey: 'stepFoodTitle', bodyKey: 'stepFoodBody' },
  baseline: { titleKey: 'stepBaselineTitle', bodyKey: 'stepBaselineBody' },
  community: { titleKey: 'stepCommunityTitle', bodyKey: 'stepCommunityBody' },
};

export function FirstSteps({
  activation,
  hasStarterProgram = false,
}: {
  activation: Activation;
  /**
   * True when STARTER_PROGRAM_ID is set, so a plan was assigned at onboarding.
   *
   * The copy has to move with the flag. "Steph writes your plan by hand ... she will message you
   * when it is ready" is true today and becomes a half-truth the moment auto-assign is on, because
   * a plan is already sitting there. The honest version of the switched-on state is that this is a
   * starting week and Steph is personalising it, which is both true and a better promise than
   * silence. Threaded as a prop because STARTER_PROGRAM_ID is server-only by design.
   */
  hasStarterProgram?: boolean;
}): ReactElement {
  const t = useTranslations('app.firstSteps');

  return (
    <section className="flex flex-col gap-3 py-2">
      <div>
        <h3 className="font-display text-[22px] leading-tight text-ink">{t('title')}</h3>
        <p className="mt-1 max-w-[46ch] text-[14px] leading-relaxed text-soft">{t('subtitle')}</p>
        {activation.doneCount > 0 && (
          <p className="mt-2 text-[13px] font-semibold text-good-ink">
            {t('progress', { done: activation.doneCount, total: activation.steps.length })}
          </p>
        )}
      </div>

      <div className="mt-1 flex flex-col gap-2.5">
        {activation.steps.map((s, i) => {
          const copy = COPY[s.key];
          return (
            <Link
              key={s.key}
              href={s.href}
              className={`tf-press flex items-start gap-3.5 rounded-[14px] border px-4 py-3.5 ${
                s.done ? 'border-line/60 bg-surface/60' : 'border-line bg-surface hover:border-ink'
              }`}
            >
              {/* Numbered because these compound in order, not because a list needs decoration.
                  A done step keeps its number rather than being struck through or removed: she
                  should be able to see the whole shape of the start, including the part she has
                  already finished. Green is the functional signal for complete, nothing else. */}
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                  s.done ? 'bg-good text-good-ink' : 'bg-ink text-surface'
                }`}
              >
                {s.done ? <Icon name="check" size={13} /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className={`block text-[15px] font-semibold ${s.done ? 'text-muted' : 'text-ink'}`}>
                  {t(copy.titleKey)}
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-soft">
                  {s.done ? t(`${s.key}Done` as never) : t(copy.bodyKey)}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      {/* Demoted to a footnote, and honest: a person is writing it, so it is not instant. The old
          copy implied an imminent arrival that nothing scheduled. */}
      <p className="mt-1.5 border-t border-line pt-3 text-[13px] leading-relaxed text-faint">
        {t(hasStarterProgram ? 'programNoteStarter' : 'programNote')}
      </p>
    </section>
  );
}
