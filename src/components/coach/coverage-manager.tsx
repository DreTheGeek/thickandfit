'use client';
// Add an absence, see what is in force, cancel one. The whole rota UI.
import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { setCoverageAction, endCoverageAction } from '@/lib/coach/coverage-actions';
import type { CoachOption } from '@/components/coach/member-coach-card';

export type CoverageRow = {
  id: string;
  awayName: string;
  coveringName: string;
  startsOn: string;
  endsOn: string;
  note: string | null;
  /** Decided on the server, so this page and the queues cannot disagree about what is live. */
  active: boolean;
};

export function CoverageManager({
  coaches,
  rows,
}: {
  coaches: CoachOption[];
  rows: CoverageRow[];
  /** Unused by the render; kept so the page's read is obviously the same one the resolver did. */
  coveragesLoaded?: number;
}): ReactElement {
  const t = useTranslations('app.coach');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const [away, setAway] = useState('');
  const [covering, setCovering] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');

  // Coverage is one coach handing work to another, so it is meaningless with one coach. Saying so
  // beats rendering a form whose two dropdowns hold the same single name and whose submit is
  // rejected by a CHECK constraint.
  if (coaches.length < 2) {
    return <p className="text-[14px] leading-relaxed text-muted">{t('coverageNeedsTwo')}</p>;
  }

  const valid = away !== '' && covering !== '' && away !== covering && from !== '' && to !== '' && to >= from;

  function add(): void {
    if (!valid) return;
    setError(false);
    startTransition(async () => {
      const res = await setCoverageAction({
        coachId: away,
        coveringCoachId: covering,
        startsOn: from,
        endsOn: to,
        note: note || undefined,
      });
      if (!res.ok) setError(true);
      else {
        setAway('');
        setCovering('');
        setFrom('');
        setTo('');
        setNote('');
        router.refresh();
      }
    });
  }

  function end(id: string): void {
    if (!window.confirm(t('coverageEndConfirm'))) return;
    setError(false);
    startTransition(async () => {
      const res = await endCoverageAction({ id });
      if (!res.ok) setError(true);
      else router.refresh();
    });
  }

  const active = rows.filter((r) => r.active);
  const upcoming = rows.filter((r) => !r.active);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="cov-away" label={t('coverageWhoAway')}>
          <select id="cov-away" value={away} onChange={(e) => setAway(e.target.value)} className={SELECT}>
            <option value="" />
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field id="cov-covering" label={t('coverageWhoCovers')}>
          <select id="cov-covering" value={covering} onChange={(e) => setCovering(e.target.value)} className={SELECT}>
            <option value="" />
            {/* Covering yourself is rejected by a CHECK constraint; not offering it is kinder than
                explaining it after the fact. */}
            {coaches.filter((c) => c.id !== away).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field id="cov-from" label={t('coverageFrom')}>
          <input id="cov-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={SELECT} />
        </Field>
        {/* "Last day away", not "back on". Stored inclusive, so the label has to say which one it is
            or every entry is off by a day in the direction that un-covers her too early. */}
        <Field id="cov-to" label={t('coverageTo')}>
          <input id="cov-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={SELECT} />
        </Field>
        <Field id="cov-note" label={t('coverageNote')}>
          <input id="cov-note" type="text" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className={SELECT} />
        </Field>
      </div>
      <button
        type="button"
        onClick={add}
        disabled={pending || !valid}
        className="tf-press rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-bg disabled:opacity-40"
      >
        {t('coverageAdd')}
      </button>
      {error && <p className="text-[12px] text-alert-ink">{t('coverageError')}</p>}

      {rows.length === 0 ? (
        <p className="border-t border-line pt-5 text-[14px] leading-relaxed text-muted">{t('coverageNone')}</p>
      ) : (
        <div className="space-y-5 border-t border-line pt-5">
          {active.length > 0 && <Group title={t('coverageActive')} rows={active} onEnd={end} pending={pending} t={t} />}
          {upcoming.length > 0 && <Group title={t('coverageUpcoming')} rows={upcoming} onEnd={end} pending={pending} t={t} />}
        </div>
      )}
    </div>
  );
}

const SELECT =
  'w-full rounded-lg border border-line bg-bg px-3 py-2 text-[14px] outline-none focus:border-ink disabled:opacity-50';

function Field({ id, label, children }: { id: string; label: string; children: ReactElement }): ReactElement {
  return (
    <div>
      <label htmlFor={id} className="text-[12px] uppercase tracking-[1px] text-faint">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Group({
  title,
  rows,
  onEnd,
  pending,
  t,
}: {
  title: string;
  rows: CoverageRow[];
  onEnd: (id: string) => void;
  pending: boolean;
  t: ReturnType<typeof useTranslations>;
}): ReactElement {
  return (
    <div>
      <h2 className="mb-2 text-[12px] uppercase tracking-[2px] text-faint">{title}</h2>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-raise px-3.5 py-2.5">
            <span>
              <span className="text-[14px] font-semibold">
                {t('coverageRow', { away: r.awayName, covering: r.coveringName })}
              </span>
              <span className="ml-2 text-[12px] text-muted">
                {t('coverageDates', { from: r.startsOn, to: r.endsOn })}
              </span>
              {r.note && <span className="ml-2 text-[12px] text-faint">{r.note}</span>}
            </span>
            <button
              type="button"
              onClick={() => onEnd(r.id)}
              disabled={pending}
              className="tf-press rounded-full border border-line px-3 py-1 text-[12px] font-semibold disabled:opacity-50"
            >
              {t('coverageEnd')}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
