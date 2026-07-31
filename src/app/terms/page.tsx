import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { getLocale } from 'next-intl/server';
import { LegalPage } from '@/components/legal/legal-page';
import { CONSENT_VERSION } from '@/lib/legal/consent';

// NOT an email address. hello@teamthickandfit.com has no MX record and bounces, so the contact
// published on our own Terms reached nobody. /support is a form that lands on the support board.
const CONTACT_PATH = '/support';

export const metadata: Metadata = {
  title: 'Terms of Service, Thick & Fit',
  description: 'The terms that govern your use of Thick & Fit.',
};

// Sign-up captures versioned consent to these Terms; this route makes the referenced document
// reachable. Final legal copy is pending review (see launch punch-list) -- interim notice only.
export default async function TermsPage(): Promise<ReactElement> {
  const es = (await getLocale()) === 'es';
  return (
    <LegalPage
      title={es ? 'Términos de Servicio' : 'Terms of Service'}
      version={CONSENT_VERSION}
      notice={
        es
          ? 'Estamos finalizando la versión completa de nuestros Términos de Servicio antes del lanzamiento público. Mientras tanto, al usar Thick & Fit aceptas usar el servicio de forma legal y responsable. Si tienes preguntas sobre los términos antes de la publicación de la versión final, contáctanos.'
          : 'We are finalizing the full text of our Terms of Service ahead of public launch. In the meantime, by using Thick & Fit you agree to use the service lawfully and responsibly. If you have questions about the terms before the final version is published, please reach out.'
      }
      contactLabel={es ? 'Contacto:' : 'Contact:'}
      contactHref={es ? `/es${CONTACT_PATH}` : CONTACT_PATH}
      contactText={es ? 'Escríbenos desde la página de Soporte' : 'Reach us from the Support page'}
      homeLabel={es ? '← Volver al inicio' : '← Back to home'}
    />
  );
}
