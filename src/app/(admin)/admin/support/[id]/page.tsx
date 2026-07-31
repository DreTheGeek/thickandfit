// One support ticket, in full. The board could only ever show a subject line, so a ticket was
// unreadable and therefore unworkable; this is the page the Telegram alert links to.
//
// Laid out to match the reference: white cards on a soft ground, small letter-spaced section labels,
// reporter details in a right-hand rail. It deliberately does NOT use the shared admin <Card>: this
// page is read under pressure, one ticket at a time, and needs a denser hierarchy than the dashboard
// grid those cards were built for.
//
// THE ORDERING IS THE POINT. The generated summary is safe to read anywhere, so it goes first. The
// original may contain a member's SSN, so it sits below an explicit banner. An operator skimming a
// ticket on a phone in public should hit the safe version first and choose to scroll to the raw one.
import type { ReactElement, ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOperator } from '@/lib/auth/guards';
import { getTicketDetail } from '@/lib/admin/portal';
import { formatTicketNumber } from '@/lib/support/telegram';
import { signedAttachmentUrl } from '@/lib/support/attachment';

export const dynamic = 'force-dynamic';

const PII_LABEL: Record<string, string> = {
  ssn: 'social security number',
  card: 'payment card',
  dob: 'date of birth',
  passport: 'ID number',
  bank: 'account number',
};

const STATUS_TONE: Record<string, string> = {
  open: 'bg-[#eef4ff] text-[#2a4d8f]',
  in_progress: 'bg-[#fff6e5] text-[#8a5a1f]',
  resolved: 'bg-[#eaf6ee] text-[#245c36]',
  closed: 'bg-warm text-soft',
};

/** The small uppercase caption above every block. Carries the whole visual rhythm of the page. */
function Label({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[1.3px] text-faint">{children}</div>
  );
}

function Field({ label, value }: { label: string; value: string | null }): ReactElement | null {
  if (!value) return null;
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 break-words text-[14px] leading-snug text-ink">{value}</div>
    </div>
  );
}

/** A block inside the main card, separated by a hairline rather than its own card. */
function Block({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="border-t border-line px-6 py-5 first:border-t-0">
      <Label>{label}</Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const ctx = await requireOperator();
  const { id } = await params;
  const t = ctx.companyId ? await getTicketDetail(id, ctx.companyId) : null;
  if (!t) notFound();

  const submitted = new Date(t.createdAt).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  const labels = t.piiKinds.map((k) => PII_LABEL[k] ?? k);
  const kinds =
    labels.length <= 1
      ? (labels[0] ?? 'sensitive details')
      : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;

  // Attachments live in a PRIVATE bucket: a bug screenshot shows the member's own screen, often with
  // their name and macros on it, and a public URL would stay reachable by anyone who ever saw it.
  // Signed at render time, valid for an hour.
  const attachmentUrl = await signedAttachmentUrl(t.attachmentUrl);

  return (
    <main className="mx-auto w-full max-w-[1180px] px-5 py-8 sm:px-8">
      <Link
        href="/admin/support"
        className="inline-flex items-center gap-2 text-[13px] text-soft underline-offset-4 hover:text-ink hover:underline"
      >
        <span aria-hidden>←</span> All tickets
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] leading-none tracking-[-0.01em]">
            {formatTicketNumber(t.ticketNumber)}
          </h1>
          <p className="mt-1.5 text-[13px] text-faint">Submitted {submitted}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold lowercase ${STATUS_TONE[t.status] ?? 'bg-warm text-soft'}`}
        >
          {t.status.replace('_', ' ')}
        </span>
      </div>

      {t.piiFlagged && (
        // Deliberately loud, and placed above everything. An operator about to screenshot this page
        // needs to know before they crop it, not after.
        <div
          role="alert"
          className="mt-5 flex items-start gap-2.5 rounded-[12px] border border-[#f3c9c9] bg-[#fdecec] px-4 py-3 text-[13px] leading-relaxed text-[#8a1f1f]"
        >
          <span aria-hidden className="mt-[1px] shrink-0">⚠</span>
          <span>
            This ticket&apos;s original description contained a {kinds}, kept out of every
            notification. Handle the details below carefully and do not forward them.
          </span>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="overflow-hidden rounded-[14px] border border-line bg-surface">
          <div className="px-6 pt-5">
            <h2 className="text-[17px] font-semibold leading-snug text-ink">{t.subject}</h2>
          </div>

          {t.triage?.summary && (
            <div className="px-6 pb-1 pt-4">
              <Label>Summary</Label>
              <p className="mt-2 text-[14px] leading-[1.65] text-ink">{t.triage.summary}</p>
              {t.triage.memberContext && (
                <p className="mt-2.5 text-[13px] leading-[1.6] text-soft">
                  <span className="font-semibold text-ink">Account: </span>
                  {t.triage.memberContext}
                </p>
              )}
            </div>
          )}

          <div className="mt-4">
            <Block label={t.piiFlagged ? 'Original description (may contain sensitive info)' : 'Original description'}>
              <p className="whitespace-pre-wrap text-[14px] leading-[1.65] text-ink">
                {t.body?.trim() || 'No description was provided.'}
              </p>
            </Block>

            {t.triage?.suggestedReply && (
              <Block label="Suggested reply (draft, never sent)">
                <p className="whitespace-pre-wrap text-[14px] leading-[1.65] text-soft">
                  {t.triage.suggestedReply}
                </p>
                <p className="mt-2.5 text-[12px] text-faint">
                  Nothing goes to a member automatically. Edit this and send it yourself.
                </p>
              </Block>
            )}

            {attachmentUrl && (
              <Block label="Attachment">
                {/* Full width and uncapped. This is a screenshot OF THE BUG, so the error text on it
                    is the payload; a thumbnail of an error message is useless. Click opens the
                    original.
                    eslint-disable-next-line @next/next/no-img-element --
                    Signed, expiring storage URL. next/image would need it in remotePatterns and would
                    proxy it through our optimizer, defeating the signature. */}
                <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" title="Open full size">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={attachmentUrl}
                    alt="Screenshot the reporter attached"
                    className="w-full rounded-[10px] border border-line bg-warm object-contain"
                  />
                </a>
                <p className="mt-2 text-[12px] text-faint">
                  Click to open full size. The link expires in an hour.
                </p>
              </Block>
            )}

            {t.videoUrl && (
              <Block label="Video">
                <a
                  href={t.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tf-press inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-ink hover:border-ink"
                >
                  <span aria-hidden>▷</span> Watch video
                </a>
              </Block>
            )}
          </div>
        </section>

        <aside className="rounded-[14px] border border-line bg-surface px-6 py-5">
          <div className="flex flex-col gap-4">
            <Field label="Company" value={t.companyName} />
            <Field label="Category" value={t.category} />
            <Field label="Priority" value={t.priority} />
            <Field label="Rep name" value={t.repName} />
            <Field label="Rep email" value={t.email} />
            <Field label="Rep phone" value={t.repPhone} />
            <Field label="Source" value={t.source} />
            <Field label="Alerted" value={t.notifiedAt ? 'Sent to Telegram' : 'Not sent'} />
            {t.githubIssueUrl && (
              <a
                href={t.githubIssueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] text-ink underline underline-offset-4"
              >
                View GitHub issue
              </a>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
