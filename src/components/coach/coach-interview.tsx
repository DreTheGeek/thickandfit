'use client';

// The Coach Interview: Stephanie (or her assistant Dani) answers multiple-choice, open-ended, and
// scenario questions so the AI can coach AS her. Accordion of sections; each section saves + trains the
// knowledge base on its own. Answers lift to one state object; multi-select answers store a JSON array.
import { useState, useTransition, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { ProgressBar } from '@/components/ui/ring';
import { saveInterviewSectionAction } from '@/app/(app)/coach/settings/knowledge/interview/interview-actions';
import {
  INTERVIEW_BANK,
  countAnswered,
  sectionAnswered,
  type InterviewQuestion,
  type InterviewSection,
} from '@/lib/coach/interview-bank';

type T = ReturnType<typeof useTranslations>;
const inputCls =
  'w-full rounded-xl border border-line bg-transparent px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-faint focus:border-ink';

function pill(active: boolean): string {
  return [
    'tf-press rounded-full border px-3 py-1.5 text-[13px]',
    active ? 'border-ink bg-ink text-bg' : 'border-line bg-transparent text-soft hover:border-ink',
  ].join(' ');
}

function parseMulti(value: string): string[] {
  try {
    const a = JSON.parse(value || '[]');
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

export function CoachInterview({ initial }: { initial: Record<string, string> }): ReactElement {
  const t = useTranslations('app.coach');
  const [answers, setAnswers] = useState<Record<string, string>>(initial);
  const [open, setOpen] = useState<string | null>(INTERVIEW_BANK[0]?.key ?? null);

  const { answered, total } = countAnswered(answers);
  const pct = total ? Math.round((answered / total) * 100) : 0;
  const set = (key: string, value: string): void => setAnswers((a) => ({ ...a, [key]: value }));

  return (
    <div>
      <div className="mb-5">
        <div className="mb-1.5 flex items-baseline justify-between text-[12px]">
          <span className="font-semibold uppercase tracking-[1px] text-faint">{t('interviewProgress')}</span>
          <span className="font-semibold">{answered}/{total}</span>
        </div>
        <ProgressBar pct={pct} color="var(--color-accent)" height={8} />
      </div>

      <div className="space-y-3">
        {INTERVIEW_BANK.map((section) => (
          <SectionCard
            key={section.key}
            section={section}
            answers={answers}
            open={open === section.key}
            onToggle={() => setOpen(open === section.key ? null : section.key)}
            onSet={set}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

function SectionCard({
  section,
  answers,
  open,
  onToggle,
  onSet,
  t,
}: {
  section: InterviewSection;
  answers: Record<string, string>;
  open: boolean;
  onToggle: () => void;
  onSet: (key: string, value: string) => void;
  t: T;
}): ReactElement {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const done = sectionAnswered(section, answers);

  function save(): void {
    setStatus('idle');
    start(async () => {
      const payload: Record<string, string> = {};
      for (const q of section.questions) {
        const v = answers[q.key];
        if (v != null) payload[q.key] = v;
      }
      const res = await saveInterviewSectionAction({ sectionKey: section.key, answers: payload });
      setStatus(res.ok ? 'ok' : 'error');
    });
  }

  return (
    <Card className="overflow-hidden p-0">
      <button type="button" onClick={onToggle} className="tf-press flex w-full items-center justify-between gap-3 p-5 text-left">
        <div className="min-w-0">
          <div className="font-display text-[19px] leading-tight">{section.label}</div>
          <div className="mt-0.5 text-[12px] text-faint">{section.description}</div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-[12px] text-muted">{done}/{section.questions.length}</span>
          <Icon name="chevronRight" size={18} className={open ? 'rotate-90 text-ink transition-transform' : 'text-faint transition-transform'} />
        </div>
      </button>

      {open && (
        <div className="space-y-6 border-t border-divider p-5">
          {section.questions.map((q) => (
            <QuestionField key={q.key} q={q} value={answers[q.key] ?? ''} onSet={onSet} t={t} />
          ))}
          <div className="flex items-center justify-end gap-3 border-t border-divider pt-4">
            {status === 'ok' && <span className="text-[12px] text-accent">{t('interviewSaved')}</span>}
            {status === 'error' && <span className="text-[12px] text-red-600">{t('interviewError')}</span>}
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="tf-press rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-bg disabled:opacity-50"
            >
              {pending ? t('interviewSaving') : t('interviewSave')}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function QuestionField({ q, value, onSet, t }: { q: InterviewQuestion; value: string; onSet: (key: string, value: string) => void; t: T }): ReactElement {
  const sel = q.type === 'multi' ? parseMulti(value) : [];
  const toggleMulti = (c: string): void => {
    const next = sel.includes(c) ? sel.filter((x) => x !== c) : [...sel, c];
    onSet(q.key, JSON.stringify(next));
  };

  return (
    <div>
      <div className="text-[15px] font-medium leading-snug">{q.prompt}</div>
      {q.help && <div className="mt-0.5 text-[12px] text-faint">{q.help}</div>}

      <div className="mt-2.5">
        {q.type === 'text' || q.type === 'scenario' ? (
          <textarea
            value={value}
            rows={q.type === 'scenario' ? 3 : 2}
            placeholder={q.placeholder}
            onChange={(e) => onSet(q.key, e.target.value)}
            className={`${inputCls} resize-none`}
          />
        ) : q.type === 'choice' ? (
          <div className="flex flex-wrap gap-2">
            {(q.choices ?? []).map((c) => (
              <button key={c} type="button" onClick={() => onSet(q.key, value === c ? '' : c)} className={pill(value === c)}>
                {c}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(q.choices ?? []).map((c) => (
              <button key={c} type="button" onClick={() => toggleMulti(c)} className={pill(sel.includes(c))}>
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-1.5 flex items-center gap-1 text-[11px] text-faint">
        <Icon name="sparkles" size={12} /> {t('interviewTeaches')} {q.captures}
      </div>
    </div>
  );
}
