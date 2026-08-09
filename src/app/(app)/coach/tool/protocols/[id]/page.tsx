// One protocol: read it, preview it in either language, send it, track it.
//
// `?lang=es` previews the Spanish rather than a client-side toggle: it is linkable (she can send
// Daniella the exact view she is asking about), it needs no JavaScript, and it keeps the whole
// protocol body a server component.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCoach } from '@/lib/auth/guards';
import { hasRole, APPROVER_ROLES } from '@/lib/auth/session';
import { getProfileTimezone } from '@/lib/datetime/profile-timezone';
import { localDay } from '@/lib/datetime/local-day';
import {
  getProtocolDetail,
  listAssignableClients,
  listAssignmentsForProtocol,
} from '@/lib/protocols/protocols';
import { COACH_COPY } from '@/lib/protocols/copy';
import { pickLocale, type ProtocolLocale } from '@/lib/protocols/types';
import { Icon } from '@/components/ui/icons';
import { ProtocolTotals } from '@/components/coach/protocols/protocol-totals';
import {
  ProtocolDay,
  ProtocolDrink,
  ProtocolGrocery,
  ProtocolRules,
} from '@/components/coach/protocols/protocol-body';
import { SpanishStatus } from '@/components/coach/protocols/spanish-status';
import { AssignPanel } from '@/components/coach/protocols/assign-panel';

export const dynamic = 'force-dynamic';

export default async function CoachProtocolDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string | string[] }>;
}): Promise<ReactElement> {
  const ctx = await requireCoach();
  if (!ctx.companyId) notFound();
  const { id } = await params;
  const { lang } = await searchParams;
  const langParam = Array.isArray(lang) ? lang[0] : lang;
  const locale: ProtocolLocale = langParam === 'es' ? 'es' : 'en';

  const today = localDay(await getProfileTimezone(ctx.userId));
  const protocol = await getProtocolDetail(ctx.companyId, id, today);
  if (!protocol) notFound();

  const [assignments, clients] = await Promise.all([
    listAssignmentsForProtocol(ctx.companyId, protocol.id, today),
    listAssignableClients(ctx.companyId, protocol.id),
  ]);

  const name = pickLocale(protocol.nameEn, protocol.nameEs, locale);
  const purpose = pickLocale(protocol.purposeEn, protocol.purposeEs, locale);
  const drinkTitle = pickLocale(
    protocol.fastedDrinkTitleEn ?? COACH_COPY.drinkNote,
    protocol.fastedDrinkTitleEs,
    locale,
  );
  const drinkNote =
    protocol.fastedDrinkNoteEn == null
      ? null
      : pickLocale(protocol.fastedDrinkNoteEn, protocol.fastedDrinkNoteEs, locale);

  return (
    <div className="mx-auto w-full max-w-[900px]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/coach/tool/protocols"
          className="tf-press inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink"
        >
          <Icon name="arrowLeft" size={15} /> {COACH_COPY.back}
        </Link>
        <div className="inline-flex overflow-hidden rounded-full border border-line">
          <Link
            href={`/coach/tool/protocols/${protocol.id}`}
            aria-current={locale === 'en' ? 'page' : undefined}
            className={[
              'px-4 py-1.5 text-[12px] font-semibold',
              locale === 'en' ? 'bg-ink text-bg' : 'text-muted hover:text-ink',
            ].join(' ')}
          >
            {COACH_COPY.langEnglish}
          </Link>
          <Link
            href={`/coach/tool/protocols/${protocol.id}?lang=es`}
            aria-current={locale === 'es' ? 'page' : undefined}
            className={[
              'px-4 py-1.5 text-[12px] font-semibold',
              locale === 'es' ? 'bg-ink text-bg' : 'text-muted hover:text-ink',
            ].join(' ')}
          >
            {COACH_COPY.langSpanish}
          </Link>
        </div>
      </div>

      <header className="mb-5">
        <h1 className="tf-display text-[28px] leading-tight text-ink">{name}</h1>
        <p className="mt-2 max-w-[68ch] text-[14px] leading-relaxed text-muted">{purpose}</p>
        <p className="mt-2 text-[12px] uppercase tracking-[1px] text-faint">
          {protocol.durationDays} {COACH_COPY.durationDays}
        </p>
      </header>

      <div className="flex flex-col gap-5">
        <ProtocolTotals stated={protocol.stated} summed={protocol.summed} />

        <SpanishStatus
          protocolId={protocol.id}
          esStatus={protocol.esStatus}
          canApprove={hasRole(ctx.role, APPROVER_ROLES)}
        />

        <AssignPanel
          protocolId={protocol.id}
          durationDays={protocol.durationDays}
          esStatus={protocol.esStatus}
          clients={clients}
          assignments={assignments}
          today={today}
        />

        <ProtocolRules rules={protocol.rules} locale={locale} />
        {protocol.drink.length > 0 && (
          <ProtocolDrink title={drinkTitle} note={drinkNote} items={protocol.drink} locale={locale} />
        )}
        <ProtocolDay meals={protocol.meals} locale={locale} />
        {protocol.grocery.length > 0 && <ProtocolGrocery groups={protocol.grocery} locale={locale} />}
      </div>
    </div>
  );
}
