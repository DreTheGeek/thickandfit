import type { ReactElement } from 'react';
import Link from 'next/link';

// Shared shell for the Terms and Privacy routes. Renders the document title, the in-force version
// (kept in lockstep with CONSENT_VERSION so a captured consent always maps to readable text), and an
// honest interim notice. The full legal copy is a human deliverable (see launch punch-list) -- this
// component intentionally does NOT contain fabricated clauses.
export function LegalPage({
  title,
  version,
  notice,
  contactLabel,
  contactEmail,
  homeLabel,
}: {
  title: string;
  version: string;
  notice: string;
  contactLabel: string;
  contactEmail: string;
  homeLabel: string;
}): ReactElement {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-ink">
      <h1 className="text-3xl font-bold uppercase tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-faint">v{version}</p>
      <p className="mt-8 text-[15px] leading-relaxed text-soft">{notice}</p>
      <p className="mt-6 text-[15px] text-soft">
        {contactLabel}{' '}
        <a href={`mailto:${contactEmail}`} className="underline underline-offset-2 hover:text-ink">
          {contactEmail}
        </a>
      </p>
      <Link
        href="/"
        className="mt-10 inline-block text-sm text-muted underline-offset-4 transition hover:text-ink hover:underline"
      >
        {homeLabel}
      </Link>
    </main>
  );
}
