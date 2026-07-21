'use client';

// Coach Knowledge Base builder UI. A titled-text paste form (chunk -> embed -> store) plus the list
// of ingested sources with a delete control. Bilingual via next-intl. Mirrors the create-challenge
// form pattern (useTransition + router.refresh on success).
import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ingestKnowledgeAction, deleteKnowledgeAction } from '@/app/(app)/coach/settings/knowledge/knowledge-actions';

export type KnowledgeSourceView = {
  sourceId: string;
  title: string;
  chunks: number;
  embedded: number;
  createdAt: string;
};

const inputCls =
  'w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-[14px] outline-none focus:border-ink';

export function KnowledgeBuilder({ sources }: { sources: KnowledgeSourceView[] }): ReactElement {
  const t = useTranslations('app.coachKnowledge');
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const valid = title.trim().length >= 2 && text.trim().length >= 20;

  function submit(): void {
    setErr('');
    setNote('');
    start(async () => {
      const res = await ingestKnowledgeAction({ title, text });
      if (res.ok) {
        setTitle('');
        setText('');
        setNote(t('ingested', { chunks: res.chunks, embedded: res.embedded }));
        router.refresh();
      } else {
        setErr(t('errorIngest'));
      }
    });
  }

  function remove(sourceId: string): void {
    setErr('');
    setNote('');
    setDeletingId(sourceId);
    start(async () => {
      const res = await deleteKnowledgeAction({ sourceId });
      setDeletingId(null);
      if (res.ok) router.refresh();
      else setErr(t('errorDelete'));
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Paste form */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="mb-1 text-[12px] font-semibold uppercase tracking-[1px] text-faint">{t('addTitle')}</p>
        <p className="mb-4 text-[13px] text-faint">{t('addHint')}</p>
        <div className="grid gap-3">
          <input
            className={inputCls}
            placeholder={t('titlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
          />
          <textarea
            className={`${inputCls} min-h-[180px] resize-y`}
            placeholder={t('textPlaceholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={100_000}
          />
          {err ? <p className="text-[12px] text-alert-ink">{err}</p> : null}
          {note ? <p className="text-[12px] text-accent-ink">{note}</p> : null}
          <button
            type="button"
            onClick={submit}
            disabled={!valid || pending}
            className="tf-press rounded-full bg-ink py-2.5 text-[13px] font-semibold text-bg disabled:opacity-40"
          >
            {pending && !deletingId ? t('saving') : t('save')}
          </button>
        </div>
      </div>

      {/* Sources list */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-[1px] text-faint">{t('sourcesTitle')}</p>
        {sources.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-faint">{t('empty')}</p>
        ) : (
          <div className="flex flex-col">
            {sources.map((s) => (
              <div
                key={s.sourceId}
                className="flex items-center justify-between gap-3 border-b border-divider py-3 last:border-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold text-ink">{s.title}</div>
                  <div className="text-[12px] text-faint">
                    {t('chunkCount', { chunks: s.chunks })}
                    {' · '}
                    {s.embedded > 0 ? t('embeddedCount', { embedded: s.embedded }) : t('notEmbedded')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(s.sourceId)}
                  disabled={pending}
                  className="tf-press shrink-0 rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-muted hover:text-ink disabled:opacity-40"
                >
                  {deletingId === s.sourceId ? t('deleting') : t('delete')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
