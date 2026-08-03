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
  const [signupEnabled, setSignupEnabled] = useState(initial.signupEnabled);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async (next?: { signupEnabled: boolean }): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const signup = next?.signupEnabled ?? signupEnabled;
    const res = await saveAdminSettingsAction({
      supportEmail,
      supportPhone,
      supportHours,
      maintenanceNote,
      signupEnabled: signup,
    });
    setBusy(false);
    if (res.ok) {
      setMsg({
        ok: true,
        text: next
          ? signup
            ? 'Sign-ups are open. Anyone can create an account.'
            : 'Sign-ups are closed. New accounts are blocked, including Continue with Google.'
          : 'Saved. Members will see the updated support contact.',
      });
      router.refresh();
    } else {
      // Roll the switch back to what the server still has, so the UI never claims a state that did
      // not persist. A toggle that looks flipped but did not save is how the door gets left open.
      if (next) setSignupEnabled(!next.signupEnabled);
      setMsg({ ok: false, text: ERRORS[res.error ?? ''] ?? 'Something went wrong.' });
    }
  };

  /**
   * Flip and save in one action, deliberately not behind the Save button below.
   *
   * A switch that needs a separate save is a switch someone flips, walks away from, and believes is
   * applied. For the control that decides whether strangers can create accounts, that gap is not
   * worth the consistency with the text fields.
   */
  const toggleSignup = (): void => {
    const nextValue = !signupEnabled;
    setSignupEnabled(nextValue);
    void save({ signupEnabled: nextValue });
  };

  const inputCls =
    'w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-[14px] text-ink outline-none focus:border-ink';

  return (
    <>
    <section className="mb-5 rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-5 py-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[1.5px] text-faint">Account creation</h2>
      </div>
      <div className="flex items-start justify-between gap-6 px-5 py-4">
        <div>
          <p className="text-[14px] font-semibold text-ink">
            New sign-ups are {signupEnabled ? 'open' : 'closed'}
          </p>
          <p className="mt-1 max-w-[52ch] text-[13px] leading-relaxed text-soft">
            {signupEnabled
              ? 'Anyone can create an account at /auth/sign-up. Turn this off to stop new accounts without taking the site down.'
              : 'Nobody can create a new account. This is enforced on the server, so it also blocks Continue with Google and a direct form post. Everyone who already has an account can still sign in.'}
          </p>
        </div>
        {/* Switch, not a checkbox: this is a state you scan for at a glance, and the label above says
            which state it is in words as well as colour. Green here is functional (on), never decoration. */}
        <button
          type="button"
          role="switch"
          aria-checked={signupEnabled}
          aria-label="New sign-ups"
          disabled={busy}
          onClick={toggleSignup}
          className={`tf-press relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
            signupEnabled ? 'bg-[#1F7A46]' : 'bg-line'
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-surface transition-transform ${
              signupEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </section>

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
    </>
  );
}
