// Coach settings: account, appearance, language, workspace, team, integrations, sign out.
// Real data (profile + company + team); functional theme + language; honest read-only elsewhere.
import type { ReactElement, ReactNode } from 'react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { LanguageToggle } from '@/components/i18n/language-toggle';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { PageTitle, SectionTitle } from '@/components/ui/section';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icons';
import { signOutAction } from '@/lib/auth/actions';
import { coverageTotals } from '@/lib/coach/system-map';

export const dynamic = 'force-dynamic';

type ProfileRow = { full_name: string | null; email: string | null; role: string; created_at: string | null; ui_locale: string | null; content_locale: string | null };
type TeamRow = { full_name: string | null; email: string | null; role: string };

function roleLabel(t: (k: string) => string, role: string): string {
  if (role === 'operator') return t('roleOperator');
  if (role === 'coach') return t('roleCoach');
  if (role === 'assistant_coach') return t('roleAssistant');
  return role;
}
function initials(name: string | null, email: string | null): string {
  return ((name || email || '?').split(/\s+|@|\./).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')) || '?';
}

function Card({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <SectionTitle className="mb-4">{title}</SectionTitle>
      {children}
    </section>
  );
}
function Row({ label, value }: { label: string; value: ReactNode }): ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-divider py-2.5 last:border-0">
      <span className="text-[13px] text-faint">{label}</span>
      <span className="text-[13px] font-medium text-ink">{value}</span>
    </div>
  );
}

export default async function CoachSettingsPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');
  const c = await getTranslations('app.common');
  const locale = await getLocale();
  const sb = createServiceClient();
  const cid = ctx.companyId ?? '';

  const [{ data: me }, { data: company }, { data: team }] = await Promise.all([
    sb.from('profiles').select('full_name,email,role,created_at,ui_locale,content_locale').eq('id', ctx.userId).maybeSingle(),
    sb.from('companies').select('name,slug').eq('id', cid).maybeSingle(),
    sb.from('profiles').select('full_name,email,role').eq('company_id', cid).in('role', ['operator', 'coach', 'assistant_coach']).order('role'),
  ]);
  const profile = (me ?? null) as ProfileRow | null;
  const teamRows = (team ?? []) as TeamRow[];
  const totals = coverageTotals();
  const memberSince = profile?.created_at
    ? new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(new Date(profile.created_at))
    : '-';

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 lg:py-10">
      <PageTitle className="mb-6">{t('settingsTitle')}</PageTitle>

      <div className="flex flex-col gap-4">
        {/* Account */}
        <Card title={t('settingsAccount')}>
          <div className="flex items-center gap-4">
            <Avatar initials={initials(profile?.full_name ?? null, profile?.email ?? null)} size={56} />
            <div className="min-w-0">
              <div className="font-display text-[20px] leading-tight">{profile?.full_name || t('noName')}</div>
              <div className="truncate text-[13px] text-faint">{profile?.email}</div>
            </div>
          </div>
          <div className="mt-4">
            <Row label={t('accountRole')} value={roleLabel(t, profile?.role ?? ctx.role)} />
            <Row label={t('memberSinceLabel')} value={memberSince} />
          </div>
        </Card>

        {/* Appearance + Language */}
        <Card title={t('settingsAppearance')}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] text-faint">{t('settingsTheme')}</span>
            <ThemeToggle />
          </div>
          <div className="mt-5 border-t border-divider pt-5">
            <div className="mb-3 text-[13px] text-faint">{c('language')}</div>
            <LanguageToggle uiLocale={profile?.ui_locale ?? 'en'} contentLocale={profile?.content_locale ?? 'en'} />
          </div>
        </Card>

        {/* Workspace */}
        <Card title={t('settingsBusiness')}>
          <Row label={t('workspaceName')} value={company?.name ?? '-'} />
          <Row label={t('workspaceSlug')} value={<span className="font-mono text-[12px]">{company?.slug ?? '-'}</span>} />
          <Row label={t('teamSizeLabel')} value={teamRows.length} />
        </Card>

        {/* Team */}
        <Card title={t('settingsTeam')}>
          {teamRows.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-faint">{t('noData')}</p>
          ) : (
            <div className="flex flex-col">
              {teamRows.map((m, i) => (
                <div key={`${m.email}-${i}`} className="flex items-center gap-3 border-b border-divider py-2.5 last:border-0">
                  <Avatar initials={initials(m.full_name, m.email)} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{m.full_name || m.email}</div>
                    <div className="truncate text-[11px] text-faint">{m.email}</div>
                  </div>
                  <span className="shrink-0 rounded-full bg-warm px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[1px] text-muted">
                    {roleLabel(t, m.role)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Integrations */}
        <Link href="/coach/health" className="tf-press rounded-2xl border border-line bg-surface p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <SectionTitle>{t('settingsIntegrations')}</SectionTitle>
              <div className="mt-1.5 text-[13px] text-faint">
                <span className="font-semibold text-accent-ink">{totals.live}</span> {t('statusLive').toLowerCase()} ·{' '}
                <span className="font-semibold">{totals.partial}</span> {t('statusPartial').toLowerCase()} ·{' '}
                <span className="font-semibold">{totals.planned}</span> {t('statusPlanned').toLowerCase()}
              </div>
            </div>
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-muted">
              {t('appHealth')} <Icon name="chevronRight" size={16} />
            </span>
          </div>
        </Link>

        {/* Sign out */}
        <form action={signOutAction} className="mt-2">
          <button type="submit" className="tf-press w-full rounded-full border border-line py-3.5 text-[12px] font-semibold uppercase tracking-[2px] text-muted">
            {c('signOut')}
          </button>
        </form>
      </div>
    </div>
  );
}
