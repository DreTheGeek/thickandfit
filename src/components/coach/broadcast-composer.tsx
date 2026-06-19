'use client';
// Coach broadcast composer: channel + audience + schedule + message with a live phone preview.
// Sending connects to push/email in Phase 2 (PRD-29/39); compose + preview work now.
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { Segmented } from '@/components/ui/segmented';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/badge';

const MAX = 500;

type ToggleVal = 'all' | 'segment' | 'now' | 'later';

function Toggle({
  value,
  setValue,
  a,
  b,
}: {
  value: string;
  setValue: (v: ToggleVal) => void;
  a: { v: ToggleVal; label: string };
  b: { v: ToggleVal; label: string };
}): ReactElement {
  return (
    <div className="mb-5 flex gap-2.5">
      {[a, b].map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => setValue(o.v)}
          className={[
            'tf-press flex-1 border px-3 py-2.5 text-[13px]',
            value === o.v ? 'border-ink font-semibold text-ink' : 'border-line text-faint',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function BroadcastComposer(): ReactElement {
  const t = useTranslations('app.coach');
  const [channel, setChannel] = useState<'push' | 'inapp' | 'email'>('inapp');
  const [audience, setAudience] = useState<'all' | 'segment'>('all');
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [msg, setMsg] = useState("You've got this! Remember why you started. Consistency today creates results tomorrow.");
  const [status, setStatus] = useState('');

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:py-10">
      <h1 className="tf-display mb-3 text-[30px]">{t('createBroadcast')}</h1>
      <p className="mb-6 max-w-2xl rounded-xl bg-warm px-4 py-3 text-[13px] text-soft">{t('broadcastsSoon')}</p>

      <div className="mb-6 max-w-md">
        <Segmented
          value={channel}
          onChange={setChannel}
          options={[
            { value: 'push', label: 'Push' },
            { value: 'inapp', label: 'In-App' },
            { value: 'email', label: 'Email' },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <Eyebrow>{t('audience')}</Eyebrow>
          <Toggle
            value={audience}
            setValue={(v) => setAudience(v as 'all' | 'segment')}
            a={{ v: 'all', label: t('allMembers') }}
            b={{ v: 'segment', label: t('segment') }}
          />
          <Eyebrow>{t('scheduleLabel')}</Eyebrow>
          <Toggle
            value={when}
            setValue={(v) => setWhen(v as 'now' | 'later')}
            a={{ v: 'now', label: t('sendNow') }}
            b={{ v: 'later', label: t('later') }}
          />
          <Eyebrow>{t('messageLabel')}</Eyebrow>
          <textarea
            value={msg}
            maxLength={MAX}
            onChange={(e) => setMsg(e.target.value)}
            className="mt-2 min-h-[140px] w-full resize-y border border-line bg-surface p-3.5 text-[14px] leading-relaxed text-ink outline-none focus:border-ink"
          />
          <div className="mt-1 text-right text-[11px] text-faint">{msg.length} / {MAX}</div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" size="sm" onClick={() => setStatus(t('saved'))}>
              {t('saveDraft')}
            </Button>
            <Button size="sm" onClick={() => setStatus(t('broadcastsSoon'))}>
              {t('sendBroadcast')}
            </Button>
          </div>
          {status && <p className="mt-3 text-[13px] text-muted">{status}</p>}
        </div>

        <div>
          <Eyebrow>{t('broadcastPreview')}</Eyebrow>
          <div className="mt-2 flex justify-center rounded-2xl bg-warm p-6">
            <div className="w-[220px] rounded-[30px] bg-ink p-2">
              <div className="rounded-[24px] bg-surface p-5 text-center">
                <div className="mx-auto mb-2.5 flex h-12 w-12 items-center justify-center rounded-full bg-ink font-display text-white">
                  CS
                </div>
                <Tag outlined={false} className="mb-2.5">Coach Steph</Tag>
                <p className="text-left text-[12px] leading-relaxed text-soft">{msg}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: string }): ReactElement {
  return <div className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">{children}</div>;
}
