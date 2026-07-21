'use client';

import { useState, useTransition } from 'react';
import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { addCoachNoteAction, type CoachNote, type NoteSubject } from '@/lib/coach/notes-actions';

// Add + list coach notes for one subject (subscriber profile or CRM client). Optimistic prepend on add.
export function CoachNotesPanel({
  subjectType,
  subjectId,
  initial,
  authorName,
}: {
  subjectType: NoteSubject;
  subjectId: string;
  initial: CoachNote[];
  authorName: string;
}): ReactElement {
  const t = useTranslations('app.coach');
  const [notes, setNotes] = useState<CoachNote[]>(initial);
  const [body, setBody] = useState('');
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  function submit(): void {
    const text = body.trim();
    if (!text || pending) return;
    setError(false);
    start(async () => {
      const res = await addCoachNoteAction({ subjectType, subjectId, body: text });
      if (res.ok) {
        setNotes((prev) => [
          { id: `tmp-${prev.length}-${text.length}`, body: text, authorName, createdAt: new Date().toISOString() },
          ...prev,
        ]);
        setBody('');
      } else {
        setError(true);
      }
    });
  }

  return (
    <div className="mt-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t('addNotePlaceholder')}
          maxLength={5000}
          rows={2}
          className="min-h-[44px] flex-1 resize-y rounded-lg border border-line bg-surface px-3 py-2 text-[14px] outline-none placeholder:text-faint focus:border-ink"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending || !body.trim()}
          className="tf-press h-fit shrink-0 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-bg disabled:opacity-40"
        >
          {t('addNote')}
        </button>
      </div>
      {error && <p className="mt-1.5 text-[12px] text-alert-ink">{t('noteFailed')}</p>}

      {notes.length === 0 ? (
        <p className="mt-3 text-[14px] text-faint">{t('noNotes')}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-divider px-3 py-2.5">
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{n.body}</p>
              <div className="mt-1 text-[11px] text-faint">
                {n.authorName} · {new Date(n.createdAt).toLocaleDateString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
