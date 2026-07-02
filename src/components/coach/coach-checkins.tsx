'use client';

// Read-only Check-ins tab for the coach client profile (Lenus parity): the client's latest weekly
// check-in submission (status, wins, opportunities, sleep, energy - parsed from the form) and their
// progress photos. Coach reviews; the client submits on their side.
import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { RecipeImage } from '@/components/coach/recipe-image';
import type { ClientCheckin } from '@/lib/coach/client-checkin';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtISO(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function CoachCheckins({ checkin }: { checkin: ClientCheckin }): ReactElement {
  const t = useTranslations('app.coach');
  const { latest, photos } = checkin;

  return (
    <div className="grid grid-cols-1 gap-4">
      {latest && (
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">{t('checkinLatest')}</div>
            <span className="text-[12px] text-faint">{fmtISO(latest.submittedAt)}</span>
          </div>
          <div className="mt-3 space-y-3.5">
            {latest.fields.map((f, i) => (
              <div key={i}>
                <div className="text-[11px] uppercase tracking-[0.5px] text-faint">{f.label}</div>
                <div className="mt-0.5 whitespace-pre-wrap text-[14px] leading-relaxed text-soft">{f.value}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {photos.length > 0 && (
        <Card className="p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">{t('checkinPhotos')}</div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((p) => (
              <div key={p.id}>
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-warm">
                  <RecipeImage src={p.url} alt={p.pose ?? ''} icon="camera" sizes="25vw" />
                </div>
                <div className="mt-1 truncate text-[10px] text-faint">
                  {p.pose ? `${p.pose.replace(/^seed-/, '')} · ` : ''}
                  {p.takenOn.slice(5)}
                  {p.weightLb != null ? ` · ${p.weightLb} lb` : ''}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!latest && photos.length === 0 && (
        <Card className="p-5">
          <p className="text-[14px] text-faint">{t('checkinNoData')}</p>
        </Card>
      )}
    </div>
  );
}
