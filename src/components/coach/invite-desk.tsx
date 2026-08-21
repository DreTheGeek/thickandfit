'use client';

import { useMemo, useState, useTransition, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { EmptyState } from '@/components/states/empty-state';
import { inviteOneAction, inviteBatchAction, type InviteActionResult } from '@/lib/legacy/invite-actions';
import type { InviteQueue, InviteRow } from '@/lib/legacy/invite-status';

/**
 * The screen that lets Stephanie move her own clients into her own app.
 *
 * 272 women came across from Lenus with their whole history and could not get in, because the thing
 * that invites them had no way to be run by the person whose clients they are.
 *
 * DESIGNED AROUND ONE FEAR: sending 272 real emails by accident. So the loud, easy, repeatable
 * action is inviting ONE named person, which is also the correct first move. The batch is present,
 * capped at 50 a call, and requires typing the number back. The server re-checks that number
 * against what it is about to do, so the confirmation is a guarantee rather than a UI courtesy.
 *
 * INVITED IS NOT IN. The three numbers at the top are deliberately separate: an invite that was
 * sent and never opened looks exactly like one never sent, and a migration that assumes otherwise
 * loses a third of a business quietly.
 */
export function InviteDesk({ queue }: { queue: InviteQueue }): ReactElement {
  const t = useTranslations('app.coach');
  const [q, setQ] = useState('');
  const [pending, startTransition] = useTransition();
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [result, setResult] = useState<(InviteActionResult & { who?: string }) | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [size, setSize] = useState('10');
  const [confirm, setConfirm] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return queue.waiting;
    return queue.waiting.filter((r) =>
      `${r.firstName ?? ''} ${r.lastName ?? ''} ${r.email}`.toLowerCase().includes(needle),
    );
  }, [q, queue.waiting]);

  const name = (r: InviteRow): string =>
    [r.firstName, r.lastName].filter(Boolean).join(' ').trim() || r.email;

  function inviteOne(r: InviteRow): void {
    // A real email to a real client. The confirm names her, because "are you sure?" on its own is
    // the kind of prompt people learn to dismiss.
    if (!window.confirm(t('inviteConfirmOne', { name: name(r), email: r.email }))) return;
    const fd = new FormData();
    fd.set('email', r.email);
    setBusyEmail(r.email);
    startTransition(async () => {
      const res = await inviteOneAction(fd);
      setResult({ ...res, who: name(r) });
      setBusyEmail(null);
    });
  }

  function inviteBatch(): void {
    const fd = new FormData();
    fd.set('size', size);
    fd.set('confirm', confirm);
    startTransition(async () => {
      const res = await inviteBatchAction(fd);
      setResult(res);
      if (res.ok) {
        setBatchOpen(false);
        setConfirm('');
      }
    });
  }

  const n = Math.min(Math.max(Number(size) || 0, 1), 50);

  return (
    <div className="flex flex-col gap-5">
      {/* THREE NUMBERS THAT MEAN THREE DIFFERENT THINGS. "In the app" is the only one that is a
          result; the other two are work in progress and work not started. */}
      <div className="grid grid-cols-3 gap-3">
        <Stat value={queue.claimed} label={t('inviteStatIn')} accent />
        <Stat value={queue.invited} label={t('inviteStatInvited')} />
        <Stat value={queue.waiting.length - queue.invited} label={t('inviteStatWaiting')} />
      </div>

      {/* Without a key every send fails silently at the provider and the log fills with `failed`.
          Say it before she taps, not after. */}
      {!queue.emailConfigured && (
        <p role="alert" className="rounded-2xl bg-alert px-4 py-3 text-[13px] leading-relaxed text-alert-ink">
          {t('inviteNoEmailKey')}
        </p>
      )}

      {result && (
        <p
          role="status"
          className={[
            'rounded-2xl px-4 py-3 text-[13px] leading-relaxed',
            result.ok ? 'bg-warm text-soft' : 'bg-alert text-alert-ink',
          ].join(' ')}
        >
          {result.ok
            ? result.who
              ? t('inviteSentOne', { name: result.who })
              : t('inviteSentBatch', { sent: result.sent })
            : t(
                result.message === 'notFound'
                  ? 'inviteErrNotFound'
                  : result.message === 'confirmMismatch'
                    ? 'inviteErrConfirm'
                    : 'inviteErrSend',
              )}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-0 flex-1 basis-[220px]">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
            <Icon name="search" size={16} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('inviteSearch')}
            className="w-full rounded-full border border-line bg-surface py-2.5 pl-10 pr-4 text-[14px] outline-none placeholder:text-faint focus:border-ink"
          />
        </div>
        {queue.waiting.length > 0 && (
          <button
            type="button"
            onClick={() => setBatchOpen((v) => !v)}
            className="tf-press shrink-0 rounded-full border border-line px-4 py-2.5 text-[13px] font-semibold text-muted hover:text-ink"
          >
            {t('inviteBatchOpen')}
          </button>
        )}
      </div>

      {/* THE BATCH, behind a deliberate second step. Capped at 50 by the server whatever this says:
          a first send to a cold domain is a deliverability experiment, and 272 at once is how a
          sending reputation dies on the day it matters most. */}
      {batchOpen && (
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="text-[14px] font-semibold text-ink">{t('inviteBatchTitle')}</div>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{t('inviteBatchBody')}</p>
          <div className="mt-3.5 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">
                {t('inviteBatchHowMany')}
              </span>
              <input
                type="number"
                min={1}
                max={50}
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-24 rounded-lg border border-line bg-bg px-3 py-2 text-[14px] tabular-nums outline-none focus:border-ink"
              />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">
                {t('inviteBatchConfirmLabel', { n })}
              </span>
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={String(n)}
                className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-[14px] outline-none focus:border-ink"
              />
            </label>
            <button
              type="button"
              onClick={inviteBatch}
              disabled={pending || confirm.trim() !== String(n) || !queue.emailConfigured}
              className="tf-press rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-bg disabled:opacity-35"
            >
              {pending ? t('inviteSending') : t('inviteBatchSend', { n })}
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title={queue.waiting.length === 0 ? t('inviteAllDone') : t('inviteNoMatch')}
          message={queue.waiting.length === 0 ? t('inviteAllDoneBody') : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line">
          {filtered.map((r, i) => (
            <div
              key={r.contactId}
              className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-divider' : ''}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-ink">{name(r)}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-faint">
                  <span className="truncate">{r.email}</span>
                  {r.language === 'es' && <span>· ES</span>}
                  {r.productType && <span>· {r.productType}</span>}
                </span>
              </span>
              {/* Already emailed is not already in. It says "invited", stays tappable so she can
                  chase, and turns into the bounce when the provider rejected it. */}
              {r.lastSendFailed ? (
                <span className="shrink-0 rounded-full bg-alert px-2.5 py-1 text-[11px] font-semibold text-alert-ink">
                  {t('inviteBounced')}
                </span>
              ) : r.invitedAt ? (
                <span className="shrink-0 rounded-full bg-warm px-2.5 py-1 text-[11px] font-semibold text-muted">
                  {t('inviteAlready')}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => inviteOne(r)}
                disabled={pending || !queue.emailConfigured}
                className="tf-press shrink-0 rounded-full border border-line px-3.5 py-1.5 text-[12px] font-semibold text-ink disabled:opacity-35"
              >
                {busyEmail === r.email ? t('inviteSending') : r.invitedAt ? t('inviteAgain') : t('inviteSend')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ value, label, accent = false }: { value: number; label: string; accent?: boolean }): ReactElement {
  return (
    <div className="rounded-2xl bg-surface p-4 text-center shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className={`font-display text-[26px] leading-none tabular-nums ${accent ? 'text-accent' : 'text-ink'}`}>
        {value}
      </div>
      <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-[1px] text-faint">{label}</div>
    </div>
  );
}
