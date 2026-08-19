'use client';
// Who owns this member, and is she on a break. Both live here because they are the same question
// asked twice — "is anybody looking after her right now" — and splitting them across two cards is
// how a coach reassigns a client who is paused and never notices.
//
// The pause backend (pause-actions.ts, migration 0140) and the assignment backend
// (coverage-actions.ts, migration 0143) both predate this card; it is the first UI caller of either.
import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { assignCoachAction } from '@/lib/coach/coverage-actions';
import { pauseMemberAction, resumeMemberAction } from '@/lib/coach/pause-actions';

export type CoachOption = { id: string; name: string };

export function MemberCoachCard({
  profileId,
  coaches,
  assignedCoachId,
  /** Who is actually holding her today, when coverage sends her somewhere other than her own coach. */
  coveringCoachName,
  paused,
  resumesOn,
}: {
  profileId: string;
  coaches: CoachOption[];
  assignedCoachId: string | null;
  coveringCoachName: string | null;
  paused: boolean;
  resumesOn: string | null;
}): ReactElement {
  const t = useTranslations('app.coach');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Empty string is the "nobody" option: an unassigned member belongs to the company, which is a
  // real answer and the state of the whole roster today, not a blank to be filled in.
  const [coach, setCoach] = useState(assignedCoachId ?? '');
  const [resumeDate, setResumeDate] = useState('');

  function assign(next: string): void {
    setCoach(next);
    setError(null);
    startTransition(async () => {
      const res = await assignCoachAction({ profileId, coachId: next === '' ? null : next });
      if (!res.ok) {
        setError(res.error);
        setCoach(assignedCoachId ?? ''); // put the control back where the server still is
      } else router.refresh();
    });
  }

  function pause(): void {
    setError(null);
    startTransition(async () => {
      // An empty date is an open-ended break — "pause me until I say" is a real arrangement, and
      // forcing a date would make the coach invent one.
      const res = await pauseMemberAction({ profileId, resumesOn: resumeDate || null });
      if (!res.ok) setError(res.error);
      else {
        setResumeDate('');
        router.refresh();
      }
    });
  }

  function resume(): void {
    if (!window.confirm(t('resumeConfirm'))) return;
    setError(null);
    startTransition(async () => {
      const res = await resumeMemberAction({ profileId });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="assigned-coach" className="text-[12px] uppercase tracking-[1px] text-faint">
          {t('assignedCoach')}
        </label>
        <select
          id="assigned-coach"
          value={coach}
          disabled={pending}
          onChange={(e) => assign(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-line bg-bg px-3 py-2 text-[14px] outline-none focus:border-ink disabled:opacity-50"
        >
          <option value="">{t('assignedCoachNobody')}</option>
          {coaches.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {coveringCoachName ? (
          // Only shown when coverage actually moves her, so the card never says "assigned to X,
          // covered by X" — a coach reading this needs to know when the answer is NOT the dropdown.
          <p className="mt-1.5 text-[12px] text-muted">
            {t('assignedCoachCoveredBy', { name: coveringCoachName })}
          </p>
        ) : (
          <p className="mt-1.5 text-[12px] text-faint">{t('assignedCoachHint')}</p>
        )}
      </div>

      <div className="border-t border-line pt-4">
        {paused ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[14px]">
              {resumesOn ? t('pausedUntil', { date: resumesOn }) : t('pausedOpenEnded')}
            </span>
            <button
              type="button"
              onClick={resume}
              disabled={pending}
              className="tf-press rounded-full border border-ink px-3.5 py-1.5 text-[12px] font-semibold disabled:opacity-50"
            >
              {t('resumeCta')}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <span className="inline-flex flex-col gap-1">
              <label htmlFor="resume-on" className="text-[12px] uppercase tracking-[1px] text-faint">
                {t('pauseResumesOn')}
              </label>
              <input
                id="resume-on"
                type="date"
                value={resumeDate}
                onChange={(e) => setResumeDate(e.target.value)}
                className="rounded-lg border border-line bg-bg px-2.5 py-1.5 text-[13px] outline-none focus:border-ink"
              />
            </span>
            <button
              type="button"
              onClick={pause}
              disabled={pending}
              className="tf-press rounded-full border border-line px-3.5 py-1.5 text-[12px] font-semibold disabled:opacity-50"
            >
              {t('pauseCta')}
            </button>
          </div>
        )}
        <p className="mt-2 text-[12px] text-faint">{t('pauseHint')}</p>
      </div>

      {error && <p className="text-[12px] text-alert-ink">{t('coverageError')}</p>}
    </div>
  );
}
