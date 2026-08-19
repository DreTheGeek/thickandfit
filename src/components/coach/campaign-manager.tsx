'use client';
// Write a campaign, switch it on, switch it off, delete it.
//
// The arming control is deliberately separate from the form and confirms first: it is the only
// switch in the coach console that sends a message to a whole cohort, and it should not be
// reachable by tabbing through a draft.
import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import {
  saveCampaignAction,
  setCampaignActiveAction,
  deleteCampaignAction,
} from '@/lib/campaigns/actions';
import { CAMPAIGN_AUDIENCES, DEFAULT_MIN_TENURE_DAYS, type CampaignAudience } from '@/lib/campaigns/season-shared';

export type CampaignView = {
  id: string;
  key: string;
  title: string;
  startsMd: string;
  endsMd: string;
  audience: CampaignAudience;
  minTenureDays: number;
  titleEn: string;
  bodyEn: string;
  titleEs: string;
  bodyEs: string;
  link: string;
  isActive: boolean;
  /** Decided on the server with the generator's own predicate, wrap-around included. */
  isSendingNow: boolean;
};

type Draft = Omit<CampaignView, 'id' | 'isActive' | 'isSendingNow'> & { id?: string };

const BLANK: Draft = {
  key: '',
  title: '',
  startsMd: '12-26',
  endsMd: '01-05',
  audience: 'active',
  minTenureDays: DEFAULT_MIN_TENURE_DAYS,
  titleEn: '',
  bodyEn: '',
  titleEs: '',
  bodyEs: '',
  link: '/dashboard',
};

export function CampaignManager({ campaigns }: { campaigns: CampaignView[] }): ReactElement {
  const t = useTranslations('app.coach');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof Draft>(k: K, v: Draft[K]): void {
    setDraft((d) => (d === null ? d : { ...d, [k]: v }));
  }

  function save(): void {
    if (draft === null) return;
    setError(null);
    startTransition(async () => {
      const res = await saveCampaignAction({ ...draft, minTenureDays: Number(draft.minTenureDays) });
      if (!res.ok) setError(res.error === 'keyTaken' ? t('campaignKeyTaken') : t('campaignError'));
      else {
        setDraft(null);
        router.refresh();
      }
    });
  }

  function arm(id: string, isActive: boolean): void {
    // Only the ON direction confirms. Switching a campaign off is always safe; switching one on
    // sends to everybody it matches.
    if (isActive && !window.confirm(t('campaignArmConfirm'))) return;
    setError(null);
    startTransition(async () => {
      const res = await setCampaignActiveAction({ id, isActive });
      if (!res.ok) setError(t('campaignError'));
      else router.refresh();
    });
  }

  function remove(id: string): void {
    if (!window.confirm(t('campaignDeleteConfirm'))) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteCampaignAction({ id });
      if (!res.ok) setError(t('campaignError'));
      else router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {campaigns.length === 0 && draft === null && (
        <Card className="p-5">
          <p className="max-w-prose text-[14px] leading-relaxed text-muted">{t('campaignsEmpty')}</p>
        </Card>
      )}

      {campaigns.map((c) => (
        <Card key={c.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-display text-[20px]">{c.title}</div>
              <div className="mt-1 text-[12px] text-muted">
                {t('campaignWindowLabel', { from: c.startsMd, to: c.endsMd })} · {c.key}
              </div>
              <div className="mt-1.5 text-[12px] text-faint">
                {c.isSendingNow
                  ? t('campaignsLive')
                  : c.isActive
                    ? t('campaignsArmed')
                    : t('campaignsDraft')}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => arm(c.id, !c.isActive)}
                disabled={pending}
                className={`tf-press rounded-full px-3.5 py-1.5 text-[12px] font-semibold disabled:opacity-50 ${
                  c.isActive ? 'border border-line' : 'bg-ink text-bg'
                }`}
              >
                {c.isActive ? t('campaignDisarm') : t('campaignArm')}
              </button>
              <button
                type="button"
                onClick={() => setDraft({ ...c })}
                disabled={pending}
                className="tf-press rounded-full border border-line px-3.5 py-1.5 text-[12px] font-semibold disabled:opacity-50"
              >
                {t('campaignSave')}
              </button>
              <button
                type="button"
                onClick={() => remove(c.id)}
                disabled={pending}
                className="tf-press rounded-full border border-line px-3.5 py-1.5 text-[12px] font-semibold text-alert-ink disabled:opacity-50"
              >
                {t('campaignDelete')}
              </button>
            </div>
          </div>
        </Card>
      ))}

      {draft === null ? (
        <button
          type="button"
          onClick={() => setDraft({ ...BLANK })}
          className="tf-press rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-bg"
        >
          {t('campaignNew')}
        </button>
      ) : (
        <Card className="p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <F id="c-title" label={t('campaignName')}>
              <input id="c-title" className={IN} value={draft.title} onChange={(e) => set('title', e.target.value)} />
            </F>
            <F id="c-key" label={t('campaignKey')} hint={t('campaignKeyHint')}>
              <input id="c-key" className={IN} value={draft.key} onChange={(e) => set('key', e.target.value)} />
            </F>
            <F id="c-from" label={t('campaignFrom')} hint={t('campaignWindowHint')}>
              <input id="c-from" className={IN} placeholder="12-26" value={draft.startsMd} onChange={(e) => set('startsMd', e.target.value)} />
            </F>
            <F id="c-to" label={t('campaignTo')}>
              <input id="c-to" className={IN} placeholder="01-05" value={draft.endsMd} onChange={(e) => set('endsMd', e.target.value)} />
            </F>
            <F id="c-aud" label={t('campaignAudience')} hint={t('campaignAudienceHint')}>
              <select id="c-aud" className={IN} value={draft.audience} onChange={(e) => set('audience', e.target.value as CampaignAudience)}>
                {CAMPAIGN_AUDIENCES.map((a) => (
                  <option key={a} value={a}>
                    {a === 'all' ? t('campaignAudienceAll') : a === 'active' ? t('campaignAudienceActive') : t('campaignAudienceAtRisk')}
                  </option>
                ))}
              </select>
            </F>
            <F id="c-ten" label={t('campaignMinTenure')}>
              <input id="c-ten" type="number" min="0" max="365" className={IN} value={draft.minTenureDays} onChange={(e) => set('minTenureDays', Number(e.target.value))} />
            </F>
            <F id="c-link" label={t('campaignLink')}>
              <input id="c-link" className={IN} value={draft.link} onChange={(e) => set('link', e.target.value)} />
            </F>
          </div>

          {/* Both languages, side by side and both required. Every other member-facing string in
              this app exists in EN and ES; a campaign with one filled in reaches half the roster in
              a language they did not choose. */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-[12px] uppercase tracking-[2px] text-faint">{t('campaignCopyEn')}</h3>
              <input aria-label={`${t('campaignCopyEn')} ${t('campaignHeadline')}`} className={IN} value={draft.titleEn} onChange={(e) => set('titleEn', e.target.value)} />
              <textarea aria-label={`${t('campaignCopyEn')} ${t('campaignBody')}`} rows={4} className={IN} value={draft.bodyEn} onChange={(e) => set('bodyEn', e.target.value)} />
            </div>
            <div className="space-y-2">
              <h3 className="text-[12px] uppercase tracking-[2px] text-faint">{t('campaignCopyEs')}</h3>
              <input aria-label={`${t('campaignCopyEs')} ${t('campaignHeadline')}`} className={IN} value={draft.titleEs} onChange={(e) => set('titleEs', e.target.value)} />
              <textarea aria-label={`${t('campaignCopyEs')} ${t('campaignBody')}`} rows={4} className={IN} value={draft.bodyEs} onChange={(e) => set('bodyEs', e.target.value)} />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button type="button" onClick={save} disabled={pending} className="tf-press rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-bg disabled:opacity-40">
              {t('campaignSave')}
            </button>
            <button type="button" onClick={() => setDraft(null)} disabled={pending} className="tf-press rounded-full border border-line px-4 py-2 text-[13px] font-semibold disabled:opacity-50">
              {t('campaignDisarm')}
            </button>
          </div>
        </Card>
      )}

      {error && <p className="text-[12px] text-alert-ink">{error}</p>}
    </div>
  );
}

const IN =
  'w-full rounded-lg border border-line bg-bg px-3 py-2 text-[14px] outline-none focus:border-ink disabled:opacity-50';

function F({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactElement;
}): ReactElement {
  return (
    <div>
      <label htmlFor={id} className="text-[12px] uppercase tracking-[1px] text-faint">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[11px] leading-snug text-faint">{hint}</p>}
    </div>
  );
}
