'use client';
// Onboarding wizard, PRE-PAYWALL half: Goals -> About -> Health & safety -> Prediction (live chart)
// -> Tier -> Plan. Re-skinned to the design-handoff prototype. Same engine the API stores; weight
// collected in lb, converted to kg for the metric prediction engine.
//
// Pre/post-paywall split (2026-07-23 call): everything needed to BUILD the plan and train safely is
// asked before the paywall - body stats, body fat, phone, and the health/safety screen. The deeper
// intake (dietary, equipment, meds, sleep/stress, relationship with food, photos, measurements) lives
// post-paywall at /you/health, so a prospect is not interrogated before they have seen their plan.
//
// The health step deliberately renders through the `app.health` namespace rather than new onboarding
// keys: /you/health already ships EN + ES for every slug, and duplicating them is how the two screens
// drift into asking the same question two different ways.
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { Dispatch, ReactElement, ReactNode, SetStateAction } from 'react';
import { setUiLocaleAction, setContentLocaleAction } from '@/lib/i18n/actions';
import { computePlan, type OnboardingInput } from '@/lib/onboarding/prediction';
import { PRIMARY_GOALS, deriveGoalDirection, type PrimaryGoal } from '@/lib/onboarding/goals';
import {
  INJURIES,
  CONDITIONS,
  PREGNANCY,
  SAFETY,
  EXPERIENCE,
  TRAINING_LOCATION,
} from '@/lib/health-profile/labels';
import { Button, ButtonLink } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/ring';
import { Icon } from '@/components/ui/icons';

const LB_PER_KG = 2.20462;
const TOTAL = 6;
// Step indices, named so the footer/guard logic reads as intent instead of magic numbers. Adding a
// step used to mean hunting every bare `step === 3` in the footer; that is how the submit button
// ends up on the wrong screen.
const S_GOALS = 0;
const S_ABOUT = 1;
const S_HEALTH = 2;
const S_PREDICT = 3;
const S_TIER = 4;
const S_PLAN = 5;

type Activity = OnboardingInput['activity'];
// Coaching tier chosen at onboarding (call 2026-07-01). Captured as intent; checkout maps it to a
// Stripe price once billing is live. 'team' = coached by Steph's team (Dani), not Steph one-on-one.
type Tier = 'self' | 'team' | 'steph';

export function OnboardingFlow({
  initialFirstName = '',
  initialLastName = '',
}: {
  initialFirstName?: string;
  initialLastName?: string;
}): ReactElement {
  const t = useTranslations('app.onboarding');
  // Second namespace: the health/safety step reuses the /you/health copy verbatim (EN + ES already
  // authored there) so the two screens can never ask the same question two different ways.
  const th = useTranslations('app.health');
  const locale = useLocale();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // Language the user speaks -> persisted to their profile + cookie so the app loads in it on login.
  const [language, setLanguage] = useState<'en' | 'es'>(locale === 'es' ? 'es' : 'en');

  // Picking a language must flip the wizard itself, immediately: persist the cookie server-side and
  // refresh the RSC payload so every t() re-renders in the chosen language. Client state (step,
  // answers) survives the refresh, so the user stays exactly where they were.
  function chooseLanguage(next: 'en' | 'es'): void {
    setLanguage(next);
    if (next === locale) return;
    startTransition(async () => {
      await setUiLocaleAction(next);
      await setContentLocaleAction(next);
      router.refresh();
    });
  }
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  // Phone is pre-paywall: Twilio launch-week support and the founding-window texts both need it, and
  // asking after checkout means the members who need help most are the ones we cannot reach.
  const [phone, setPhone] = useState('');
  // Multi-select. The calorie direction is derived from it below, never asked separately.
  const [primaryGoals, setPrimaryGoals] = useState<PrimaryGoal[]>(['lose_fat']);
  const [sex, setSex] = useState<OnboardingInput['sex']>('female');
  const [age, setAge] = useState(30);
  // Units: imperial (lb + ft/in) or metric (kg + cm). Default from locale; ES -> metric.
  const [units, setUnits] = useState<'imperial' | 'metric'>(locale === 'es' ? 'metric' : 'imperial');
  const [heightCm, setHeightCm] = useState(168);
  const [heightFt, setHeightFt] = useState(5);
  const [heightIn, setHeightIn] = useState(6);
  const [weightVal, setWeightVal] = useState(locale === 'es' ? 75 : 165); // in the selected unit
  const [goalVal, setGoalVal] = useState(locale === 'es' ? 64 : 140);
  const [activity, setActivity] = useState<Activity>('moderate');
  const [tier, setTier] = useState<Tier>('self');
  // Body fat as a free-text string, not a number: an empty box must stay empty. Binding a number
  // input to 0 would show a "0" the member has to delete, and 0 is a value the schema would reject.
  const [bodyFat, setBodyFat] = useState('');

  // Health & safety (pre-paywall). Slugs are the same ones /you/health writes, so the post-paywall
  // form loads these back pre-filled instead of asking again.
  const [injuries, setInjuries] = useState<string[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);
  const [pregnancy, setPregnancy] = useState<string>('none');
  const [safety, setSafety] = useState<string[]>([]);
  // Training experience + where they train. On the About step rather than the health step: they are
  // TRAINING questions, and both decide whether the plan preview two screens later is executable.
  // One tap each, and both are already asked in the waitlist quiz, so a lead answers nothing new.
  const [experience, setExperience] = useState<string>('some');
  const [trainingLocation, setTrainingLocation] = useState<string>('both');
  const safetyFlagged = safety.length > 0;

  // Functional updater, NOT `set(list.filter(...))`. React batches updates, so two chip taps inside
  // one batch would both read the same stale array and the second would silently discard the first.
  // Caught in prod QA: tapping Knees then Lower back fast persisted only Lower back.
  function toggle(set: Dispatch<SetStateAction<string[]>>, value: string): void {
    set((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }
  function toggleGoal(value: PrimaryGoal): void {
    setPrimaryGoals((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  // Convert displayed values when switching units so nothing is lost or misread.
  function switchUnits(next: 'imperial' | 'metric'): void {
    if (next === units) return;
    if (next === 'metric') {
      setWeightVal(Math.round(weightVal / LB_PER_KG));
      setGoalVal(Math.round(goalVal / LB_PER_KG));
      setHeightCm(Math.round((heightFt * 12 + heightIn) * 2.54));
    } else {
      setWeightVal(Math.round(weightVal * LB_PER_KG));
      setGoalVal(Math.round(goalVal * LB_PER_KG));
      const totalIn = Math.round(heightCm / 2.54);
      setHeightFt(Math.floor(totalIn / 12));
      setHeightIn(totalIn % 12);
    }
    setUnits(next);
  }

  const heightCmCanonical = units === 'metric' ? heightCm : Math.round((heightFt * 12 + heightIn) * 2.54);
  const weightKg = units === 'metric' ? weightVal : weightVal / LB_PER_KG;
  const goalKg = units === 'metric' ? goalVal : goalVal / LB_PER_KG;

  // Client-side bounds mirroring onboardingInputSchema, so a plan is never computed from impossible
  // numbers (a mistyped height/weight/age). Step 1 collects name + these body fields.
  const bodyValid =
    age >= 13 && age <= 100 &&
    heightCmCanonical >= 100 && heightCmCanonical <= 250 &&
    weightKg >= 30 && weightKg <= 300;
  // Body fat: blank is fine, but a typed value must be in range or the submit would 400 after the
  // member has already sat through the whole wizard.
  const bodyFatNum = bodyFat.trim() === '' ? null : Number(bodyFat);
  const bodyFatValid =
    bodyFatNum === null || (Number.isFinite(bodyFatNum) && bodyFatNum >= 3 && bodyFatNum <= 70);
  const step1Valid =
    firstName.trim() !== '' && lastName.trim() !== '' && bodyValid && bodyFatValid;
  // At least one goal, or the derived direction is a silent guess.
  const goalsValid = primaryGoals.length > 0;

  const goal = useMemo(() => deriveGoalDirection(primaryGoals), [primaryGoals]);
  // True when the derived direction holds weight steady but the member asked for a different number
  // on the scale, i.e. recomposition. Drives the explainer on the prediction step.
  const isRecomp = goal === 'maintain' && Math.round(goalKg) !== Math.round(weightKg);

  const input: OnboardingInput = useMemo(
    () => ({
      sex,
      age,
      heightCm: heightCmCanonical,
      weightKg: Math.round(weightKg),
      goalWeightKg: Math.round(goalKg),
      activity,
      goal,
      ...(bodyFatNum !== null && bodyFatValid ? { bodyFatPct: bodyFatNum } : {}),
    }),
    [sex, age, heightCmCanonical, weightKg, goalKg, activity, goal, bodyFatNum, bodyFatValid],
  );
  const plan = useMemo(() => computePlan(input), [input]);
  // Chart points in the user's display unit.
  const unitLabel = units === 'metric' ? 'kg' : 'lb';
  const chart = useMemo<CurvePoint[]>(
    () =>
      plan.curve.map((p) => ({
        week: p.week,
        val: units === 'metric' ? Math.round(p.weightKg) : Math.round(p.weightKg * LB_PER_KG),
      })),
    [plan, units],
  );

  async function submit(): Promise<void> {
    setBusy(true);
    setSaveError(false);
    try {
      const res = await fetch('/api/onboarding/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...input,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          language,
          tier,
          primaryGoals,
          phone: phone.trim() || undefined,
          // Health & safety. Sent as one object so the route can hand it straight to
          // saveHealthProfile without re-assembling it field by field.
          health: {
            injuries,
            conditions,
            pregnancy,
            safety,
            trainingExperience: experience,
            trainingLocation,
          },
        }),
      });
      if (!res.ok) {
        // Do NOT advance to the "plan ready" screen on a failed save, or the user sees a plan that
        // was never persisted and the dashboard re-prompts them to onboard (a confusing loop).
        setSaveError(true);
        return;
      }
      setStep(S_PLAN);
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

      {/* Step 0: Language + primary goals (multi-select) */}
      {step === S_GOALS && (
        <>
          <div className="mb-7">
            <p className="mb-2.5 text-[13px] font-semibold text-muted">{t('languageQuestion')}</p>
            <div className="flex gap-2.5">
              <LangBtn label="English" active={language === 'en'} onClick={() => chooseLanguage('en')} />
              <LangBtn label="Español" active={language === 'es'} onClick={() => chooseLanguage('es')} />
            </div>
          </div>
          <h2 className="tf-display mb-2 text-[38px]">{t('goalTitle')}</h2>
          <p className="mb-6 text-[14px] leading-[1.5] text-soft">{t('goalSub')}</p>
          <div className="flex flex-col gap-3">
            {PRIMARY_GOALS.map((g) => (
              <GoalCard
                key={g}
                label={t(`goal_${g}`)}
                active={primaryGoals.includes(g)}
                onClick={() => toggleGoal(g)}
              />
            ))}
          </div>
        </>
      )}

      {/* Step 1: About */}
      {step === S_ABOUT && (
        <>
          <h2 className="tf-display mb-6 text-[38px]">{t('aboutTitle')}</h2>
          <div className="flex flex-col gap-3.5">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('firstName')}>
                <input
                  type="text"
                  autoComplete="given-name"
                  className={selectCls}
                  placeholder={t('firstNamePlaceholder')}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </Field>
              <Field label={t('lastName')}>
                <input
                  type="text"
                  autoComplete="family-name"
                  className={selectCls}
                  placeholder={t('lastNamePlaceholder')}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </Field>
            </div>
            <Field label={t('phone')}>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className={selectCls}
                placeholder={t('phonePlaceholder')}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <span className="mt-1.5 block text-[11px] leading-[1.45] text-faint">{t('phoneHint')}</span>
            </Field>
            <Field label={t('sex')}>
              <select className={selectCls} value={sex} onChange={(e) => setSex(e.target.value as OnboardingInput['sex'])}>
                <option value="female">{t('female')}</option>
                <option value="male">{t('male')}</option>
              </select>
            </Field>
            <Field label={t('units')}>
              <div className="flex gap-2.5">
                <PillBtn label={t('imperial')} active={units === 'imperial'} onClick={() => switchUnits('imperial')} />
                <PillBtn label={t('metric')} active={units === 'metric'} onClick={() => switchUnits('metric')} />
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('age')}>
                <input type="number" className={numCls} value={age} onChange={(e) => setAge(Number(e.target.value))} />
              </Field>
              {units === 'metric' ? (
                <Field label={t('heightCm')}>
                  <input type="number" className={numCls} value={heightCm} onChange={(e) => setHeightCm(Number(e.target.value))} />
                </Field>
              ) : (
                <Field label={t('heightFtIn')}>
                  <div className="flex gap-2">
                    <input type="number" aria-label="ft" className={numCls} value={heightFt} onChange={(e) => setHeightFt(Number(e.target.value))} />
                    <input type="number" aria-label="in" className={numCls} value={heightIn} onChange={(e) => setHeightIn(Number(e.target.value))} />
                  </div>
                </Field>
              )}
              <Field label={units === 'metric' ? t('weightKg') : t('weightLbs')}>
                <input type="number" className={numCls} value={weightVal} onChange={(e) => setWeightVal(Number(e.target.value))} />
              </Field>
              <Field label={units === 'metric' ? t('goalWeightKg') : t('goalWeightLbs')}>
                <input type="number" className={numCls} value={goalVal} onChange={(e) => setGoalVal(Number(e.target.value))} />
              </Field>
              <Field label={t('bodyFat')}>
                <input
                  type="number"
                  inputMode="decimal"
                  className={numCls}
                  placeholder={t('bodyFatPlaceholder')}
                  value={bodyFat}
                  onChange={(e) => setBodyFat(e.target.value)}
                />
              </Field>
            </div>
            {bodyFat.trim() !== '' && !bodyFatValid && (
              <p role="alert" className="text-[12px] leading-[1.45] text-alert-ink">
                {t('bodyFatRange')}
              </p>
            )}
            <Field label={t('activity')}>
              <select className={selectCls} value={activity} onChange={(e) => setActivity(e.target.value as Activity)}>
                <option value="sedentary">{t('actSedentary')}</option>
                <option value="light">{t('actLight')}</option>
                <option value="moderate">{t('actModerate')}</option>
                <option value="active">{t('actActive')}</option>
                <option value="very_active">{t('actVeryActive')}</option>
              </select>
            </Field>
            <Field label={th('sec.experience.q')}>
              <select
                className={selectCls}
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
              >
                {EXPERIENCE.map((x) => (
                  <option key={x} value={x}>
                    {th(`opt.experience.${x}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={th('sec.trainingLocation.q')}>
              <select
                className={selectCls}
                value={trainingLocation}
                onChange={(e) => setTrainingLocation(e.target.value)}
              >
                {TRAINING_LOCATION.map((x) => (
                  <option key={x} value={x}>
                    {th(`opt.trainingLocation.${x}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </>
      )}

      {/* Step 2: Health & safety. Pre-paywall because the plan on the next screen is a TRAINING
          prescription: injuries change the exercise selection, the hormonal picture changes the
          nutrition, and the PAR-Q+ screen is the difference between coaching someone and coaching
          someone who should see a doctor first. Asking it after checkout means the first plan we
          hand a member is one built without it. */}
      {step === S_HEALTH && (
        <>
          <h2 className="tf-display mb-2 text-[34px]">{t('healthTitle')}</h2>
          <p className="mb-1 text-[14px] leading-[1.55] text-soft">{t('healthSub')}</p>
          <p className="mb-7 text-[12px] text-faint">{th('privacy')}</p>

          <div className="flex flex-col gap-7">
            <HealthSection title={th('sec.injuries.q')}>
              <ChipRow
                options={INJURIES}
                selected={injuries}
                onToggle={(v) => toggle(setInjuries, v)}
                label={(v) => th(`opt.injuries.${v}`)}
                noneLabel={th('none')}
                onNone={() => setInjuries([])}
              />
            </HealthSection>

            <HealthSection title={th('sec.conditions.q')} why={th('sec.conditions.why')}>
              <ChipRow
                options={CONDITIONS}
                selected={conditions}
                onToggle={(v) => toggle(setConditions, v)}
                label={(v) => th(`opt.conditions.${v}`)}
                noneLabel={th('none')}
                onNone={() => setConditions([])}
              />
            </HealthSection>

            <HealthSection title={th('sec.pregnancy.q')}>
              <ChipRow
                options={PREGNANCY}
                selected={[pregnancy]}
                onToggle={(v) => setPregnancy(v)}
                label={(v) => th(`opt.pregnancy.${v}`)}
              />
            </HealthSection>

            <HealthSection title={th('sec.safety.q')} why={th('sec.safety.why')}>
              <ChipRow
                options={SAFETY}
                selected={safety}
                onToggle={(v) => toggle(setSafety, v)}
                label={(v) => th(`opt.safety.${v}`)}
                noneLabel={th('safetyNone')}
                onNone={() => setSafety([])}
              />
              {safetyFlagged && (
                <p className="mt-1 rounded-[12px] bg-warm px-4 py-3 text-[13px] leading-[1.5] text-soft">
                  {th('sec.safety.note')}
                </p>
              )}
            </HealthSection>
          </div>
        </>
      )}

      {/* Step 3: Prediction */}
      {step === S_PREDICT && (
        <>
          <h2 className="tf-display mb-5 text-[34px]">{t('predictTitle')}</h2>
          <div className="rounded-[18px] bg-warm p-[22px]">
            <div className="w-full">
              <PredictionChart data={chart} goal={Math.round(goalVal)} unit={unitLabel} />
            </div>
            <div className="mt-1.5 flex justify-between text-[12px] text-muted">
              <span>
                {t('now')} · {Math.round(weightVal)} {unitLabel}
              </span>
              <span>
                {t('goal')} · {Math.round(goalVal)} {unitLabel}
              </span>
            </div>
          </div>
          {/* Recomposition needs saying out loud. Someone who picked BOTH lose fat and build muscle
              derives to `maintain`, so the projection line is deliberately FLAT while their goal
              weight sits below it. Unexplained, that reads as "you will never get there" at the exact
              moment we are asking them to trust the plan. */}
          {isRecomp && (
            <p className="mt-5 rounded-[12px] bg-warm px-4 py-3 text-[14px] leading-[1.55] text-soft">
              {t('predictRecompNote')}
            </p>
          )}
          <p className="mt-5 text-[14px] leading-[1.6] text-soft">{t('predictNote')}</p>
        </>
      )}

      {/* Step 4: Coaching tier (Self-Guided / Team Thick & Fit / 1-on-1 with Coach Steph) */}
      {step === S_TIER && (
        <>
          <h2 className="tf-display mb-2 text-[34px]">{t('tierTitle')}</h2>
          <p className="mb-6 text-[14px] leading-[1.5] text-soft">{t('tierSub')}</p>
          <div className="flex flex-col gap-3">
            <TierCard
              name={t('tierSelfName')}
              price={t('tierSelfPrice')}
              blurb={t('tierSelfBlurb')}
              active={tier === 'self'}
              onClick={() => setTier('self')}
            />
            <TierCard
              name={t('tierTeamName')}
              price={t('tierTeamPrice')}
              blurb={t('tierTeamBlurb')}
              active={tier === 'team'}
              onClick={() => setTier('team')}
            />
            <TierCard
              name={t('tierStephName')}
              price={t('tierStephPrice')}
              blurb={t('tierStephBlurb')}
              active={tier === 'steph'}
              onClick={() => setTier('steph')}
            />
          </div>
          <p className="mt-4 text-[12px] leading-[1.5] text-faint">{t('tierTrialNote')}</p>
        </>
      )}

      {/* Step 5: Plan */}
      {step === S_PLAN && (
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
          {/* Hand-off into the POST-paywall half of the intake. Injuries, conditions, pregnancy and
              the safety screen are already captured above, so this CTA is for what is left: foods
              avoided, equipment, meds, sleep/stress, relationship with food. Skippable (the footer
              still goes straight to the dashboard). */}
          <div className="mt-6 rounded-[16px] border border-line p-[18px]">
            <div className="flex items-center gap-2">
              <span className="text-ink"><Icon name="heart" size={16} strokeWidth={2.2} /></span>
              <h3 className="text-[15px] font-semibold">{t('healthCtaTitle')}</h3>
            </div>
            <p className="mb-4 mt-1.5 text-[13px] leading-[1.5] text-soft">{t('healthCtaBody')}</p>
            <ButtonLink href="/you/health" size="block">
              {t('healthCtaBtn')}
            </ButtonLink>
          </div>
        </>
      )}

      {step === S_TIER && saveError && (
        <p role="alert" className="mt-5 text-[13px] leading-[1.5] text-alert-ink">
          {t('saveError')}
        </p>
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center gap-3 pt-8">
        {step > S_GOALS && step < S_PLAN && (
          <Button variant="outline" size="md" onClick={() => setStep((s) => s - 1)}>
            {t('back')}
          </Button>
        )}
        {step < S_TIER && (
          <Button
            size="block"
            disabled={(step === S_GOALS && !goalsValid) || (step === S_ABOUT && !step1Valid)}
            onClick={() => setStep((s) => s + 1)}
          >
            {t('continue')}
          </Button>
        )}
        {step === S_TIER && (
          <Button size="block" disabled={busy} onClick={submit}>
            {busy ? '…' : t('seePlan')}
          </Button>
        )}
        {step === S_PLAN && (
          // Onboarding is already persisted (the tier-step submit), so the user is fully onboarded. Send
          // them INTO the app. /checkout is a real paywall page now, but requireEntitled deliberately
          // does not gate while Stripe is unconfigured (guards.ts), so this path stays alive pre-launch
          // and pay-to-enter turns on automatically when the live keys land.
          <ButtonLink href="/dashboard" size="block">
            {t('toDashboard')}
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

// Coaching-tier card: name + price on top, one-line blurb below, single-select like the goal cards.
function TierCard({
  name,
  price,
  blurb,
  active,
  onClick,
}: {
  name: string;
  price: string;
  blurb: string;
  active: boolean;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'tf-press rounded-[14px] p-[18px] text-left',
        active ? 'border-[1.5px] border-ink' : 'border border-line',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold">{name}</div>
          <div className="mt-0.5 font-display text-[18px] leading-none">{price}</div>
        </div>
        {active ? (
          <span className="mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full bg-ink text-bg">
            <Icon name="check" size={11} strokeWidth={2.6} />
          </span>
        ) : (
          <span className="mt-0.5 h-[18px] w-[18px] flex-none rounded-full border border-line" />
        )}
      </div>
      <p className="mt-2 text-[13px] leading-[1.5] text-soft">{blurb}</p>
    </button>
  );
}

// ReactNode, not ReactElement: some fields render an input plus a hint line beneath it.
function Field({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] text-muted">{label}</span>
      {children}
    </label>
  );
}

// One health question. Mirrors the /you/health Section visually without the numbered marker: this
// step has four questions inside a six-step wizard, and a second number sequence would read as
// progress the member does not actually have.
function HealthSection({
  title,
  why,
  children,
}: {
  title: string;
  why?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div>
      <h3 className="mb-1 text-[15px] font-semibold leading-[1.4]">{title}</h3>
      {why ? <p className="mb-3 text-[12px] leading-[1.5] text-faint">{why}</p> : <div className="mb-3" />}
      {children}
    </div>
  );
}

// Multi- or single-select chips. `selected` drives the active state, so passing a single-item array
// (as the pregnancy question does) makes it behave as a radio group. `onNone` renders the explicit
// "None" escape hatch: without it, leaving a health question blank is ambiguous between "nothing
// applies to me" and "I skipped this", and the coach cannot tell those apart.
function ChipRow({
  options,
  selected,
  onToggle,
  label,
  noneLabel,
  onNone,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
  label: (value: string) => string;
  noneLabel?: string;
  onNone?: () => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip key={o} label={label(o)} active={selected.includes(o)} onClick={() => onToggle(o)} />
      ))}
      {noneLabel && onNone && (
        <Chip label={noneLabel} active={selected.length === 0} onClick={onNone} />
      )}
    </div>
  );
}

function Chip({
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
      aria-pressed={active}
      onClick={onClick}
      className={[
        'tf-press rounded-full px-3.5 py-2 text-[13px] leading-none transition',
        active ? 'border-[1.5px] border-ink font-semibold text-ink' : 'border border-line text-soft',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

// Pill toggle, reused for language (English/Español) and units (Imperial/Metric).
function PillBtn({
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
        'tf-press flex-1 rounded-[12px] px-4 py-2.5 text-[14px] font-semibold transition',
        active ? 'border-[1.5px] border-ink text-ink' : 'border border-line text-soft',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
const LangBtn = PillBtn;

function PlanRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="bg-surface p-[18px]">
      <div className="text-[12px] uppercase tracking-[1px] text-faint">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

type CurvePoint = { week: number; val: number };

// Pure-SVG weight-prediction line chart. recharts renders blank on React 19, so this scales
// via viewBox with no JS measurement. Dashed olive line marks the goal weight. `val`/`goal` are in
// the user's display unit (kg or lb).
function PredictionChart({ data, goal }: { data: CurvePoint[]; goal: number; unit: string }): ReactElement {
  const W = 320;
  const H = 150;
  const padL = 30;
  const padR = 10;
  const padT = 10;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = data.length;
  const values = [...data.map((d) => d.val), goal];
  const min = Math.min(...values) - 4;
  const max = Math.max(...values) + 4;
  const span = Math.max(1, max - min);
  const x = (i: number): number => (n <= 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW);
  const y = (v: number): number => padT + plotH - ((v - min) / span) * plotH;
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.val).toFixed(1)}`).join(' ');
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
        y1={y(goal)}
        y2={y(goal)}
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
