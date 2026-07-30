import type { ReactElement } from 'react';
import Link from 'next/link';
import type { PrivacySection } from '@/lib/legal/privacy-content';

// Shared shell for the Terms and Privacy routes. Renders the document title, the in-force version
// (kept in lockstep with CONSENT_VERSION so a captured consent always maps to readable text), and an
// honest interim notice.
//
// This component still contains NO fabricated legal clauses. `sections` carries a FACTUAL
// data-practices disclosure (what is collected, which processor receives it, how to delete it),
// which is documentation of the system rather than drafted legal language. Governing law, arbitration
// and liability remain a human deliverable.
export function LegalPage({
  title,
  version,
  notice,
  contactLabel,
  contactEmail,
  homeLabel,
  sections,
}: {
  title: string;
  version: string;
  notice: string;
  contactLabel: string;
  contactEmail: string;
  homeLabel: string;
  sections?: PrivacySection[];
}): ReactElement {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-ink">
      <h1 className="text-3xl font-bold uppercase tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-faint">v{version}</p>
      <p className="mt-8 text-[15px] leading-relaxed text-soft">{notice}</p>

      {sections?.map((s) => (
        <section key={s.heading} className="mt-10">
          <h2 className="text-[18px] font-semibold text-ink">{s.heading}</h2>
          {s.body?.map((p) => (
            <p key={p} className="mt-3 text-[15px] leading-relaxed text-soft">
              {p}
            </p>
          ))}
          {s.bullets && (
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed text-soft">
              {s.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
          {s.vendors && (
            // Wide content scrolls inside its own container so the page body never scrolls sideways
            // on a phone, which is where most of this will be read.
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line text-[11px] uppercase tracking-[1px] text-faint">
                    <th className="py-2 pr-4 font-semibold">Who</th>
                    <th className="py-2 pr-4 font-semibold">What they receive</th>
                    <th className="py-2 font-semibold">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {s.vendors.map((v) => (
                    <tr key={v.name} className="border-b border-line align-top">
                      <td className="py-2.5 pr-4 font-semibold text-ink">{v.name}</td>
                      <td className="py-2.5 pr-4 text-soft">{v.data}</td>
                      <td className="py-2.5 text-soft">{v.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
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
