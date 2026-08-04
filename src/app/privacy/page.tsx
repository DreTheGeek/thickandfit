import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { getLocale } from 'next-intl/server';
import { LegalPage } from '@/components/legal/legal-page';
import { CONSENT_VERSION } from '@/lib/legal/consent';
import { privacySections, vendorTableLabels } from '@/lib/legal/privacy-content';
import { localeAlternates } from '@/lib/seo/locale-alternates';

// NOT an email address. hello@teamthickandfit.com has no MX record and bounces, so publishing it
// here meant a data-subject request under this very policy went nowhere. /support is a form that
// reaches the team's support board.
const CONTACT_PATH = '/support';

// The body of this page is bilingual, but its metadata was a STATIC English const, and the /es twin
// re-exports only the default export. So /es/privacy rendered a Spanish policy under an English tab
// title and an English search description, and advertised no hreflang at all even though /privacy is
// listed in BILINGUAL_PATHS. A static const cannot read the locale, which is why this is now
// generateMetadata: it reads the served locale and, via localeAlternates, emits the reciprocal
// en/es/x-default map that Google needs on BOTH URLs before it honours either one.
export async function generateMetadata(): Promise<Metadata> {
  const es = (await getLocale()) === 'es';
  return {
    title: es ? 'Política de Privacidad, Thick & Fit' : 'Privacy Policy, Thick & Fit',
    description: es
      ? 'Qué datos recopila Thick & Fit, quién más los ve y cómo los borras.'
      : 'How Thick & Fit collects, uses, and protects your data.',
    alternates: await localeAlternates('/privacy'),
    // App Store review and privacy regulators both need to reach this from a search or a link.
    robots: { index: true, follow: true },
  };
}

// Sign-up captures versioned consent to this Privacy Policy; this route makes the referenced document
// reachable.
//
// The placeholder that used to live here ("we are finalizing the full text") was a real exposure on
// two fronts: the waitlist is already collecting emails and phone numbers under it, and App Store
// review treats a policy that fails to name its data recipients as a submission blocker. The sections
// below are the factual disclosure, generated from the actual vendor list in the codebase. The
// remaining legal clauses (governing law, arbitration, liability) are still a human deliverable.
export default async function PrivacyPage(): Promise<ReactElement> {
  const es = (await getLocale()) === 'es';
  return (
    <LegalPage
      title={es ? 'Política de Privacidad' : 'Privacy Policy'}
      version={CONSENT_VERSION}
      notice={
        es
          ? 'Esto explica exactamente qué datos recopilamos, quién más los ve y cómo los borras. Sin letra chica: no vendemos tu información personal, y tu información de salud nunca se usa para marketing.'
          : 'This explains exactly what we collect, who else sees it, and how you delete it. No fine print: we do not sell your personal information, and your health information is never used for marketing.'
      }
      sections={privacySections(es)}
      // The vendor table's column headers travel with its rows. Both read the same `es`, so the
      // table cannot end up half-translated the way it was when the headers lived in the component.
      vendorLabels={vendorTableLabels(es)}
      contactLabel={es ? 'Contacto:' : 'Contact:'}
      contactHref={es ? `/es${CONTACT_PATH}` : CONTACT_PATH}
      contactText={es ? 'Escríbenos desde la página de Soporte' : 'Reach us from the Support page'}
      homeLabel={es ? '← Volver al inicio' : '← Back to home'}
    />
  );
}
