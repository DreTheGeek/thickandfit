'use client';
// Assign a form to a client from the forms index. The /api/forms/[id]/assign endpoint existed with
// no UI caller, which made the check-in loop impossible to drive from the console; this is the wire.
import { useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';

export type AssignableClient = { id: string; name: string };

export function AssignFormControl({
  formId,
  clients,
}: {
  formId: string;
  clients: AssignableClient[];
}): ReactElement {
  const t = useTranslations('app.coach');
  const [profileId, setProfileId] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  async function assign(): Promise<void> {
    if (!profileId) return;
    setState('busy');
    try {
      const res = await fetch(`/api/forms/${formId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  }

  return (
    <span className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
      <select
        value={profileId}
        onChange={(e) => {
          setProfileId(e.target.value);
          setState('idle');
        }}
        aria-label={t('assignFormTo')}
        className="max-w-[160px] rounded-lg border border-line bg-bg px-2 py-1.5 text-[12px] outline-none focus:border-ink"
      >
        <option value="">{t('assignFormTo')}</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => void assign()}
        disabled={state === 'busy' || !profileId}
        className="tf-press shrink-0 rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold text-bg disabled:opacity-40"
      >
        {state === 'done' ? t('assignFormDone') : t('assignFormCta')}
      </button>
      {state === 'error' && <span className="text-[11px] text-alert-ink">{t('assignFormError')}</span>}
    </span>
  );
}
