// What her assistant knows, what it has done, and what it still needs from her.
//
// The data was always being recorded; it lived under /admin, which she does not use. From her side
// the system was a black box. This is the same data in her language, on her side of the product.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { getMethodStatus } from '@/lib/coach/method-status';
import { Eyebrow } from '@/components/ui/section';
import { Icon } from '@/components/ui/icons';

export const dynamic = 'force-dynamic';

export default async function CoachMethodPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');
  const locale = await getLocale();
  if (!ctx.companyId) return <div className="p-8 text-sm text-muted">{t('emptyOverview')}</div>;

  const s = await getMethodStatus(ctx.companyId);

  const fmt = (iso: string | null): string =>
    iso ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(iso)) : '-';

  // Internal feature keys mean nothing to a coach. Anything unmapped falls back to the raw key
  // rather than being hidden, so a new capability shows up as soon as it runs instead of silently
  // not existing on this page.
  const featureLabel = (key: string): string => {
    const mapped: Record<string, string> = {
      chat: 'methodFeature_chat',
      'photo-scan': 'methodFeature_scan',
      'smart-scan': 'methodFeature_scan',
      scan: 'methodFeature_scan',
      insights: 'methodFeature_insights',
      'eval:chat': 'methodFeature_eval',
      'eval:judge': 'methodFeature_eval',
      embed: 'methodFeature_embed',
      'plan-gen': 'methodFeature_planGen',
      'intake-notes': 'methodFeature_intake',
      physique: 'methodFeature_physique',
      'support-triage': 'methodFeature_support',
      'overload-explain': 'methodFeature_overload',
    };
    const k = mapped[key];
    return k ? t(k) : key;
  };

  const knows = [
    { label: t('methodMovements'), value: s.movementsWithCues, href: '/coach/exercises' },
    { label: t('methodPieces'), value: s.knowledgePieces, href: '/coach/settings/knowledge' },
    { label: t('methodProtocolRules'), value: s.protocolRules, href: '/coach/tool/protocols' },
    { label: t('methodMemberRecords'), value: s.memberRecords, href: '/coach/clients' },
  ];

  const interviewLeft = Math.max(0, s.interviewTotal - s.interviewAnswered);

  return (
    <div>
      <Eyebrow>{t('methodEyebrow')}</Eyebrow>
      <h1 className="tf-display mt-1 text-[30px]">{t('methodTitle')}</h1>
      <p className="tf-measure mb-7 mt-1 text-[13px] text-faint">{t('methodIntro')}</p>

      {/* WHAT IT NEEDS comes first. A status page that opens on how well things are going is a
          status page nobody acts on. Absent entirely when there is nothing outstanding. */}
      {(interviewLeft > 0 || s.notSearchable > 0) && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">{t('methodNeedsYou')}</div>
          {interviewLeft > 0 && (
            <Link href="/coach/settings/knowledge/interview" className="tf-press flex items-center justify-between gap-3">
              <span className="text-[14px] text-ink">{t('methodInterviewLeft', { n: interviewLeft })}</span>
              <Icon name="chevronRight" size={16} />
            </Link>
          )}
          {/* Stored but unfindable. Zero on a healthy system; when it is not zero it is the reason
              the assistant "forgot" something she definitely taught it. */}
          {s.notSearchable > 0 && (
            <Link href="/coach/settings/knowledge" className="tf-press flex items-center justify-between gap-3">
              <span className="text-[14px] text-alert-ink">{t('methodNotSearchable', { n: s.notSearchable })}</span>
              <Icon name="chevronRight" size={16} />
            </Link>
          )}
        </div>
      )}

      <h2 className="mb-3 font-display text-[20px]">{t('methodKnows')}</h2>
      <div className="mb-7 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {knows.map((k) => (
          <Link key={k.label} href={k.href} className="tf-press rounded-2xl bg-surface p-5 hover:shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <div className="font-display text-[26px] leading-none tabular-nums">{k.value}</div>
            <div className="mt-1.5 text-[12px] text-muted">{k.label}</div>
          </Link>
        ))}
      </div>

      <h2 className="mb-3 font-display text-[20px]">{t('methodDoing')}</h2>
      {s.activity.length === 0 ? (
        <p className="rounded-2xl bg-surface p-8 text-center text-sm text-faint">{t('methodNoActivity')}</p>
      ) : (
        <div className="rounded-2xl bg-surface p-5">
          {s.activity.map((a) => (
            <div key={a.feature} className="flex items-center justify-between gap-3 border-b border-divider py-2.5 last:border-0">
              <span className="min-w-0 truncate text-[14px] text-ink">{featureLabel(a.feature)}</span>
              <span className="flex shrink-0 items-center gap-3 text-[12px]">
                <span className="tabular-nums text-muted">{t('methodRuns', { n: a.runs })}</span>
                {a.failures > 0 && <span className="tabular-nums text-alert-ink">{t('methodFailed', { n: a.failures })}</span>}
                <span className="w-14 text-right tabular-nums text-faint">{fmt(a.lastAt)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-[11px] text-faint">{t('methodWindow')}</p>
    </div>
  );
}
