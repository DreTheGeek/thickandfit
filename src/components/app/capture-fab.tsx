'use client';

// Global capture FAB (Cal-AI style): a floating "+" pinned above the bottom nav that opens the
// photo/text scan sheet from ANY subscriber screen, so logging a meal is always one tap away. It
// drives the existing PhotoScan sheet in controlled mode (no duplicate pipeline). Hidden on the
// immersive flows (onboarding, check-in, the in-workout player) like the nav.
import { useState, type ReactElement } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { PhotoScan } from '@/components/nutrition/photo-scan';

const HIDDEN = ['/onboarding', '/checkin'];

export function CaptureFab(): ReactElement | null {
  const pathname = usePathname();
  const t = useTranslations('app.nav');
  const [open, setOpen] = useState(false);
  // Bump on each open so the controlled PhotoScan remounts fresh (no reset-in-effect needed).
  const [instance, setInstance] = useState(0);
  if (HIDDEN.some((h) => pathname.startsWith(h)) || pathname.startsWith('/workout/')) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setInstance((i) => i + 1);
          setOpen(true);
        }}
        aria-label={t('logFood')}
        className="tf-press fixed bottom-[84px] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-bg shadow-[0_8px_24px_rgba(0,0,0,0.28)] lg:bottom-8 lg:right-8"
      >
        <Icon name="plus" size={26} />
      </button>
      <PhotoScan key={instance} open={open} onOpenChange={setOpen} hideTrigger />
    </>
  );
}
