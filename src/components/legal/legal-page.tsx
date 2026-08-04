import type { ReactElement } from 'react';
import Link from 'next/link';
import type { PrivacySection, VendorTableLabels } from '@/lib/legal/privacy-content';

// Shared shell for the Terms and Privacy routes. Renders the document title, the in-force version
// (kept in lockstep with CONSENT_VERSION so a captured consent always maps to readable text), and an
// honest interim notice.
//
// This component still contains NO fabricated legal clauses. `sections` carries a FACTUAL
// data-practices disclosure (what is collected, which processor receives it, how to delete it),
// which is documentation of the system rather than drafted legal language. Governing law, arbitration
// and liability remain a human deliverable.

// `sections` and `vendorLabels` are a PAIR, deliberately, and the union below is what enforces it.
// The processor table's column headers used to be hardcoded English JSX in this file, so /es/privacy
// rendered correctly translated Spanish vendor rows under "Who / What they receive / Why". Making the
// labels a plain optional prop would leave the same bug one forgotten call site away; requiring them
// with the sections they head means a caller CANNOT ship the table without saying what language it is
// in. Terms passes no sections, so it stays valid unchanged.
type LegalPageProps = {
  title: string;
  version: string;
  notice: string;
  contactLabel: string;
  /** Where a data-subject request actually reaches a human. See the note at the render site. */
  contactHref: string;
  contactText: string;
  homeLabel: string;
} & (
  | { sections: PrivacySection[]; vendorLabels: VendorTableLabels }
  | { sections?: undefined; vendorLabels?: undefined }
);

export function LegalPage({
  title,
  version,
  notice,
  contactLabel,
  contactHref,
  contactText,
  homeLabel,
  sections,
  vendorLabels,
}: LegalPageProps): ReactElement {
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
          {s.vendors && vendorLabels && (
            // Wide content scrolls inside its own container so the page body never scrolls sideways
            // on a phone, which is where most of this will be read.
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line text-[11px] uppercase tracking-[1px] text-faint">
                    <th className="py-2 pr-4 font-semibold">{vendorLabels.who}</th>
                    <th className="py-2 pr-4 font-semibold">{vendorLabels.data}</th>
                    <th className="py-2 font-semibold">{vendorLabels.purpose}</th>
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
      {/*
        A LINK, not a mailto. These pages named hello@teamthickandfit.com as the legal contact, and
        that address has no MX record, so a data-subject request sent there bounced silently. A
        privacy policy whose contact channel does not work is worse than useless: it is a documented
        promise we could not keep, on the page a regulator or an App Store reviewer reads first.
        /support is a form that reaches the team's board. Restore an address here once inbound mail
        is live (see .planning/SUPPORT-TRIAGE-AGENT.md).
      */}
      <p className="mt-6 text-[15px] text-soft">
        {contactLabel}{' '}
        <Link href={contactHref} className="underline underline-offset-2 hover:text-ink">
          {contactText}
        </Link>
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
