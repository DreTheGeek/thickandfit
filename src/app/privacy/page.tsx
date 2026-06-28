import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { getLocale } from 'next-intl/server';
import { LegalPage } from '@/components/legal/legal-page';
import { CONSENT_VERSION } from '@/lib/legal/consent';

const CONTACT_EMAIL = 'hello@teamthickandfit.com';

export const metadata: Metadata = {
  title: 'Privacy Policy, Thick & Fit',
  description: 'How Thick & Fit collects, uses, and protects your data.',
};

// Sign-up captures versioned consent to this Privacy Policy; this route makes the referenced document
// reachable. Final legal copy is pending review (see launch punch-list) -- interim notice only.
export default async function PrivacyPage(): Promise<ReactElement> {
  const es = (await getLocale()) === 'es';
  return (
    <LegalPage
      title={es ? 'Política de Privacidad' : 'Privacy Policy'}
      version={CONSENT_VERSION}
      notice={
        es
          ? 'Estamos finalizando la versión completa de nuestra Política de Privacidad antes del lanzamiento público. Usamos tus datos únicamente para ofrecerte el servicio de coaching y nunca vendemos tu información personal. Si tienes preguntas sobre cómo manejamos tus datos antes de la publicación de la versión final, contáctanos.'
          : 'We are finalizing the full text of our Privacy Policy ahead of public launch. We use your data only to deliver the coaching service and never sell your personal information. If you have questions about how we handle your data before the final version is published, please reach out.'
      }
      contactLabel={es ? 'Contacto:' : 'Contact:'}
      contactEmail={CONTACT_EMAIL}
      homeLabel={es ? '← Volver al inicio' : '← Back to home'}
    />
  );
}
