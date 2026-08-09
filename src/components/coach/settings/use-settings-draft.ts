'use client';
// Draft state for a settings screen: hold the edits, know whether anything actually changed, save the
// whole object, and rebaseline once the server has it.
//
// Both screens edit the SAME row, so both send the whole settings object. That is deliberate: a
// per-screen partial write would mean the Coaching Preferences screen has to know which columns
// belong to the Client App screen, and the first column added to the wrong list silently stops
// saving. The cost is that two tabs open on the two screens can overwrite each other, which is why
// the baseline is re-read from the value the server accepted rather than assumed.
import { useCallback, useMemo, useState } from 'react';
import { saveCoachSettingsAction } from '@/lib/coach/settings-actions';
import type { CoachSettings } from '@/lib/coach/settings-shared';

export type SaveMessage = { ok: boolean; text: string };

export type SettingsDraft = {
  draft: CoachSettings;
  /** Patch one or more fields. */
  set: <K extends keyof CoachSettings>(key: K, value: CoachSettings[K]) => void;
  isDirty: boolean;
  isBusy: boolean;
  message: SaveMessage | null;
  save: () => void;
};

export function useSettingsDraft(
  initial: CoachSettings,
  labels: { saved: string; failed: string; invalid: string },
): SettingsDraft {
  const [baseline, setBaseline] = useState<CoachSettings>(initial);
  const [draft, setDraft] = useState<CoachSettings>(initial);
  const [isBusy, setBusy] = useState(false);
  const [message, setMessage] = useState<SaveMessage | null>(null);

  const set = useCallback(<K extends keyof CoachSettings>(key: K, value: CoachSettings[K]): void => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    // Any edit invalidates the last outcome. Leaving "Saved" on screen while the coach types is how
    // an unsaved change gets closed in a tab.
    setMessage(null);
  }, []);

  // Structural compare. The arrays make a shallow key-by-key comparison wrong, and JSON is exact
  // enough here because every value is a boolean, a number, a string or an array of strings.
  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(baseline), [draft, baseline]);

  const save = useCallback((): void => {
    if (isBusy) return;
    setBusy(true);
    setMessage(null);
    void (async (): Promise<void> => {
      // Snapshot before awaiting: an edit made during the round trip must not be silently marked
      // saved when it was not part of the payload.
      const sent = draft;
      const res = await saveCoachSettingsAction(sent);
      setBusy(false);
      if (res.ok) {
        setBaseline(sent);
        setMessage({ ok: true, text: labels.saved });
      } else {
        setMessage({ ok: false, text: res.error === 'invalid' ? labels.invalid : labels.failed });
      }
    })();
  }, [draft, isBusy, labels.failed, labels.invalid, labels.saved]);

  return { draft, set, isDirty, isBusy, message, save };
}
