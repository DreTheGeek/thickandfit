// Spanish twin of /vs/cal-ai. A real file, not a re-export: the /vs pages hold their copy inline, so
// a re-export would serve English at a Spanish URL. See the note at the top of
// src/app/es/vs/myfitnesspal/page.tsx.
//
// The Spanish is written, not translated. The winnable query is "app para contar calorias con foto
// en español" and "alternativa a Cal AI". Voice per .planning/STEPHANIE-VOICE-BIBLE.md: tu, warm,
// direct, never a textbook translation.
//
// BRAND RULE: "Cal AI" appears only as the competitor's product name, which is the search term. Our
// own scan is never called that, in either language. Every claim mirrors the corrected English page,
// verified against calai.app on 2026-08-04: their own site publishes "about 80% accurate" and a
// 3-day trial, so the page states those rather than characterizing them.
import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/v2/shell';
import { LSection, LH2, LBody, LEyebrow } from '@/components/marketing/v2/ui';
import { Icon } from '@/components/ui/icons';
import { JsonLd } from '@/components/seo/json-ld';
import { graph, faqPageNode, breadcrumbNode, type JsonLdNode } from '@/lib/seo/schema';
import { configuredTrialDays } from '@/lib/billing/trial-shared';

export const dynamic = 'force-dynamic';

const TITLE = 'Alternativa a Cal AI que sí entiende la comida latina | Thick & Fit';
const DESCRIPTION =
  'Una foto sola es una suposicion, y falla mas justo en los platos mezclados y con salsa de la ' +
  'comida de casa. Thick & Fit saca los macros de datos validados, convierte carnes, arroz y ' +
  'frijoles de cocido a crudo, en español y en inglés, con entrenamientos y una coach de verdad.';

export function generateMetadata(): Metadata {
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: {
      canonical: '/es/vs/cal-ai',
      languages: { en: '/vs/cal-ai', es: '/es/vs/cal-ai', 'x-default': '/vs/cal-ai' },
    },
    openGraph: {
      url: '/es/vs/cal-ai',
      title: TITLE,
      description: DESCRIPTION,
      images: ['/assets/images/open-graph.jpg'],
    },
  };
}

type Row = { label: string; them: string; us: string };
const ROWS: readonly Row[] = [
  { label: 'Cómo funciona', them: 'Una foto y luego un estimado', us: 'Una foto, respaldada con datos validados' },
  { label: 'Platos mezclados y con salsa', them: 'Donde el estimado por foto se cae', us: 'Se leen ingrediente por ingrediente' },
  { label: 'Cocido o crudo', them: 'La conversión te toca a ti', us: 'Carnes, arroz y frijoles, convertidos para ti' },
  { label: 'Comida de casa', them: 'No es para lo que se hizo', us: 'Hecha para tu comida, en español' },
  { label: 'Más que un número', them: 'Solo un contador', us: 'Entrenamientos, una coach y una comunidad' },
  { label: 'Precisión', them: 'Cerca del 80%, según su propia cifra', us: 'Datos validados detrás de cada gramo' },
  { label: 'Al registrarte', them: '3 días gratis y después se renueva sola', us: 'El precio se ve antes, cancelas con un toque, sin renovación sorpresa' },
];

const FAQ: readonly { question: string; answer: string }[] = [
  {
    question: '¿Son precisas las apps que cuentan calorías con una foto?',
    answer:
      'Con una comida simple y sola, un estimado por foto puede quedar cerca. Con comida de verdad, ' +
      'platos mezclados, salsas y comida hecha en casa, se vuelve mucho menos confiable, porque una ' +
      'cámara no ve el aceite, ni qué tan hondo está el plato, ni lo que quedó debajo. Y esa es justo ' +
      'la comida que comemos todos los días.',
  },
  {
    question: '¿Por qué Thick & Fit acierta más que un escáner de fotos?',
    answer:
      'Thick & Fit usa la foto para identificar qué comiste y cuánto, y después saca los macros de ' +
      'fuentes validadas (USDA FoodData Central y Open Food Facts) en vez de adivinar los números. En ' +
      'carnes, arroz y frijoles también regresa el peso cocido a crudo, que es donde se esconden los ' +
      'errores más grandes. No prometemos ser perfectas en todo, prometemos acertar en la comida que ' +
      'de verdad comes.',
  },
  {
    question: '¿Entiende los platos latinos y el cocido contra el crudo?',
    answer:
      'Sí. Thick & Fit está hecha para leer la comida de casa, arroz con pollo, tamales, arepas y ' +
      'pupusas, en español. La conversión de cocido a crudo cubre carnes, arroz y frijoles hoy, las ' +
      'tres que más te mueven los números, y esa lista crece a medida que Stephanie agrega más de sus ' +
      'comidas.',
  },
  {
    question: '¿Es solo otro escáner de calorías?',
    answer:
      'No. Escanear tu comida es una función. Thick & Fit es un sistema de coaching: nutrición, ' +
      'entrenamientos con demos filmadas según el equipo que tengas, el método de Stephanie en su ' +
      'voz, una comunidad, y una línea de tiempo de tu transformación. Un escáner no te sostiene. Una ' +
      'coach sí.',
  },
  {
    question: '¿Puedo cancelar fácil?',
    answer:
      'Sí. El precio se ve antes de que pagues, no hay contrato, y cancelas con un toque desde la ' +
      'app, sin pasos escondidos y sin llamadas. Conservas el acceso hasta que termine el periodo ' +
      'que ya pagaste.',
  },
];

function Cell({ children, kind }: { children: string; kind: 'them' | 'us' }): ReactElement {
  return (
    <td className="border-t border-white/10 px-4 py-4 align-top text-[14px] sm:text-[15px]">
      <span className="flex items-start gap-2">
        <span className={`mt-0.5 shrink-0 ${kind === 'us' ? 'text-[#ff2d55]' : 'text-white/30'}`}>
          <Icon name={kind === 'us' ? 'check' : 'minus'} size={16} strokeWidth={2.5} />
        </span>
        <span className={kind === 'us' ? 'font-semibold text-white' : 'text-white/60'}>{children}</span>
      </span>
    </td>
  );
}

/** Sibling links, so a crawler that finds one Spanish comparison finds the other two and the
 *  English original. Nothing in the nav or footer points into the /vs cluster yet. */
function MasComparaciones(): ReactElement {
  const links: readonly { href: string; label: string }[] = [
    { href: '/es/vs/myfitnesspal', label: 'Thick & Fit vs MyFitnessPal' },
    { href: '/es/vs/fitia', label: 'Thick & Fit vs Fitia' },
    { href: '/vs/cal-ai', label: 'This page in English' },
  ];
  return (
    <LSection tone="raised">
      <LEyebrow className="text-white">Sigue comparando</LEyebrow>
      <LH2 className="mt-1 text-white">Mira las demás</LH2>
      <div className="mt-8 flex flex-wrap gap-3">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-full border border-white/20 px-6 py-3 text-[14px] font-semibold text-white transition-colors hover:border-white/50"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </LSection>
  );
}

export default function EsVsCalAiPage(): ReactElement {
  // El CTA lleva a /join, la lista de espera, y no hay prueba configurada salvo que STRIPE_TRIAL_DAYS
  // esté puesta: "Empieza 3 días gratis" prometía una oferta que el producto no iba a cumplir. Lee el
  // mismo valor que manda el checkout, así la frase y la oferta se encienden juntas.
  const trial = configuredTrialDays();
  const ctaLabel = trial > 0 ? `Empieza ${trial} días gratis` : 'Unirme a la lista';
  const nodes = [
    faqPageNode([...FAQ]),
    breadcrumbNode([
      { name: 'Inicio', path: '/es' },
      { name: 'Thick & Fit vs Cal AI', path: '/es/vs/cal-ai' },
    ]),
  ].filter((n): n is JsonLdNode => n !== null);

  return (
    <MarketingShell>
      <JsonLd data={graph(nodes)} />

      {/* Hero */}
      <section className="border-b border-white/10 bg-[#0e0e0e] px-5 pb-16 pt-20 sm:px-8 lg:pb-24 lg:pt-28">
        <div className="mx-auto w-full max-w-[1000px] text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-white/45">
            Thick &amp; Fit vs Cal AI
          </p>
          <h1 className="mx-auto mt-4 max-w-[15ch] text-[40px] font-extrabold uppercase leading-[0.98] tracking-[-0.01em] text-white sm:text-[56px] lg:text-[64px]">
            Una foto adivina. Nosotras lo comprobamos.
          </h1>
          <p className="mx-auto mt-6 max-w-[54ch] text-[17px] leading-[1.5] text-white/75 sm:text-[19px]">
            Las apps de foto fallan más justo con la comida que sí comes: platos mezclados, salsas, lo
            que cocina tu mamá. Thick &amp; Fit respalda el número con datos reales, te regresa carnes,
            arroz y frijoles de cocido a crudo, y pone una coach detrás.
          </p>
          <div className="mt-8">
            <Link
              href="/es/join"
              className="inline-block rounded-full bg-[#ff2d55] px-9 py-4 text-[15px] font-bold uppercase tracking-[0.02em] text-white transition-opacity hover:opacity-90"
            >
              {ctaLabel}
            </Link>
            <p className="mt-3 text-[13px] text-white/50">
              Cancela cuando quieras, con un toque.
            </p>
          </div>
        </div>
      </section>

      {/* La tabla */}
      <LSection tone="dark">
        <LH2 className="text-center text-white">Lado a lado</LH2>
        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr>
                <th className="w-[26%] px-4 pb-3" />
                <th className="px-4 pb-3 text-[13px] font-bold uppercase tracking-[0.1em] text-white/55">
                  Cal AI
                </th>
                <th className="px-4 pb-3 text-[13px] font-bold uppercase tracking-[0.1em] text-[#ff2d55]">
                  Thick &amp; Fit
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label}>
                  <td className="border-t border-white/10 px-4 py-4 align-top text-[13px] font-semibold uppercase tracking-[0.06em] text-white/50">
                    {row.label}
                  </td>
                  <Cell kind="them">{row.them}</Cell>
                  <Cell kind="us">{row.us}</Cell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LSection>

      {/* Una foto sola es una suposición */}
      <LSection tone="bone">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <LEyebrow className="text-[#0e0e0e]">Precisión, con honestidad</LEyebrow>
            <LH2 className="mt-1 text-[#0e0e0e]">La cámara no ve el aceite</LH2>
            <LBody className="mt-5 text-[#4a4a4a]">
              No ve la mantequilla debajo del arroz ni qué tan hondo está el plato. Entonces una app de
              pura foto adivina, y adivina peor justo en los platos caseros y mezclados que llenan tu
              semana. Thick &amp; Fit usa la foto para saber qué y cuánto, después saca los números
              reales de datos validados y te regresa carnes, arroz y frijoles de cocido a crudo.
              Honesto le gana a impresionante.
            </LBody>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/shoot/atlanta-profile.avif"
            alt="Stephanie Pantoja"
            className="aspect-[4/5] w-full rounded-xl object-cover object-[center_20%]"
          />
        </div>
      </LSection>

      {/* Su método, no un truco */}
      <LSection tone="dark">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/shoot/deadlift.avif"
            alt="Stephanie Pantoja"
            className="aspect-[4/5] w-full rounded-xl object-cover object-[center_30%] lg:order-2"
          />
          <div className="lg:order-1">
            <LEyebrow className="text-white">Más que un escaneo</LEyebrow>
            <LH2 className="mt-1 text-white">Un escáner no te entrena</LH2>
            <LBody className="mt-5 text-[#bcbcbc]">
              Contar una comida nunca cambió a nadie por sí solo. Thick &amp; Fit es el método de
              Stephanie trabajando para ti todos los días: entrenamientos armados con el equipo que
              tengas, su equipo en tu esquina, una comunidad que nota cuando te quedas callada, y una
              línea de tiempo donde te ves cambiar. El número es el principio, no todo.
            </LBody>
            <Link
              href="/es/join"
              className="mt-8 inline-block rounded-full bg-[#ff2d55] px-9 py-4 text-[15px] font-bold uppercase tracking-[0.02em] text-white transition-opacity hover:opacity-90"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      </LSection>

      <MasComparaciones />

      {/* Preguntas */}
      <LSection tone="dark" id="faq">
        <LH2 className="text-white">Preguntas</LH2>
        <div className="mt-8 divide-y divide-white/10 border-t border-white/10">
          {FAQ.map((item) => (
            <details key={item.question} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-bold text-white">
                {item.question}
                <span className="shrink-0 text-white/40 transition-transform group-open:rotate-45">
                  <Icon name="plus" size={20} />
                </span>
              </summary>
              <p className="mt-3 max-w-[70ch] text-[15px] leading-[1.6] text-[#bcbcbc]">{item.answer}</p>
            </details>
          ))}
        </div>
      </LSection>

      {/* Cierre */}
      <LSection tone="raised">
        <div className="text-center">
          <LH2 className="text-white">
            Deja de adivinar.
            <br />
            <span className="text-[#ff2d55]">Empieza a saber.</span>
          </LH2>
          <div className="mt-8">
            <Link
              href="/es/join"
              className="inline-block rounded-full bg-[#ff2d55] px-9 py-4 text-[15px] font-bold uppercase tracking-[0.02em] text-white transition-opacity hover:opacity-90"
            >
              {ctaLabel}
            </Link>
            <p className="mt-3 text-[13px] text-white/50">
              $19.97 al mes de precio fundador, $24.97 después de la ventana
              fundadora. Cancela cuando quieras, con un toque.
            </p>
          </div>
        </div>
      </LSection>
    </MarketingShell>
  );
}
