// Spanish twin of /vs/myfitnesspal.
//
// WHY THIS IS A REAL FILE AND NOT A RE-EXPORT. Every other /es page re-exports its English twin
// (`export { default } from '../../about/page'`) because those pages read their copy from
// src/messages/es.json, so the same component renders Spanish. The /vs pages hold their strings
// INLINE, so a re-export here would have served English at a Spanish URL: worse than having no
// Spanish page at all, because Google would index it as Spanish and find English.
//
// The Spanish is written, not translated. "Alternativa a MyFitnessPal en español" and "app para
// contar calorias de comida latina" are the queries we can realistically win, and half this audience
// reads Spanish first. Voice per .planning/STEPHANIE-VOICE-BIBLE.md: tu, never usted, warm, direct.
//
// Every claim here mirrors the corrected English page, which was verified against MyFitnessPal's own
// help centre on 2026-08-04. Do not let the two drift: if a row changes there, change it here.
import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/v2/shell';
import { LSection, LH2, LBody, LEyebrow } from '@/components/marketing/v2/ui';
import { Icon } from '@/components/ui/icons';
import { JsonLd } from '@/components/seo/json-ld';
import { graph, faqPageNode, breadcrumbNode, type JsonLdNode } from '@/lib/seo/schema';

export const dynamic = 'force-dynamic';

const TITLE = 'Alternativa a MyFitnessPal para comida latina | Thick & Fit';
const DESCRIPTION =
  'MyFitnessPal cuenta calorias con una base de datos que llenaron desconocidos. Thick & Fit te ' +
  'entrena: nutricion que entiende la comida de casa, convierte carnes, arroz y frijoles de cocido a ' +
  'crudo, en español y en inglés, con entrenamientos de verdad y Stephanie en tu esquina.';

export function generateMetadata(): Metadata {
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: {
      canonical: '/es/vs/myfitnesspal',
      languages: {
        en: '/vs/myfitnesspal',
        es: '/es/vs/myfitnesspal',
        'x-default': '/vs/myfitnesspal',
      },
    },
    openGraph: {
      url: '/es/vs/myfitnesspal',
      title: TITLE,
      description: DESCRIPTION,
      images: ['/assets/images/open-graph.jpg'],
    },
  };
}

type Row = { label: string; them: string; us: string };
const ROWS: readonly Row[] = [
  { label: 'Datos de comida', them: 'Entradas que subieron otros usuarios', us: 'Respaldados por USDA y Open Food Facts' },
  { label: 'Comida de casa', them: 'Genérica o americanizada', us: 'Lee tus platos, en español' },
  { label: 'Cocido o crudo', them: 'Tú haces la cuenta', us: 'Carnes, arroz y frijoles, convertidos para ti' },
  { label: 'Registrar la comida', them: 'Buscar y escribir', us: 'Una foto, el código de barras o una línea de texto' },
  { label: 'Idioma', them: 'Una interfaz traducida', us: 'Bilingüe desde el primer día, español e inglés' },
  { label: 'Entrenamientos', them: 'Un armador de rutinas, sin nadie detrás.', us: 'Demos filmadas, con el equipo que tienes' },
  { label: 'Coaching', them: 'Ninguno', us: 'El método de Stephanie, más coaches de verdad' },
  { label: 'Comunidad', them: 'Un muro de publicaciones', us: 'Retos y una coach que sí aparece' },
  { label: 'Tu progreso', them: 'Una gráfica de peso', us: 'Toda tu transformación, semana por semana' },
  { label: 'Cancelar', them: 'Donde pagaste: Apple, Google o la web', us: 'Un toque. Sin llamadas.' },
];

const FAQ: readonly { question: string; answer: string }[] = [
  {
    question: '¿Thick & Fit es buena alternativa a MyFitnessPal para comida latina?',
    answer:
      'Sí. MyFitnessPal se apoya en una base de datos que llenaron sus propios usuarios, casi toda en ' +
      'Estados Unidos y en inglés, así que registrar arroz con pollo, tamales, arepas o pupusas ' +
      'termina en que no existe, en que hay diez versiones distintas, o en una versión americanizada ' +
      'que no es lo que comiste. Thick & Fit saca los macros de fuentes validadas (USDA FoodData ' +
      'Central y Open Food Facts) y está hecha para leer la comida de casa, en español.',
  },
  {
    question: '¿Convierte el peso cocido a crudo?',
    answer:
      'Sí, en las tres que más te descuadran los números: carnes, arroz y frijoles. Cuando registras ' +
      'la foto de tu plato, Thick & Fit toma la porción cocida que se ve y la regresa a gramos en ' +
      'crudo, así no pesas nada dos veces ni haces la cuenta de cabeza. Esa lista va creciendo a ' +
      'medida que Stephanie agrega más de sus comidas.',
  },
  {
    question: '¿MyFitnessPal de verdad está en español?',
    answer:
      'La interfaz sí está en español, pero la interfaz nunca fue el problema: los datos de comida que ' +
      'hay detrás se armaron alrededor de la comida estadounidense. Thick & Fit es bilingüe desde el ' +
      'diseño, así que tanto la app como la forma en que entiende tu comida funcionan en español y en ' +
      'inglés.',
  },
  {
    question: '¿En qué se diferencia de un contador de calorías?',
    answer:
      'MyFitnessPal registra. Te deja anotar tu comida y armar una rutina, pero del otro lado no hay ' +
      'nadie. Thick & Fit es un sistema de coaching: nutrición, entrenamientos con las demos filmadas ' +
      'de Stephanie según el equipo que tengas, su método guiándote, una comunidad con retos, y una ' +
      'línea de tiempo donde te ves cambiar. Contar es una parte, no es todo.',
  },
  {
    question: '¿Puedo cancelar fácil?',
    answer:
      'Sí. Cancelas con un toque desde la app, sin llamadas y sin pasos escondidos. El precio se ve ' +
      'antes de que pagues y no hay contrato.',
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
    { href: '/es/vs/cal-ai', label: 'Thick & Fit vs Cal AI' },
    { href: '/es/vs/fitia', label: 'Thick & Fit vs Fitia' },
    { href: '/vs/myfitnesspal', label: 'This page in English' },
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

export default function EsVsMyFitnessPalPage(): ReactElement {
  const nodes = [
    faqPageNode([...FAQ]),
    breadcrumbNode([
      { name: 'Inicio', path: '/es' },
      { name: 'Thick & Fit vs MyFitnessPal', path: '/es/vs/myfitnesspal' },
    ]),
  ].filter((n): n is JsonLdNode => n !== null);

  return (
    <MarketingShell>
      <JsonLd data={graph(nodes)} />

      {/* Hero */}
      <section className="border-b border-white/10 bg-[#0e0e0e] px-5 pb-16 pt-20 sm:px-8 lg:pb-24 lg:pt-28">
        <div className="mx-auto w-full max-w-[1000px] text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-white/45">
            Thick &amp; Fit vs MyFitnessPal
          </p>
          <h1 className="mx-auto mt-4 max-w-[16ch] text-[40px] font-extrabold uppercase leading-[0.98] tracking-[-0.01em] text-white sm:text-[56px] lg:text-[64px]">
            Una cuenta calorías. La otra te entrena.
          </h1>
          <p className="mx-auto mt-6 max-w-[54ch] text-[17px] leading-[1.5] text-white/75 sm:text-[19px]">
            MyFitnessPal es un diario armado con las suposiciones de gente que no conoces. Thick &amp;
            Fit entiende tu comida, te regresa carnes, arroz y frijoles de cocido a crudo, habla tus
            dos idiomas y te pone una coach en la esquina.
          </p>
          <div className="mt-8">
            <Link
              href="/es/join"
              className="inline-block rounded-full bg-[#ff2d55] px-9 py-4 text-[15px] font-bold uppercase tracking-[0.02em] text-white transition-opacity hover:opacity-90"
            >
              Empieza hoy
            </Link>
            <p className="mt-3 text-[13px] text-white/50">Cancela cuando quieras, sin contrato.</p>
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
                  MyFitnessPal
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

      {/* Tu comida, por fin */}
      <LSection tone="bone">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <LEyebrow className="text-[#0e0e0e]">Tu comida, por fin</LEyebrow>
            <LH2 className="mt-1 text-[#0e0e0e]">Conoce la comida de tu abuela</LH2>
            <LBody className="mt-5 text-[#4a4a4a]">
              La base de datos de MyFitnessPal la llenaron desconocidos, casi toda en inglés, así que
              tus platos regresan mal o no regresan. Thick &amp; Fit saca los macros de datos
              validados y lee la comida de casa como de verdad la comes, y después te regresa carnes,
              arroz y frijoles de cocido a crudo para que los números sean honestos sin que peses nada
              dos veces.
            </LBody>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/shoot/bronco-pink.avif"
            alt="Stephanie Pantoja"
            className="aspect-[4/3] w-full rounded-xl object-cover object-[center_20%]"
          />
        </div>
      </LSection>

      {/* No es una app, es un equipo */}
      <LSection tone="dark">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/shoot/rack-pose.avif"
            alt="Stephanie Pantoja"
            className="aspect-[4/3] w-full rounded-xl object-cover object-[center_25%] lg:order-2"
          />
          <div className="lg:order-1">
            <LEyebrow className="text-white">No es un contador</LEyebrow>
            <LH2 className="mt-1 text-white">Un equipo, no una app</LH2>
            <LBody className="mt-5 text-[#bcbcbc]">
              Una cifra de calorías nunca sostuvo a nadie. Thick &amp; Fit te da entrenamientos con
              las demos filmadas de Stephanie según el equipo que tengas, su método contigo todos los
              días, una comunidad que nota cuando desapareces, y una línea de tiempo donde te ves
              cambiar semana por semana. Ya no estás haciendo esto sola.
            </LBody>
            <Link
              href="/es/join"
              className="mt-8 inline-block rounded-full bg-[#ff2d55] px-9 py-4 text-[15px] font-bold uppercase tracking-[0.02em] text-white transition-opacity hover:opacity-90"
            >
              Empieza hoy
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
            Deja de registrar.
            <br />
            <span className="text-[#ff2d55]">Empieza a cambiar.</span>
          </LH2>
          <div className="mt-8">
            <Link
              href="/es/join"
              className="inline-block rounded-full bg-[#ff2d55] px-9 py-4 text-[15px] font-bold uppercase tracking-[0.02em] text-white transition-opacity hover:opacity-90"
            >
              Empieza hoy
            </Link>
            <p className="mt-3 text-[13px] text-white/50">
              $19.97 al mes de precio fundador, $24.97 después de la ventana fundadora. Cancela cuando
              quieras, sin contrato.
            </p>
          </div>
        </div>
      </LSection>
    </MarketingShell>
  );
}
