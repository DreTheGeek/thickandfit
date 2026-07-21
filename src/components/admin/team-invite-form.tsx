'use client';
// Operator tool: create a coach / assistant / operator account by email and send them a set-password
// link. The teammate sets their own password from the email. Internal ops tool: English-only.
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { inviteTeammateAction, type TeammateRole } from '@/lib/admin/access-actions';

const ROLES: { value: TeammateRole; label: string; hint: string }[] = [
  { value: 'coach', label: 'Coach', hint: 'Full coaching console (clients, programs, nutrition, forms, community).' },
  { value: 'assistant_coach', label: 'Assistant coach', hint: 'Drafts messages and plans; a coach approves before they reach clients.' },
  { value: 'operator', label: 'Operator', hint: 'This admin/ops portal. Give sparingly.' },
];

const ERRORS: Record<string, string> = {
  invalid: 'Enter a valid name, email, and role.',
  no_company: 'No company scope on your account.',
  rate_limited: 'Too many invites right now. Wait a bit and try again.',
  exists_or_failed: 'That email already has an account (possibly a member or another workspace). Use a different email.',
  failed: 'Could not set the role. Try again.',
  email_failed: 'Account is set, but the email could not be sent. Check the email service and re-send.',
};

export function TeamInviteForm(): ReactElement {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeammateRole>('coach');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (): Promise<void> => {
    if (busy || !fullName.trim() || !email.trim()) return;
    setBusy(true);
    setMsg(null);
    const res = await inviteTeammateAction({ fullName, email, role });
    setBusy(false);
    if (res.ok) {
      const verb = res.status === 'updated' ? 'updated and re-sent the set-password link to' : 'created and emailed a set-password link to';
      setMsg({ ok: true, text: `Done. ${verb} ${email.trim()}. They set their own password from the email.` });
      setFullName('');
      setEmail('');
      setRole('coach');
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
        <h2 className="text-[11px] font-semibold uppercase tracking-[1.5px] text-faint">Add a teammate</h2>
      </div>
      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-muted">Full name</span>
            <input
              className={inputCls}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Stephanie Pantoja"
              autoComplete="off"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-muted">Email</span>
            <input
              className={inputCls}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="off"
            />
          </label>
        </div>

        <fieldset className="flex flex-col gap-2">
          <span className="text-[12px] font-medium text-muted">Role</span>
          <div className="flex flex-col gap-2">
            {ROLES.map((r) => (
              <label
                key={r.value}
                className={[
                  'flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors',
                  role === r.value ? 'border-ink bg-bg' : 'border-line hover:border-soft',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="role"
                  className="mt-1"
                  checked={role === r.value}
                  onChange={() => setRole(r.value)}
                />
                <span className="flex flex-col">
                  <span className="text-[14px] font-semibold text-ink">{r.label}</span>
                  <span className="text-[12px] text-muted">{r.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {msg && (
          <p className={`text-[13px] font-medium ${msg.ok ? 'text-[#1F7A46]' : 'text-alert-ink'}`}>{msg.text}</p>
        )}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || !fullName.trim() || !email.trim()}
          className="tf-press self-start rounded-xl bg-ink px-5 py-2.5 text-[14px] font-semibold text-surface disabled:opacity-40"
        >
          {busy ? 'Sending...' : 'Create & send link'}
        </button>
      </div>
    </section>
  );
}
