import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { getLocale } from 'next-intl/server';
import { LegalPage } from '@/components/legal/legal-page';
import { CONSENT_VERSION } from '@/lib/legal/consent';
import { privacySections } from '@/lib/legal/privacy-content';

// NOT an email address. hello@teamthickandfit.com has no MX record and bounces, so publishing it
// here meant a data-subject request under this very policy went nowhere. /support is a form that
// reaches the team's support board.
const CONTACT_PATH = '/support';

export const metadata: Metadata = {
  title: 'Privacy Policy, Thick & Fit',
  description: 'How Thick & Fit collects, uses, and protects your data.',
};

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
      contactLabel={es ? 'Contacto:' : 'Contact:'}
      contactHref={es ? `/es${CONTACT_PATH}` : CONTACT_PATH}
      contactText={es ? 'Escríbenos desde la página de Soporte' : 'Reach us from the Support page'}
      homeLabel={es ? '← Volver al inicio' : '← Back to home'}
    />
  );
}
