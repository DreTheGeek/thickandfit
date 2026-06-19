// Coach subscribers list. Coach-guarded. Real subscribers for the company with
// status / locale / legacy tags (segment tagging arrives in PRD-29/30).
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { PageHeader } from '@/components/ui/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Badge, Tag } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

type Subscriber = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  is_legacy_client: boolean;
  ui_locale: string;
};

function initialsOf(name: string | null, email: string): string {
  const src = (name ?? '').trim() || email;
  return (
    src
      .split(/\s+|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?'
  );
}

export default async function CoachSubscribersPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');

  let subscribers: Subscriber[] = [];
  if (ctx.companyId) {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, is_legacy_client, ui_locale')
      .eq('company_id', ctx.companyId)
      .in('role', ['subscriber', 'free'])
      .order('created_at', { ascending: false });
    subscribers = (data ?? []) as Subscriber[];
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-8 py-10">
      <PageHeader title={t('subscribers')} />
      {subscribers.length === 0 ? (
        <p className="text-sm text-muted">{t('noSubscribers')}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line">
          {subscribers.map((s, i) => (
            <div
              key={s.id}
              className={[
                'flex items-center gap-3.5 bg-surface px-4 py-3.5',
                i < subscribers.length - 1 ? 'border-b border-divider' : '',
              ].join(' ')}
            >
              <Avatar initials={initialsOf(s.full_name, s.email)} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">
                  {s.full_name ?? s.email}
                </div>
                <div className="truncate text-[12px] text-faint">{s.email}</div>
              </div>
              <div className="flex items-center gap-2">
                {s.ui_locale === 'es' && <Tag outlined={false}>ES</Tag>}
                {s.is_legacy_client && <Badge variant="legacy">{t('legacy')}</Badge>}
                <Badge variant={s.role === 'free' ? 'inactive' : 'active'}>
                  {s.role === 'free' ? t('free') : t('subscriber')}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
