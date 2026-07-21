'use client';
// Operator edits company support settings. Internal ops tool: English-only.
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { saveAdminSettingsAction } from '@/lib/admin/settings-actions';
import type { AdminSettings } from '@/lib/admin/settings';

const ERRORS: Record<string, string> = {
  invalid: 'Enter a valid support email (or leave it blank to use the default).',
  no_company: 'No company scope on your account.',
  failed: 'Could not save. Try again.',
};

export function SettingsForm({ initial }: { initial: AdminSettings }): ReactElement {
  const router = useRouter();
  const [supportEmail, setSupportEmail] = useState(initial.supportEmail);
  const [supportPhone, setSupportPhone] = useState(initial.supportPhone ?? '');
  const [supportHours, setSupportHours] = useState(initial.supportHours ?? '');
  const [maintenanceNote, setMaintenanceNote] = useState(initial.maintenanceNote ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const res = await saveAdminSettingsAction({ supportEmail, supportPhone, supportHours, maintenanceNote });
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: 'Saved. Members will see the updated support contact.' });
      router.refresh();
    } else {
      setMsg({ ok: false, text: ERRORS[res.error ?? ''] ?? 'Something went wrong.' });
    }
  };

  const inputCls =
    'w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-[14px] text-ink outline-none focus:border-ink';

  return (
    <section className="rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-5 py-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[1.5px] text-faint">Support contact</h2>
      </div>
      <div className="flex flex-col gap-4 px-5 py-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-muted">Support email (shown to members in Help)</span>
          <input className={inputCls} type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="hello@teamthickandfit.com" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-muted">Support phone (optional)</span>
            <input className={inputCls} value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} placeholder="+1 ..." />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-muted">Support hours (optional)</span>
            <input className={inputCls} value={supportHours} onChange={(e) => setSupportHours(e.target.value)} placeholder="Mon-Fri 9-5 ET" />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-muted">Maintenance note (optional, internal)</span>
          <textarea className={`${inputCls} min-h-[80px] resize-y`} value={maintenanceNote} onChange={(e) => setMaintenanceNote(e.target.value)} maxLength={500} />
        </label>

        {msg && <p className={`text-[13px] font-medium ${msg.ok ? 'text-[#1F7A46]' : 'text-alert-ink'}`}>{msg.text}</p>}

        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="tf-press self-start rounded-xl bg-ink px-5 py-2.5 text-[14px] font-semibold text-surface disabled:opacity-40"
        >
          {busy ? 'Saving...' : 'Save settings'}
        </button>
      </div>
    </section>
  );
}
