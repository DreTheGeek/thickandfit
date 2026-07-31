'use client';
// Public support form. Unauthenticated on purpose: the people who most need it are the ones who
// cannot sign in, so gating it behind a session would exclude exactly the population it serves.
//
// Bilingual by prop rather than useTranslations: /support renders its own copy the same way (it is
// outside the marketing message namespace), and mixing the two here caused a MISSING_MESSAGE crash
// on the landing page once already.
import { useState, type ReactElement } from 'react';
import { TurnstileWidget } from '@/components/funnel/turnstile-widget';

const CATEGORIES = ['account', 'billing', 'bug', 'content', 'other'] as const;
// Same key the funnel uses. Empty until Turnstile is configured, in which case the widget renders
// nothing and the server-side verify skips too, so the form still works.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

export function SupportForm({ es }: { es: boolean }): ReactElement {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('account');
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  // A screenshot OF THE PROBLEM. "It says an error" is unactionable; a picture of the actual error
  // usually contains the answer, which is why this is worth the upload path.
  const [shot, setShot] = useState<string | null>(null);
  const [shotName, setShotName] = useState<string>('');
  const [shotErr, setShotErr] = useState<string>('');

  const t = es
    ? {
        h: 'Escríbenos',
        sub: 'Cuéntanos qué pasó y te respondemos por correo.',
        email: 'Tu correo',
        subject: 'Asunto',
        body: 'Qué pasó. Entre más detalles, más rápido lo resolvemos.',
        cat: { account: 'Mi cuenta', billing: 'Pagos', bug: 'Algo no funciona', content: 'Entrenamientos o comidas', other: 'Otro' },
        send: 'Enviar',
        sending: 'Enviando...',
        sent: 'Recibido. Te respondemos a tu correo lo antes posible.',
        // NOT "email us instead": hello@ has no MX and bounces, so that would send a member whose
        // message just failed to a second dead end.
        error: 'No se pudo enviar. Inténtalo de nuevo en un momento.',
        attach: '📷 Adjuntar una captura de pantalla (opcional)',
        tooBig: 'Esa imagen pesa más de 10MB. Intenta con una captura más pequeña.',
        readFail: 'No se pudo leer esa imagen. Intenta con otra.',
      }
    : {
        h: 'Send us a message',
        sub: 'Tell us what happened and we will reply by email.',
        email: 'Your email',
        subject: 'Subject',
        body: 'What happened. The more detail, the faster we can fix it.',
        cat: { account: 'My account', billing: 'Billing', bug: 'Something is broken', content: 'Workouts or meals', other: 'Something else' },
        send: 'Send',
        sending: 'Sending...',
        sent: 'Got it. We will reply to your email as soon as we can.',
        error: 'That did not send. Please try again in a moment.',
        attach: '📷 Attach a screenshot (optional)',
        tooBig: 'That image is over 10MB. Try a smaller screenshot.',
        readFail: 'Could not read that image. Try another one.',
      };

  const canSend = subject.trim().length >= 3 && body.trim().length >= 10 && /\S+@\S+\.\S+/.test(email);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!canSend || state === 'sending') return;
    setState('sending');
    try {
      const res = await fetch('/api/support/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body, email, category, attachment: shot ?? undefined, turnstile_token: token ?? undefined }),
      });
      setState(res.ok ? 'sent' : 'error');
    } catch {
      setState('error');
    }
  };

  if (state === 'sent') {
    return (
      <div className="rounded-2xl bg-warm px-5 py-6">
        <p className="text-[15px] leading-[1.6] text-ink">{t.sent}</p>
      </div>
    );
  }

  const field = 'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] outline-none focus:border-ink';

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div>
        <h2 className="font-display text-[22px] leading-tight">{t.h}</h2>
        <p className="mt-1 text-[14px] text-soft">{t.sub}</p>
      </div>
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.email} autoComplete="email" className={field} />
      <select value={category} onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])} className={field}>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {t.cat[c]}
          </option>
        ))}
      </select>
      <input required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t.subject} maxLength={200} className={field} />
      <textarea required value={body} onChange={(e) => setBody(e.target.value)} placeholder={t.body} rows={5} maxLength={5000} className={`${field} resize-y`} />
      <div>
        <label className="block cursor-pointer rounded-xl border border-dashed border-line px-3.5 py-3 text-[14px] text-soft hover:border-ink hover:text-ink">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/heic,image/heif,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setShotErr('');
              if (!f) { setShot(null); setShotName(''); return; }
              // 10MB matches the bucket limit. Checked here so a member on a phone learns instantly
              // instead of waiting out a long upload that the server was always going to reject.
              if (f.size > 10 * 1024 * 1024) { setShotErr(t.tooBig); setShot(null); setShotName(''); return; }
              const r = new FileReader();
              r.onload = () => { setShot(String(r.result)); setShotName(f.name); };
              r.onerror = () => setShotErr(t.readFail);
              r.readAsDataURL(f);
            }}
          />
          {shotName ? `📎 ${shotName}` : t.attach}
        </label>
        {shot && (
          // Show it back. A member who attached the wrong screenshot should find out here, not after
          // support replies asking for a different one.
          // eslint-disable-next-line @next/next/no-img-element -- local data URL, never optimizable
          <img src={shot} alt="" className="mt-2 max-h-40 rounded-lg border border-line object-contain" />
        )}
        {shotErr && <p role="alert" className="mt-1 text-[13px] text-alert-ink">{shotErr}</p>}
      </div>
      <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} locale={es ? 'es' : 'en'} onToken={setToken} />
      {state === 'error' && (
        <p role="alert" className="text-[13px] text-alert-ink">
          {t.error}
        </p>
      )}
      <button type="submit" disabled={!canSend || state === 'sending'} className="tf-press self-start rounded-full bg-ink px-7 py-3 text-[14px] font-bold uppercase tracking-[0.02em] text-surface disabled:opacity-40">
        {state === 'sending' ? t.sending : t.send}
      </button>
    </form>
  );
}
