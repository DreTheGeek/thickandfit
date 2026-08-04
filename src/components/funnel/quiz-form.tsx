'use client';
// The 60-second waitlist quiz. Awards +2 entries once per lead and tags language + tier candidate.
// Kept tight per kb-funnels doctrine: five questions, one screen, no scroll on mobile keyboards.
// Idempotent server-side (unique on lead_id) so a re-submit updates the answers without a second
// credit. On success we bounce back to /join/thanks so the entry count refreshes visibly.
import { useMemo, useState, type FormEvent, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

type Goal = 'lose_fat' | 'build_muscle' | 'recomp' | 'strength' | 'feel_better' | 'nutrition';
type Where = 'home' | 'gym' | 'both';
type EatStyle = 'macros' | 'meal_plan' | 'intuitive' | 'not_sure';

type Status = 'idle' | 'submitting' | 'error';

const GOAL_KEYS: readonly { value: Goal; labelKey: string }[] = [
  { value: 'lose_fat', labelKey: 'quizGoalLose' },
  { value: 'build_muscle', labelKey: 'quizGoalMuscle' },
  { value: 'recomp', labelKey: 'quizGoalRecomp' },
  { value: 'strength', labelKey: 'quizGoalStrength' },
  { value: 'feel_better', labelKey: 'quizGoalFeel' },
  { value: 'nutrition', labelKey: 'quizGoalNutrition' },
];

const DAYS = [2, 3, 4, 5, 6];

export function QuizForm({ leadId, locale }: { leadId: string; locale: 'en' | 'es' }): ReactElement {
  const t = useTranslations('funnel');
  const router = useRouter();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [where, setWhere] = useState<Where | ''>('');
  const [days, setDays] = useState<number>(4);
  const [eat, setEat] = useState<EatStyle | ''>('');
  const [lang, setLang] = useState<'en' | 'es'>(locale);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => status !== 'submitting' && goals.length > 0 && where !== '' && eat !== '',
    [status, goals, where, eat],
  );

  function toggleGoal(g: Goal): void {
    setGoals((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!canSubmit || where === '' || eat === '') return;
    setStatus('submitting');
    setErrorMessage(null);
    try {
      const res = await fetch('/api/funnel/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          goal: goals,
          home_or_gym: where,
          days_per_week: days,
          how_they_eat: eat,
          preferred_language: lang,
        }),
      });
      if (res.status === 429) {
        setStatus('error');
        setErrorMessage(t('rateLimited'));
        return;
      }
      if (!res.ok) {
        setStatus('error');
        setErrorMessage(t('quizError'));
        return;
      }
      router.push('/join/thanks');
    } catch {
      setStatus('error');
      setErrorMessage(t('quizError'));
    }
  }

  const labelCls = 'block text-[12px] font-semibold uppercase tracking-[0.14em] text-white/70';
  const chipBase =
    'rounded-full border px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.10em] transition-colors';
  const chipOn = 'border-[#ff2d55] bg-[#ff2d55] text-[#0e0e0e]';
  const chipOff = 'border-white/20 bg-transparent text-white/85 hover:border-white/40';

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mx-auto w-full max-w-[640px]">
      {/* Goal: multi-select */}
      <fieldset className="mt-2">
        <legend className={labelCls}>{t('quizGoal')} *</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {GOAL_KEYS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => toggleGoal(g.value)}
              aria-pressed={goals.includes(g.value)}
              className={[chipBase, goals.includes(g.value) ? chipOn : chipOff].join(' ')}
            >
              {t(g.labelKey)}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Where: single-select */}
      <fieldset className="mt-7">
        <legend className={labelCls}>{t('quizWhere')} *</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['home', 'gym', 'both'] as const).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWhere(w)}
              aria-pressed={where === w}
              className={[chipBase, where === w ? chipOn : chipOff].join(' ')}
            >
              {w === 'home' ? t('quizWhereHome') : w === 'gym' ? t('quizWhereGym') : t('quizWhereBoth')}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Days per week: 2 through 6 */}
      <fieldset className="mt-7">
        <legend className={labelCls}>{t('quizDays')} *</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              aria-pressed={days === d}
              className={[chipBase, days === d ? chipOn : chipOff].join(' ')}
            >
              {d}
            </button>
          ))}
        </div>
      </fieldset>

      {/* How they eat */}
      <fieldset className="mt-7">
        <legend className={labelCls}>{t('quizEat')} *</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['macros', 'meal_plan', 'intuitive', 'not_sure'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setEat(v)}
              aria-pressed={eat === v}
              className={[chipBase, eat === v ? chipOn : chipOff].join(' ')}
            >
              {v === 'macros'
                ? t('quizEatMacros')
                : v === 'meal_plan'
                  ? t('quizEatPlan')
                  : v === 'intuitive'
                    ? t('quizEatIntuitive')
                    : t('quizEatNotSure')}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Coaching language */}
      <fieldset className="mt-7">
        <legend className={labelCls}>{t('quizLanguage')} *</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['en', 'es'] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              aria-pressed={lang === code}
              className={[chipBase, lang === code ? chipOn : chipOff].join(' ')}
            >
              {code === 'en' ? t('languageEn') : t('languageEs')}
            </button>
          ))}
        </div>
      </fieldset>

      {status === 'error' && errorMessage && (
        <p
          role="alert"
          className="mt-6 rounded-md border border-[#ff2d55]/50 bg-[#ff2d55]/10 px-4 py-3 text-[14px] text-white"
        >
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-8 block w-full rounded-full bg-[#ff2d55] px-9 py-4 text-center text-[15px] font-bold uppercase tracking-[0.02em] text-[#0e0e0e] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === 'submitting' ? t('quizSubmitting') : t('quizSubmit')}
      </button>
    </form>
  );
}
