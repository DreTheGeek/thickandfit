'use client';
// Passcode wall for /admin (second factor on top of the operator role) + the team-access panel that
// lets an operator grant /admin access to a teammate by email. Internal ops tool: English-only.
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { enterAdminPasscodeAction, grantOperatorAction } from '@/lib/admin/access-actions';

export function AdminPasscodeGate(): ReactElement {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    if (!code.trim() || busy) return;
    setBusy(true);
    setErr(null);
    const res = await enterAdminPasscodeAction(code);
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      setErr(res.error === 'rate_limited' ? 'Too many tries. Wait 5 minutes.' : 'Wrong passcode.');
    }
  };

  return (
    <div className="mx-auto flex min-h-[60dvh] w-full max-w-sm flex-col items-center justify-center gap-4 px-5">
      <h1 className="font-display text-2xl uppercase tracking-tight">Admin portal</h1>
      <p className="text-center text-[13px] text-muted">Enter the admin passcode to open the launch board.</p>
      <input
        type="password"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
        placeholder="Passcode"
        autoFocus
        className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-center text-[15px] tracking-widest outline-none focus:border-ink"
      />
      {err && <p className="text-[13px] font-medium text-alert-ink">{err}</p>}
      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy || !code.trim()}
        className="tf-press w-full rounded-xl bg-ink px-4 py-3 text-[14px] font-semibold text-surface disabled:opacity-40"
      >
        {busy ? 'Checking...' : 'Unlock'}
      </button>
    </div>
  );
}

export function TeamAccess({ operators }: { operators: { name: string; email: string }[] }): ReactElement {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const grant = async (): Promise<void> => {
    if (!email.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    const res = await grantOperatorAction(email);
    setBusy(false);
    if (res.ok) {
      setMsg('Access granted.');
      setEmail('');
      router.refresh();
    } else {
      setMsg(res.error === 'not_found' ? 'No account with that email. Have them sign up first.' : 'Could not grant access.');
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="mb-1 text-[13px] font-semibold uppercase tracking-[1px] text-faint">Team access</h2>
      <p className="mb-3 text-[12px] text-muted">
        Operators can open this portal (with the passcode). Grant a teammate access by their account email.
      </p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {operators.map((o) => (
          <span key={o.email} className="rounded-full bg-warm px-2.5 py-1 text-[11px] font-medium text-soft">
            {o.name || o.email}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void grant(); }}
          placeholder="teammate@email.com"
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-ink"
        />
        <button
          type="button"
          onClick={() => void grant()}
          disabled={busy || !email.trim()}
          className="tf-press rounded-xl bg-ink px-4 py-2 text-[13px] font-semibold text-surface disabled:opacity-40"
        >
          Grant
        </button>
      </div>
      {msg && <p className="mt-2 text-[12px] font-medium text-muted">{msg}</p>}
    </div>
  );
}
