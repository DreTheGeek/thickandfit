// Privacy disclosure content, EN + ES.
//
// SCOPE OF THIS FILE, read before editing: this is a FACTUAL DATA-PRACTICES DISCLOSURE derived from
// what the code actually does, not drafted legal boilerplate. The distinction matters. LegalPage was
// written to avoid fabricating clauses, and that still holds: there is no governing-law, arbitration,
// warranty, or liability language here, because those need an attorney. What IS here is the part only
// engineering can write accurately, and the part App Store review and GDPR/CCPA actually demand:
// which data is collected, which third party receives it, why, and how a member gets rid of it.
//
// Every vendor below was verified against the codebase (src/lib/ai/models.ts routes through
// OpenRouter; Mux in src/lib/content/mux-import.ts; Sentry in instrumentation.ts; and so on). If you
// add a processor, add it HERE in the same commit: App Store privacy labels are checked against real
// SDK behavior and a mismatch is treated as misrepresentation rather than an oversight.

export type PrivacySection = {
  heading: string;
  /** Paragraphs of running text. */
  body?: string[];
  /** Bulleted facts. */
  bullets?: string[];
  /** Processor table: who gets what, and why. */
  vendors?: { name: string; data: string; purpose: string }[];
};

const VENDORS_EN: NonNullable<PrivacySection['vendors']> = [
  { name: 'Supabase', data: 'Your account, profile, health profile, logs, messages, and photos', purpose: 'Database, sign-in, and file storage. This is where your data lives.' },
  { name: 'Vercel', data: 'Requests to the app, including your IP address', purpose: 'Hosting and delivering the app.' },
  { name: 'Stripe', data: 'Name, email, and payment details', purpose: 'Taking payment. Card numbers go to Stripe directly; we never see or store them.' },
  { name: 'OpenRouter', data: 'Food photos and the text you send the coach', purpose: 'Routing those requests to the model that answers them. OpenRouter passes them to OpenAI, Google, or Anthropic depending on the feature.' },
  { name: 'OpenAI, Google, Anthropic', data: 'Food photos and coach messages, through OpenRouter', purpose: 'Reading a meal photo to estimate macros, and generating coaching replies.' },
  { name: 'Mux', data: 'Which videos you play and basic playback quality data', purpose: 'Delivering exercise videos.' },
  { name: 'Cloudflare', data: 'Your IP address on sign-up, and video delivery as a backup to Mux', purpose: 'Blocking bots on forms, and backup video hosting.' },
  { name: 'Resend', data: 'Your email address and the contents of emails we send you', purpose: 'Sending account email: sign-in links, receipts, and notifications.' },
  { name: 'GoHighLevel', data: 'Name, email, phone, language, and membership status', purpose: 'Coaching communication and marketing. Your health information is never sent here.' },
  { name: 'Twilio', data: 'Your phone number and the contents of texts we send you', purpose: 'Sending text messages, if you opt in.' },
  { name: 'Sentry', data: 'Technical error reports, which can include your account id', purpose: 'Finding and fixing crashes.' },
  { name: 'PostHog', data: 'How the app is used, such as which screens are opened', purpose: 'Understanding which features help and which do not.' },
];

const VENDORS_ES: NonNullable<PrivacySection['vendors']> = [
  { name: 'Supabase', data: 'Tu cuenta, perfil, perfil de salud, registros, mensajes y fotos', purpose: 'Base de datos, inicio de sesión y almacenamiento. Aquí viven tus datos.' },
  { name: 'Vercel', data: 'Las solicitudes a la app, incluida tu dirección IP', purpose: 'Alojar y entregar la app.' },
  { name: 'Stripe', data: 'Nombre, correo y datos de pago', purpose: 'Procesar el pago. Los números de tarjeta van directo a Stripe; nosotros nunca los vemos ni los guardamos.' },
  { name: 'OpenRouter', data: 'Fotos de comida y el texto que le envías a la entrenadora', purpose: 'Dirigir esas solicitudes al modelo que las responde. OpenRouter las pasa a OpenAI, Google o Anthropic según la función.' },
  { name: 'OpenAI, Google, Anthropic', data: 'Fotos de comida y mensajes, a través de OpenRouter', purpose: 'Leer la foto de un plato para estimar macros y generar respuestas de coaching.' },
  { name: 'Mux', data: 'Qué videos reproduces y datos básicos de calidad de reproducción', purpose: 'Entregar los videos de ejercicios.' },
  { name: 'Cloudflare', data: 'Tu dirección IP al registrarte, y entrega de video como respaldo de Mux', purpose: 'Bloquear bots en los formularios y alojamiento de video de respaldo.' },
  { name: 'Resend', data: 'Tu correo y el contenido de los correos que te enviamos', purpose: 'Enviar correos de la cuenta: enlaces de acceso, recibos y avisos.' },
  { name: 'GoHighLevel', data: 'Nombre, correo, teléfono, idioma y estado de membresía', purpose: 'Comunicación de coaching y marketing. Tu información de salud nunca se envía aquí.' },
  { name: 'Twilio', data: 'Tu número de teléfono y el contenido de los mensajes que te enviamos', purpose: 'Enviar mensajes de texto, si los aceptas.' },
  { name: 'Sentry', data: 'Reportes técnicos de errores, que pueden incluir el id de tu cuenta', purpose: 'Encontrar y arreglar fallas.' },
  { name: 'PostHog', data: 'Cómo se usa la app, por ejemplo qué pantallas se abren', purpose: 'Entender qué funciones ayudan y cuáles no.' },
];

/** Column headers for the processor table. */
export type VendorTableLabels = { who: string; data: string; purpose: string };

// These live here, next to the rows they label, and NOT in a message file. They are part of the legal
// document, so the translation has to move in the same commit as the disclosure it heads. They were
// hardcoded English in the shared LegalPage component, which meant /es/privacy served Spanish vendor
// rows under "Who / What they receive / Why": the exact failure that splitting them from their
// neighbours invites.
export function vendorTableLabels(es: boolean): VendorTableLabels {
  return es
    ? { who: 'Quién', data: 'Qué recibe', purpose: 'Para qué' }
    : { who: 'Who', data: 'What they receive', purpose: 'Why' };
}

export function privacySections(es: boolean): PrivacySection[] {
  if (es) {
    return [
      {
        heading: 'Qué recopilamos',
        body: ['Solo recopilamos lo que hace falta para entrenarte. Esto es todo:'],
        bullets: [
          'Cuenta: nombre, correo, teléfono e idioma preferido.',
          'Tu cuerpo y tus metas: sexo, edad, estatura, peso, peso meta, porcentaje de grasa corporal (opcional), nivel de actividad y lo que quieres lograr.',
          'Salud y seguridad: lesiones, condiciones como SOP o tiroides, embarazo o posparto, y el cuestionario de seguridad previo al ejercicio.',
          'Nutrición: lo que registras, incluidas las fotos de tus comidas.',
          'Entrenamiento: los entrenamientos que completas y tu progreso.',
          'Progreso: tu peso a lo largo del tiempo, medidas y las fotos que subas.',
          'Comunidad y mensajes: lo que publicas y lo que le escribes a tu entrenadora.',
          'Técnico: dirección IP, tipo de dispositivo y datos básicos de uso.',
        ],
      },
      {
        heading: 'Tu información de salud',
        body: [
          'Tu información de salud recibe el trato más estricto de todo lo que guardamos. Se usa para una sola cosa: armar y ajustar tu plan, y mantenerte segura al entrenar.',
          'Nunca la usamos para publicidad ni marketing, nunca la enviamos a nuestras herramientas de marketing y nunca la vendemos. Esa separación está construida en el sistema, no es solo una promesa.',
        ],
      },
      {
        heading: 'Para qué la usamos',
        bullets: [
          'Calcular tus calorías y macros y generar tu plan.',
          'Adaptar los entrenamientos a tus lesiones, condiciones y equipo disponible.',
          'Estimar los macros de las fotos de comida que subes.',
          'Responder tus mensajes con contexto de tu progreso.',
          'Cobrar tu suscripción y enviarte recibos.',
          'Avisarte sobre tu cuenta y, si lo aceptas, novedades del programa.',
        ],
      },
      {
        heading: 'Quién más ve tus datos',
        body: [
          'No vendemos tu información personal. Nunca. Trabajamos con los proveedores de abajo para que la app funcione, y cada uno recibe solo lo que necesita para su parte.',
        ],
        vendors: VENDORS_ES,
      },
      {
        heading: 'Cuánto la guardamos y cómo la borras',
        bullets: [
          'Puedes borrar tu cuenta dentro de la app, en Cuenta, en cualquier momento. No hace falta escribirnos.',
          'Al borrarla, eliminamos tu perfil, tu perfil de salud, tus registros, tus fotos y tus mensajes, y cancelamos tu suscripción activa.',
          'Conservamos los registros de pago el tiempo que la ley fiscal y contable exige, aunque borres la cuenta.',
          'También puedes descargar una copia de tus datos desde Cuenta antes de borrarlos.',
        ],
      },
      {
        heading: 'Tus decisiones',
        bullets: [
          'Puedes editar tu perfil de salud cuando quieras en Tú, Perfil de salud.',
          'Puedes darte de baja de los correos de marketing sin perder los correos de tu cuenta.',
          'Puedes retirar tu consentimiento borrando tu cuenta.',
          'Si quieres saber qué guardamos de ti, pregúntanos desde la página de Soporte y te respondemos.',
        ],
      },
      {
        heading: 'Edad',
        body: ['Thick & Fit no es para menores de 13 años y no recopilamos datos de menores de 13 a sabiendas.'],
      },
      {
        heading: 'Cambios',
        body: [
          'Si cambiamos cómo manejamos tus datos, actualizamos esta página y su versión. Si el cambio es importante, te avisamos.',
        ],
      },
    ];
  }

  return [
    {
      heading: 'What we collect',
      body: ['We collect only what it takes to coach you. This is the whole list:'],
      bullets: [
        'Account: your name, email, phone, and preferred language.',
        'Your body and goals: sex, age, height, weight, goal weight, body fat percentage (optional), activity level, and what you are working toward.',
        'Health and safety: injuries, conditions such as PCOS or thyroid issues, pregnancy or postpartum status, and the pre-exercise safety questionnaire.',
        'Nutrition: what you log, including the photos you take of your meals.',
        'Training: the workouts you complete and your progress through them.',
        'Progress: your weight over time, measurements, and any photos you upload.',
        'Community and messages: what you post, and what you write to your coach.',
        'Technical: IP address, device type, and basic usage data.',
      ],
    },
    {
      heading: 'Your health information',
      body: [
        'Your health information gets the strictest handling of anything we hold. It is used for one thing: building and adjusting your plan, and keeping you safe while you train.',
        'We never use it for advertising or marketing, we never send it to our marketing tools, and we never sell it. That separation is built into the system, not just promised.',
      ],
    },
    {
      heading: 'What we use it for',
      bullets: [
        'Calculating your calories and macros and generating your plan.',
        'Adapting workouts to your injuries, conditions, and available equipment.',
        'Estimating macros from the food photos you upload.',
        'Answering your messages with your actual progress in view.',
        'Billing your subscription and sending receipts.',
        'Telling you about your account and, if you opt in, about the program.',
      ],
    },
    {
      heading: 'Who else sees your data',
      body: [
        'We do not sell your personal information. Not ever. We work with the providers below to run the app, and each one receives only what it needs to do its part.',
      ],
      vendors: VENDORS_EN,
    },
    {
      heading: 'How long we keep it, and how you delete it',
      bullets: [
        'You can delete your account inside the app, under Account, at any time. You do not need to email anyone.',
        'Deleting removes your profile, health profile, logs, photos, and messages, and cancels an active subscription.',
        'We keep payment records for as long as tax and accounting law requires, even after you delete.',
        'You can also download a copy of your data from Account before you delete it.',
      ],
    },
    {
      heading: 'Your choices',
      bullets: [
        'You can edit your health profile any time under You, Health profile.',
        'You can unsubscribe from marketing email without losing account email.',
        'You can withdraw consent by deleting your account.',
        'If you want to know what we hold about you, ask us from the Support page and we will tell you.',
      ],
    },
    {
      heading: 'Age',
      body: ['Thick & Fit is not for children under 13, and we do not knowingly collect data from anyone under 13.'],
    },
    {
      heading: 'Changes',
      body: [
        'If we change how we handle your data we update this page and its version number. If the change is significant, we will tell you.',
      ],
    },
  ];
}
