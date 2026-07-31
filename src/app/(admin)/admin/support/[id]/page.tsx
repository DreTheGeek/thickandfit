// One support ticket, in full. The board could only ever show a subject line, so a ticket was
// unreadable and therefore unworkable; this is the page the Telegram alert links to.
//
// Layout mirrors the reference Dre asked to match: summary first, then the original text behind a
// warning, then the media, with the reporter's details in a sidebar.
//
// THE ORDERING IS THE POINT. The generated summary is safe to read anywhere, so it goes first. The
// original may contain a member's SSN, so it sits below an explicit banner. An operator skimming a
// ticket on a phone in public should hit the safe version first and choose to scroll to the raw one.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOperator } from '@/lib/auth/guards';
import { getTicketDetail } from '@/lib/admin/portal';
import { AdminPage, Card } from '@/components/admin/ui';
import { formatTicketNumber } from '@/lib/support/telegram';

export const dynamic = 'force-dynamic';

const PII_LABEL: Record<string, string> = {
  ssn: 'social security number',
  card: 'payment card',
  dob: 'date of birth',
  passport: 'ID number',
  bank: 'account number',
};

function Field({ label, value }: { label: string; value: string | null }): ReactElement | null {
  if (!value) return null;
  return (
    <div className="mb-4">
      <div className="text-[10px] font-semibold uppercase tracking-[1.2px] text-faint">{label}</div>
      <div className="mt-1 break-words text-[14px] text-ink">{value}</div>
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
  // Same list grammar as the email, so the two surfaces read identically.
  const labels = t.piiKinds.map((k) => PII_LABEL[k] ?? k);
  const kinds =
    labels.length <= 1
      ? (labels[0] ?? '')
      : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;

  return (
    <AdminPage title={formatTicketNumber(t.ticketNumber)} subtitle={`Submitted ${submitted}`}>
      <div className="flex items-center justify-between">
        <Link href="/admin/support" className="text-[13px] text-soft underline-offset-4 hover:text-ink hover:underline">
          ← All tickets
        </Link>
        <span className="rounded-full bg-warm px-3 py-1 text-[11px] font-semibold uppercase tracking-[1px] text-ink">
          {t.status.replace('_', ' ')}
        </span>
      </div>

      {t.piiFlagged && (
        // Deliberately loud. An operator forwarding a screenshot of this page needs to know before
        // they crop it, not after.
        <div role="alert" className="mt-4 rounded-[12px] bg-alert px-4 py-3 text-[13px] leading-relaxed text-alert-ink">
          This ticket&apos;s original description contained {kinds || 'sensitive details'} that were kept
          out of every notification. Handle the text below carefully and do not forward it.
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-3">
          {t.triage?.summary && (
            <Card title="Summary">
              <p className="text-[14px] leading-relaxed text-ink">{t.triage.summary}</p>
              {t.triage.memberContext && (
                <p className="mt-3 border-t border-line pt-3 text-[13px] leading-relaxed text-soft">
                  <span className="font-semibold text-ink">Account: </span>
                  {t.triage.memberContext}
                </p>
              )}
            </Card>
          )}

          <Card title={t.piiFlagged ? 'Original description (contains sensitive info)' : 'Original description'}>
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
              {t.body?.trim() || 'No description was provided.'}
            </p>
          </Card>

          {t.triage?.suggestedReply && (
            <Card title="Suggested reply (draft, not sent)">
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-soft">{t.triage.suggestedReply}</p>
              <p className="mt-3 text-[12px] text-faint">
                Nothing is ever sent to a member automatically. Edit this and send it yourself.
              </p>
            </Card>
          )}

          {(t.attachmentUrl || t.videoUrl) && (
            <Card title="Attachments">
              {t.attachmentUrl && (
                /* eslint-disable-next-line @next/next/no-img-element --
                   Reporter-supplied URL on an arbitrary host. next/image would require every such
                   host in remotePatterns, which is impossible for user-submitted links, and would
                   proxy third-party images through our own optimizer. A plain img is correct here. */
                <img src={t.attachmentUrl} alt="Ticket attachment" className="max-h-[420px] rounded-[10px] border border-line object-contain" />
              )}
              {t.videoUrl && (
                <a
                  href={t.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block rounded-full bg-ink px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[1.4px] text-bg"
                >
                  Watch video
                </a>
              )}
            </Card>
          )}
        </div>

        <Card title="Reporter">
          <Field label="Company" value={t.companyName} />
          <Field label="Category" value={t.category} />
          <Field label="Priority" value={t.priority} />
          <Field label="Rep name" value={t.repName} />
          <Field label="Rep email" value={t.email} />
          <Field label="Rep phone" value={t.repPhone} />
          <Field label="Source" value={t.source} />
          <Field label="Alerted" value={t.notifiedAt ? 'Yes' : 'Not sent'} />
          {t.githubIssueUrl && (
            <a href={t.githubIssueUrl} target="_blank" rel="noopener noreferrer" className="text-[13px] text-ink underline underline-offset-4">
              View GitHub issue
            </a>
          )}
        </Card>
      </div>
    </AdminPage>
  );
}
