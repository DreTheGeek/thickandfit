'use client';
// Invisible auto-capture of the member's IANA timezone (once per browser session). Without this,
// profiles.timezone stays at the default and diary days / streaks / reminders run on the wrong
// local day for anyone outside the default zone. Fire-and-forget; renders nothing.
import { useEffect } from 'react';
import { syncTimezoneAction } from '@/lib/account/timezone-actions';

const FLAG = 'tf-tz-synced';

export function TimezoneSync(): null {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(FLAG)) return;
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!tz) return;
      sessionStorage.setItem(FLAG, '1');
      void syncTimezoneAction(tz).catch(() => {});
    } catch {
      // Storage or Intl unavailable: skip silently; the server default still applies.
    }
  }, []);
  return null;
}
