'use client';
// Onboarding wizard: Goal -> About -> Prediction (live chart) -> Plan, re-skinned to
// the design-handoff prototype. Same engine the API stores; weight collected in lb,
// converted to kg for the metric prediction engine.
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { computePlan, type OnboardingInput } from '@/lib/onboarding/prediction';
import { Button, ButtonLink } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/ring';
import { Icon } from '@/components/ui/icons';

const LB_PER_KG = 2.20462;
const TOTAL = 4;

type Goal = OnboardingInput['goal'];
type Activity = OnboardingInput['activity'];

export function OnboardingFlow(): ReactElement {
  const t = useTranslations('app.onboarding');
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const [goal, setGoal] = useState<Goal>('lose');
  const [sex, setSex] = useState<OnboardingInput['sex']>('female');
  const [age, setAge] = useState(30);
  const [heightCm, setHeightCm] = useState(165);
  const [weightLbs, setWeightLbs] = useState(180);
  const [goalLbs, setGoalLbs] = useState(150);
  const [activity, setActivity] = useState<Activity>('moderate');

  const input: OnboardingInput = useMemo(
    () => ({
      sex,
      age,
      heightCm,
      weightKg: Math.round(weightLbs / LB_PER_KG),
      goalWeightKg: Math.round(goalLbs / LB_PER_KG),
      activity,
      goal,
    }),
    [sex, age, heightCm, weightLbs, goalLbs, activity, goal],
  );
  const plan = useMemo(() => computePlan(input), [input]);
  const chart = useMemo<CurvePoint[]>(
    () => plan.curve.map((p) => ({ week: p.week, lb: Math.round(p.weightKg * LB_PER_KG) })),
    [plan],
  );

  async function submit(): Promise<void> {
    setBusy(true);
    setSaveError(false);
    try {
      const res = await fetch('/api/onboarding/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        // Do NOT advance to the "plan ready" screen on a failed save, or the user sees a plan that
        // was never persisted and the dashboard re-prompts them to onboard (a confusing loop).
        setSaveError(true);
        return;
      }
      setStep(3);
    } catch {
      setSaveError(true);
    } finally {
      setBusy(false);
    }
  }

  const selectCls =
    'w-full border border-line bg-surface px-3.5 py-3 text-[14px] text-ink outline-none focus:border-ink';
  const numCls = selectCls;

  return (
    <div className="flex min-h-[calc(100vh-1px)] flex-col px-[28px] pb-7 pt-6">
      {/* Progress */}
      <ProgressBar pct={((step + 1) / TOTAL) * 100} color="var(--color-ink)" height={4} />
      <div className="mb-6 mt-2 text-[12px] text-faint">
        {t('stepOf', { step: step + 1, total: TOTAL })}
      </div>

      {/* Step 0: Goal */}
      {step === 0 && (
        <>
          <h2 className="tf-display mb-6 text-[38px]">{t('goalTitle')}</h2>
          <div className="flex flex-col gap-3">
            <GoalCard label={t('goalLose')} active={goal === 'lose'} onClick={() => setGoal('lose')} />
            <GoalCard label={t('goalGain')} active={goal === 'gain'} onClick={() => setGoal('gain')} />
            <GoalCard
              label={t('goalMaintain')}
              active={goal === 'maintain'}
              onClick={() => setGoal('maintain')}
            />
          </div>
        </>
      )}

      {/* Step 1: About */}
      {step === 1 && (
        <>
          <h2 className="tf-display mb-6 text-[38px]">{t('aboutTitle')}</h2>
          <div className="flex flex-col gap-3.5">
            <Field label={t('sex')}>
              <select className={selectCls} value={sex} onChange={(e) => setSex(e.target.value as OnboardingInput['sex'])}>
                <option value="female">{t('female')}</option>
                <option value="male">{t('male')}</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('age')}>
                <input type="number" className={numCls} value={age} onChange={(e) => setAge(Number(e.target.value))} />
              </Field>
              <Field label={t('heightCm')}>
                <input type="number" className={numCls} value={heightCm} onChange={(e) => setHeightCm(Number(e.target.value))} />
              </Field>
              <Field label={t('weightLbs')}>
                <input type="number" className={numCls} value={weightLbs} onChange={(e) => setWeightLbs(Number(e.target.value))} />
              </Field>
              <Field label={t('goalWeightLbs')}>
                <input type="number" className={numCls} value={goalLbs} onChange={(e) => setGoalLbs(Number(e.target.value))} />
              </Field>
            </div>
            <Field label={t('activity')}>
              <select className={selectCls} value={activity} onChange={(e) => setActivity(e.target.value as Activity)}>
                <option value="sedentary">{t('actSedentary')}</option>
                <option value="light">{t('actLight')}</option>
                <option value="moderate">{t('actModerate')}</option>
                <option value="active">{t('actActive')}</option>
                <option value="very_active">{t('actVeryActive')}</option>
              </select>
            </Field>
          </div>
        </>
      )}

      {/* Step 2: Prediction */}
      {step === 2 && (
        <>
          <h2 className="tf-display mb-5 text-[34px]">{t('predictTitle')}</h2>
          <div className="rounded-[18px] bg-warm p-[22px]">
            <div className="w-full">
              <PredictionChart data={chart} goalLb={Math.round(goalLbs)} />
            </div>
            <div className="mt-1.5 flex justify-between text-[12px] text-muted">
              <span>
                {t('now')} · {weightLbs} lb
              </span>
              <span>
                {t('goal')} · {goalLbs} lb
              </span>
            </div>
          </div>
          <p className="mt-5 text-[14px] leading-[1.6] text-soft">{t('predictNote')}</p>
        </>
      )}

      {/* Step 3: Plan */}
      {step === 3 && (
        <>
          <h2 className="tf-display text-[40px]">{t('planTitle')}</h2>
          <p className="mb-1 mt-3 text-[14px] leading-[1.5] text-soft">{t('planSub')}</p>
          <div className="my-5 flex items-baseline gap-2">
            <span className="font-display text-[44px] leading-none">{plan.calories}</span>
            <span className="text-[13px] text-faint">{t('calories')}</span>
          </div>
          <div className="mb-1 text-[13px] text-muted">
            P{plan.macros.protein_g} · C{plan.macros.carbs_g} · F{plan.macros.fat_g} g
          </div>
          <div className="mt-5 flex flex-col gap-px overflow-hidden rounded-2xl border border-divider bg-divider">
            <PlanRow label={t('planProgram')} value={t('planProgramV')} />
            <PlanRow label={t('planMacros')} value={`${plan.calories} kcal · P${plan.macros.protein_g}`} />
            <PlanRow label={t('planCheck')} value={t('planCheckV')} />
          </div>
        </>
      )}

      {step === 2 && saveError && (
        <p role="alert" className="mt-5 text-[13px] leading-[1.5] text-red-500">
          {t('saveError')}
        </p>
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center gap-3 pt-8">
        {step > 0 && step < 3 && (
          <Button variant="outline" size="md" onClick={() => setStep((s) => s - 1)}>
            {t('back')}
          </Button>
        )}
        {step < 2 && (
          <Button size="block" onClick={() => setStep((s) => s + 1)}>
            {t('continue')}
          </Button>
        )}
        {step === 2 && (
          <Button size="block" disabled={busy} onClick={submit}>
            {busy ? '…' : t('seePlan')}
          </Button>
        )}
        {step === 3 && (
          <ButtonLink href="/checkout" size="block">
            {t('toCheckout')}
          </ButtonLink>
        )}
      </div>
    </div>
  );
}

function GoalCard({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'tf-press flex items-center justify-between rounded-[14px] p-[18px] text-left text-[15px] font-semibold',
        active ? 'border-[1.5px] border-ink' : 'border border-line text-soft',
      ].join(' ')}
    >
      {label}
      {active ? (
        <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-ink text-bg">
          <Icon name="check" size={11} strokeWidth={2.6} />
        </span>
      ) : (
        <span className="h-[18px] w-[18px] rounded-full border border-line" />
      )}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactElement }): ReactElement {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] text-muted">{label}</span>
      {children}
    </label>
  );
}

function PlanRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="bg-surface p-[18px]">
      <div className="text-[12px] uppercase tracking-[1px] text-faint">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

type CurvePoint = { week: number; lb: number };

// Pure-SVG weight-prediction line chart. recharts renders blank on React 19, so this scales
// via viewBox with no JS measurement. Dashed olive line marks the goal weight.
function PredictionChart({ data, goalLb }: { data: CurvePoint[]; goalLb: number }): ReactElement {
  const W = 320;
  const H = 150;
  const padL = 30;
  const padR = 10;
  const padT = 10;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = data.length;
  const values = [...data.map((d) => d.lb), goalLb];
  const min = Math.min(...values) - 4;
  const max = Math.max(...values) + 4;
  const span = Math.max(1, max - min);
  const x = (i: number): number => (n <= 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW);
  const y = (v: number): number => padT + plotH - ((v - min) / span) * plotH;
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.lb).toFixed(1)}`).join(' ');
  const ticks = [min, (min + max) / 2, max];
  const labelEvery = Math.max(1, Math.ceil(n / 6));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" preserveAspectRatio="xMidYMid meet" role="img">
      {ticks.map((tk, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(tk)} y2={y(tk)} stroke="var(--color-divider)" strokeWidth={1} />
          <text x={padL - 6} y={y(tk) + 3} textAnchor="end" fontSize="9" fill="var(--color-faint)">
            {Math.round(tk)}
          </text>
        </g>
      ))}

      <line
        x1={padL}
        x2={W - padR}
        y1={y(goalLb)}
        y2={y(goalLb)}
        stroke="#5EBE62"
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />
      <path d={line} fill="none" stroke="#0f0f0f" strokeWidth={2.5} />

      {data.map((d, i) =>
        i % labelEvery === 0 || i === n - 1 ? (
          <text key={`w${i}`} x={x(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--color-faint)">
            {d.week}
          </text>
        ) : null,
      )}
    </svg>
  );
}
