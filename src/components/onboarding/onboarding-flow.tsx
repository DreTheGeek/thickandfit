'use client';
// Onboarding intake with a LIVE weight-prediction chart that recomputes as the client answers
// (AC-1), then a plan preview + checkout CTA (AC-3). Math is the same engine the API stores.
import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { computePlan, type OnboardingInput } from '@/lib/onboarding/prediction';

const num = 'rounded-none border border-black bg-white px-3 py-2 text-sm';

export function OnboardingFlow() {
  const [input, setInput] = useState<OnboardingInput>({
    sex: 'female',
    age: 30,
    heightCm: 165,
    weightKg: 90,
    goalWeightKg: 75,
    activity: 'moderate',
    goal: 'lose',
  });
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  const plan = useMemo(() => computePlan(input), [input]);
  function up<K extends keyof OnboardingInput>(k: K, v: OnboardingInput[K]) {
    setInput((s) => ({ ...s, [k]: v }));
  }

  async function submit() {
    setBusy(true);
    await fetch('/api/onboarding/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }).catch(() => {});
    setBusy(false);
    setSubmitted(true);
  }

  const Chart = (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <LineChart data={plan.curve} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <XAxis dataKey="week" tick={{ fontSize: 11 }} />
          <YAxis domain={['dataMin - 2', 'dataMax + 2']} tick={{ fontSize: 11 }} width={32} />
          <Tooltip />
          <ReferenceLine y={input.goalWeightKg} stroke="#5EBE62" strokeDasharray="4 4" />
          <Line type="monotone" dataKey="weightKg" stroke="#000000" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  if (submitted) {
    return (
      <div className="flex flex-col gap-5">
        <h2 className="text-2xl font-bold uppercase tracking-tight">Your plan</h2>
        <p className="text-lg">
          <strong>{plan.calories}</strong> kcal/day · P{plan.macros.protein_g} C{plan.macros.carbs_g} F
          {plan.macros.fat_g} g
        </p>
        {Chart}
        <p className="text-sm text-neutral-600">
          Projected {input.weightKg} kg to {plan.curve[12].weightKg} kg in 12 weeks ({plan.weeklyKg} kg/week).
        </p>
        <a
          href="/checkout"
          className="rounded-none bg-black px-6 py-3 text-center text-base font-medium text-white"
        >
          Continue to checkout
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Sex
          <select className={num} value={input.sex} onChange={(e) => up('sex', e.target.value as OnboardingInput['sex'])}>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Goal
          <select className={num} value={input.goal} onChange={(e) => up('goal', e.target.value as OnboardingInput['goal'])}>
            <option value="lose">Lose</option>
            <option value="maintain">Maintain</option>
            <option value="gain">Gain</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Age
          <input type="number" className={num} value={input.age} onChange={(e) => up('age', Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Height (cm)
          <input type="number" className={num} value={input.heightCm} onChange={(e) => up('heightCm', Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Weight (kg)
          <input type="number" className={num} value={input.weightKg} onChange={(e) => up('weightKg', Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Goal weight (kg)
          <input type="number" className={num} value={input.goalWeightKg} onChange={(e) => up('goalWeightKg', Number(e.target.value))} />
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-sm">
          Activity
          <select className={num} value={input.activity} onChange={(e) => up('activity', e.target.value as OnboardingInput['activity'])}>
            <option value="sedentary">Sedentary</option>
            <option value="light">Light</option>
            <option value="moderate">Moderate</option>
            <option value="active">Active</option>
            <option value="very_active">Very active</option>
          </select>
        </label>
      </div>

      {Chart}
      <p className="text-sm text-neutral-600">
        Projected {input.weightKg} kg to {plan.curve[12].weightKg} kg in 12 weeks ({plan.weeklyKg} kg/week).
      </p>

      <button type="button" disabled={busy} onClick={submit} className="rounded-none bg-black px-6 py-3 text-base font-medium text-white">
        See my plan
      </button>
    </div>
  );
}
