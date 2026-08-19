// Spanish twin of /vs/fitia. A real file, not a re-export: the /vs pages hold their copy inline, so
// a re-export would serve English at a Spanish URL. See src/app/es/vs/myfitnesspal/page.tsx.
//
// THIS IS THE MOST IMPORTANT OF THE THREE IN SPANISH. Fitia is a Peruvian app with deep LATAM food
// data and it is the real incumbent for exactly this query in exactly this language. So the Spanish
// version is the defensive page that matters, not a translation afterthought.
//
// CLAIM DISCIPLINE, unchanged from the English page and verified against fitia.app on 2026-08-04:
//   - Concede the nutrition database honestly. Pretending otherwise reads as false to anyone who has
//     used it, and this audience has used it.
//   - Fitia Teams is real ("Join teams and challenges, chat with others"), so the community row says
//     what they ship. Our edge is that Stephanie is IN ours, which is true and needs no exaggeration.
//   - The trial row comes from their own help centre: 3 days, annual plan only, then the year starts.
//   - BRAND RULE: our coach is Stephanie and her method, never called anything else, in any language.
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

const TITLE = 'Alternativa a Fitia con una coach de verdad | Thick & Fit';
const DESCRIPTION =
  'Fitia es un buen contador de comida, pero sigue siendo una app. Thick & Fit es Stephanie ' +
  'entrenandote: su metodo, su equipo, los entrenamientos, y una comunidad con ella adentro, en ' +
  'español y en inglés.';

export function generateMetadata(): Metadata {
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: {
      canonical: '/es/vs/fitia',
      languages: { en: '/vs/fitia', es: '/es/vs/fitia', 'x-default': '/vs/fitia' },
    },
    openGraph: {
      url: '/es/vs/fitia',
      title: TITLE,
      description: DESCRIPTION,
      images: ['/assets/images/open-graph.jpg'],
    },
  };
}

type Row = { label: string; them: string; us: string };
const ROWS: readonly Row[] = [
  { label: 'Qué es', them: 'Un contador y planificador de comidas', us: 'Un sistema de coaching completo' },
  { label: 'Quién te entrena', them: 'Una app', us: 'Stephanie, una persona de verdad, y su equipo' },
  { label: 'Entrenamiento', them: 'Está hecha para la comida', us: 'Entrenamientos con demos filmadas, tu equipo' },
  { label: 'Quién te sostiene', them: 'Otras usuarias', us: 'Su equipo te escribe cada semana' },
  { label: 'La comunidad', them: 'Equipos, retos y chat', us: 'Estas mujeres, con Stephanie adentro' },
  { label: 'El método', them: 'Un plan que genera la app', us: 'El de Stephanie, en su voz' },
  { label: 'Nutrición', them: 'Una base de datos fuerte', us: 'Datos validados, y carnes, arroz y frijoles de cocido a crudo' },
  { label: 'Al registrarte', them: '3 días, solo en el plan anual, y luego arranca el año', us: 'Mensual, el precio se ve antes, cancelas con un toque' },
];

const FAQ: readonly { question: string; answer: string }[] = [
  {
    question: '¿Thick & Fit es buena alternativa a Fitia?',
    answer:
      'Depende de qué quieras. Fitia es un contador y planificador de comidas fuerte, para hacerlo ' +
      'sola. Si lo único que quieres es registrar calorías por tu cuenta, lo hace bien. Si quieres a ' +
      'alguien en tu esquina, una coach de verdad, su método, entrenamientos y una comunidad, eso ya ' +
      'es otra cosa, y eso es Thick & Fit.',
  },
  {
    question: '¿Qué tiene Thick & Fit que no tiene un contador?',
    answer:
      'Una persona. Thick & Fit es Stephanie entrenándote: su entrenamiento armado con el equipo que ' +
      'tengas, su equipo escribiéndote cada semana, y su método de verdad en vez de un plan que ' +
      'generó una app. Fitia tiene equipos y retos. Lo que no tiene es a ella adentro contigo. Una ' +
      'app puede contar tu comida. No puede notar cuando te quedas callada.',
  },
  {
    question: '¿Thick & Fit también entiende la comida latina y el cocido contra el crudo?',
    answer:
      'Sí. Lee la comida de casa en español y saca los macros de datos validados. Las porciones ' +
      'cocidas regresan a crudo en carnes, arroz y frijoles, las tres que más te descuadran los ' +
      'números, y esa lista crece a medida que Stephanie agrega más de sus comidas. El registro es ' +
      'sólido. La diferencia es que vive dentro de un coaching de verdad, no solo.',
  },
  {
    question: '¿Está en español?',
    answer:
      'Sí. Thick & Fit es bilingüe desde el diseño, en español y en inglés, del lado de la miembro y ' +
      'del lado del coaching, y Stephanie entrena en los dos.',
  },
  {
    question: '¿Puedo cancelar fácil?',
    answer:
      'Sí. El precio se ve antes de que pagues, no hay contrato, y cancelas con un toque desde la ' +
      'app, sin pasos escondidos. Conservas el acceso hasta que termine el periodo que ya pagaste.',
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
    { href: '/es/vs/cal-ai', label: 'Thick & Fit vs Cal AI' },
    { href: '/vs/fitia', label: 'This page in English' },
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

export default function EsVsFitiaPage(): ReactElement {
  // El CTA lleva a /join, la lista de espera, y no hay prueba configurada salvo que STRIPE_TRIAL_DAYS
  // esté puesta: "Empieza 3 días gratis" prometía una oferta que el producto no iba a cumplir. Lee el
  // mismo valor que manda el checkout, así la frase y la oferta se encienden juntas.
  const trial = configuredTrialDays();
  const ctaLabel = trial > 0 ? `Empieza ${trial} días gratis` : 'Unirme a la lista';
  const nodes = [
    faqPageNode([...FAQ]),
    breadcrumbNode([
      { name: 'Inicio', path: '/es' },
      { name: 'Thick & Fit vs Fitia', path: '/es/vs/fitia' },
    ]),
  ].filter((n): n is JsonLdNode => n !== null);

  return (
    <MarketingShell>
      <JsonLd data={graph(nodes)} />

      {/* Hero */}
      <section className="border-b border-white/10 bg-[#0e0e0e] px-5 pb-16 pt-20 sm:px-8 lg:pb-24 lg:pt-28">
        <div className="mx-auto w-full max-w-[1000px] text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-white/45">
            Thick &amp; Fit vs Fitia
          </p>
          <h1 className="mx-auto mt-4 max-w-[16ch] text-[40px] font-extrabold uppercase leading-[0.98] tracking-[-0.01em] text-white sm:text-[56px] lg:text-[64px]">
            Fitia cuenta. Stephanie te entrena.
          </h1>
          <p className="mx-auto mt-6 max-w-[54ch] text-[17px] leading-[1.5] text-white/75 sm:text-[19px]">
            Fitia es buena contando. Pero ya has contado antes. Lo que no has tenido es una coach que
            se sepa tu nombre, tu plan y tu comida, y que se quede adentro contigo.
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
                  Fitia
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

      {/* Una herramienta o una persona */}
      <LSection tone="bone">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <LEyebrow className="text-[#0e0e0e]">Una app, o una persona</LEyebrow>
            <LH2 className="mt-1 text-[#0e0e0e]">Ya has contado antes</LH2>
            <LBody className="mt-5 text-[#4a4a4a]">
              Y ya sabes que un contador no te carga en las semanas en que quieres tirar la toalla.
              Fitia es una buena app. Thick &amp; Fit es una coach. El método de Stephanie, su equipo
              cada semana, y un cuarto lleno de mujeres haciendo esto a tu lado. Esa es la parte que
              una app nunca iba a poder ser.
            </LBody>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/shoot/rack-pose.avif"
            alt="Stephanie Pantoja"
            className="aspect-[4/5] w-full rounded-xl object-cover object-[center_20%]"
          />
        </div>
      </LSection>

      {/* Comida y entrenamiento juntos */}
      <LSection tone="dark">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/shoot/legpress.avif"
            alt="Stephanie Pantoja"
            className="aspect-[4/5] w-full rounded-xl object-cover object-[center_30%] lg:order-2"
          />
          <div className="lg:order-1">
            <LEyebrow className="text-white">Todo junto</LEyebrow>
            <LH2 className="mt-1 text-white">No solo lo que comes</LH2>
            <LBody className="mt-5 text-[#bcbcbc]">
              Una app de nutrición se detiene en el plato. Thick &amp; Fit te da también el
              entrenamiento: sus demos filmadas, armadas con el equipo que tengas, moviéndose junto a
              tu nutrición en vez de aparte. Un solo lugar, un solo plan, una sola coach.
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
            Deja de contar sola.
            <br />
            <span className="text-[#ff2d55]">Consigue una coach.</span>
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
