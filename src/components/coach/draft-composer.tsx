'use client';

// Assistant draft composer (PRD-30, WP8). The assistant picks an item type (message or meal plan), a
// recipient, fills the form, and submits. submitDraft inserts ONE pending approval_queue row and writes
// NOTHING to messages/meal_plans (the publish happens only on approval). Four-state aware: shows an
// error string from the action and resets on success.
import { useState, useTransition, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { submitDraft } from '@/lib/coach/approval-actions';
import type { CoachProfileLite } from '@/lib/coach/assignments';

type ItemType = 'message' | 'meal_plan';

export function DraftComposer({
  clients,
  contacts,
}: {
  clients: CoachProfileLite[];
  contacts: CoachProfileLite[];
}): ReactElement {
  const t = useTranslations('app.coach.midTicket');
  const [itemType, setItemType] = useState<ItemType>('message');
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [body, setBody] = useState('');
  const [contactId, setContactId] = useState(contacts[0]?.id ?? '');
  const [planName, setPlanName] = useState('');
  const [calorieGoal, setCalorieGoal] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const noClients = clients.length === 0;

  function submit(): void {
    setError(null);
    setDone(false);
    start(async () => {
      const input =
        itemType === 'message'
          ? { itemType: 'message' as const, clientId, payload: { body: body.trim() } }
          : {
              itemType: 'meal_plan' as const,
              clientId,
              payload: {
                contactId,
                name: planName.trim(),
                ...(calorieGoal ? { calorieGoal: Number(calorieGoal) } : {}),
              },
            };
      const res = await submitDraft(input);
      if (!res.ok) {
        setError(res.error === 'not_assigned' ? t('errorNotAssigned') : t('errorFailed'));
        return;
      }
      setBody('');
      setPlanName('');
      setCalorieGoal('');
      setDone(true);
    });
  }

  if (noClients) {
    return (
      <div className="rounded-2xl bg-surface p-5 text-[13px] text-faint">{t('composerNoClients')}</div>
    );
  }

  return (
    <div className="rounded-2xl bg-surface p-5">
      <h2 className="tf-display mb-4 text-[18px] text-ink">{t('composerTitle')}</h2>

      <div className="mb-4 flex gap-2">
        {(['message', 'meal_plan'] as ItemType[]).map((it) => (
          <button
            key={it}
            type="button"
            onClick={() => setItemType(it)}
            className={[
              'rounded-full px-4 py-2 text-[13px] font-semibold transition-colors',
              itemType === it ? 'bg-ink text-bg' : 'bg-warm text-muted hover:text-ink',
            ].join(' ')}
          >
            {t(it === 'message' ? 'typeMessage' : 'typeMealPlan')}
          </button>
        ))}
      </div>

      <label className="mb-1 block text-[12px] font-medium text-muted">{t('recipient')}</label>
      <select
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        className="mb-4 w-full rounded-lg border border-line bg-bg px-3 py-2 text-[14px] outline-none focus:border-ink"
      >
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {itemType === 'message' ? (
        <>
          <label className="mb-1 block text-[12px] font-medium text-muted">{t('messageBody')}</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder={t('messagePlaceholder')}
            className="mb-4 w-full rounded-lg border border-line bg-bg px-3 py-2 text-[14px] outline-none focus:border-ink"
          />
        </>
      ) : (
        <>
          <label className="mb-1 block text-[12px] font-medium text-muted">{t('mealPlanContact')}</label>
          <select
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            className="mb-4 w-full rounded-lg border border-line bg-bg px-3 py-2 text-[14px] outline-none focus:border-ink"
          >
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="mb-1 block text-[12px] font-medium text-muted">{t('mealPlanName')}</label>
          <input
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            placeholder={t('mealPlanNamePlaceholder')}
            className="mb-4 w-full rounded-lg border border-line bg-bg px-3 py-2 text-[14px] outline-none focus:border-ink"
          />
          <label className="mb-1 block text-[12px] font-medium text-muted">{t('calorieGoal')}</label>
          <input
            value={calorieGoal}
            onChange={(e) => setCalorieGoal(e.target.value.replace(/[^0-9]/g, ''))}
            inputMode="numeric"
            placeholder="2000"
            className="mb-4 w-full rounded-lg border border-line bg-bg px-3 py-2 text-[14px] outline-none focus:border-ink"
          />
        </>
      )}

      {error ? <p className="mb-3 text-[13px] text-alert-ink">{error}</p> : null}
      {done ? <p className="mb-3 text-[13px] text-accent">{t('draftSubmitted')}</p> : null}

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="tf-press rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-bg disabled:opacity-40"
      >
        {pending ? t('submitting') : t('submitForApproval')}
      </button>
    </div>
  );
}
