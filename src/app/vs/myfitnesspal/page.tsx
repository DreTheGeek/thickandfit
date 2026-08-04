// Comparison page: Thick & Fit vs MyFitnessPal. First of the /vs set (build order per
// .planning/MARKETING-AUDIENCE.md: MyFitnessPal -> Cal AI -> Fitia -> Lenus).
//
// EVERY "Thick & Fit" claim here is verified against the codebase, not marketing:
//   - food data is GROUNDED in USDA FoodData Central + Open Food Facts, model gives name+grams, the
//     database supplies macros (src/lib/nutrition/external-foods.ts). We do NOT claim a bigger
//     database than MyFitnessPal (our local corpus is small); the honest edge is grounded-not-
//     crowd-sourced + cooked/raw conversion + it being a coaching system, not a tracker.
//   - cooked/raw conversion is real (cooked_uncooked_ratios, src/lib/nutrition/diary-actions.ts).
//   - photo / barcode / text logging are real (smart-scan, barcode-scan, text-parse).
//   - workouts, coach, community, and the Evolution timeline are shipped surfaces.
// The MyFitnessPal column is kept to well-documented, structural facts (crowd-sourced/user-submitted
// database; a tracker without coaching or programming; a translated interface over a US food
// database), not contestable specific stats.
//
// English first, matching the current homepage. The ES twin now exists at /es/vs/myfitnesspal and
// carries reciprocal hreflang (the winnable Spanish query is "alternativa a MyFitnessPal en espanol
// / para comida latina").
//
// CLAIM CORRECTIONS, 2026-08-04, each verified against MyFitnessPal's OWN pages before writing:
//   - Workouts: they DO ship a routine builder ("Workout Routines", support.myfitnesspal.com
//     /hc/en-us/articles/360036071232). The old "None" was simply false. The true and stronger line
//     is that a builder is not a coach.
//   - Canceling: "Buried in settings" was a characterization we cannot back. Their own help article
//     (360032625371) says cancellation happens where you paid: the App Store, Google Play, or the
//     web account. That is a fact, it is checkable, and it still loses to one tap.
//   - Cooked-to-raw is scoped. The ratio table covers meats, rice and beans today, so the page says
//     meats, rice and beans. Claiming every food was a promise the app does not keep.
import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/v2/shell';
import { LSection, LH2, LBody, LEyebrow } from '@/components/marketing/v2/ui';
import { Icon } from '@/components/ui/icons';
import { JsonLd } from '@/components/seo/json-ld';
import { graph, faqPageNode, breadcrumbNode, type JsonLdNode } from '@/lib/seo/schema';

export const dynamic = 'force-dynamic';

const TITLE = 'MyFitnessPal alternative for Latin food | Thick & Fit';
const DESCRIPTION =
  'MyFitnessPal counts calories from a crowd-sourced database. Thick & Fit coaches you: nutrition ' +
  'that gets Latin home cooking right, cooked back to raw on meats, rice and beans, in English and ' +
  "Spanish, with real workouts and a coach in Stephanie's corner.";

export function generateMetadata(): Metadata {
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: {
      canonical: '/vs/myfitnesspal',
      languages: {
        en: '/vs/myfitnesspal',
        es: '/es/vs/myfitnesspal',
        'x-default': '/vs/myfitnesspal',
      },
    },
    openGraph: {
      url: '/vs/myfitnesspal',
      title: TITLE,
      description: DESCRIPTION,
      images: ['/assets/images/open-graph.jpg'],
    },
  };
}

type Row = { label: string; them: string; us: string };
const ROWS: readonly Row[] = [
  { label: 'Food data', them: 'Crowd-sourced, user-submitted entries', us: 'Grounded in USDA + Open Food Facts' },
  { label: 'Latin home cooking', them: 'Generic or Americanized', us: 'Reads your dishes, in Spanish' },
  { label: 'Cooked vs raw', them: 'You do the math', us: 'Meats, rice and beans, converted for you' },
  { label: 'Log your meal', them: 'Search and type', us: 'Photo, barcode, or a quick line of text' },
  { label: 'Language', them: 'A translated interface', us: 'Bilingual by design, EN and ES' },
  { label: 'Workouts', them: 'A routine builder, no one behind it.', us: "Filmed demos, built around your equipment" },
  { label: 'Coaching', them: 'None', us: "Stephanie's method, plus real human coaches" },
  { label: 'Community', them: 'A feed', us: 'Challenges and a coach who shows up' },
  { label: 'Your progress', them: 'A weight graph', us: 'A full transformation timeline' },
  { label: 'Canceling', them: 'Wherever you paid: Apple, Google, or the web', us: 'One tap. No phone call.' },
];

const FAQ: readonly { question: string; answer: string }[] = [
  {
    question: 'Is Thick & Fit a good MyFitnessPal alternative for Latin food?',
    answer:
      'Yes. MyFitnessPal leans on a crowd-sourced database that was built mostly by US users, so ' +
      'logging arroz con pollo, tamales, arepas or pupusas often means no entry, ten conflicting ones, ' +
      'or an Americanized guess. Thick & Fit grounds every food in validated sources (USDA FoodData ' +
      'Central and Open Food Facts) and is built to read Latin home cooking in Spanish.',
  },
  {
    question: 'Does Thick & Fit handle cooked vs raw weight?',
    answer:
      'Yes, on the three that throw your numbers off the most: meats, rice and beans. When you log a ' +
      'photo of your plate, Thick & Fit takes the cooked portion it can see and converts it back to ' +
      'the raw-equivalent grams, so you are not weighing anything twice or doing the math in your ' +
      'head. That list grows as Stephanie adds more of her foods to it.',
  },
  {
    question: 'Is MyFitnessPal actually in Spanish?',
    answer:
      'MyFitnessPal has a Spanish interface, but the interface is not the problem: the food data ' +
      'behind it was built around US and English-language foods. Thick & Fit is bilingual by design, ' +
      'so both the app and the way it understands your food work in English and Spanish.',
  },
  {
    question: 'How is this different from just a calorie counter?',
    answer:
      'MyFitnessPal is a tracker. It logs your food and it will let you build a workout routine, but ' +
      'nobody is on the other end of it. Thick & Fit is a coaching system: nutrition, workouts with ' +
      "filmed demos built around the equipment you have, a coach in Stephanie's voice, a community " +
      'with challenges, and a transformation timeline that shows you changing over time. The tracking ' +
      'is one piece, not the whole thing.',
  },
  {
    question: 'Can I cancel easily?',
    answer:
      'Yes. You can cancel in one tap from inside the app, with no phone call and no hidden steps. ' +
      'The price is shown before you ever pay, and there is no contract.',
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

/**
 * Sibling links. Nothing in the nav or footer points into the /vs cluster yet, so the three pages
 * link to each other and to their Spanish twin: once the sitemap gets a crawler to any one of them,
 * the other five are reachable by following links, which is what indexing actually needs.
 */
function MoreComparisons(): ReactElement {
  const links: readonly { href: string; label: string }[] = [
    { href: '/vs/cal-ai', label: 'Thick & Fit vs Cal AI' },
    { href: '/vs/fitia', label: 'Thick & Fit vs Fitia' },
    { href: '/es/vs/myfitnesspal', label: 'Esta página en español' },
  ];
  return (
    <LSection tone="raised">
      <LEyebrow className="text-white">Keep looking</LEyebrow>
      <LH2 className="mt-1 text-white">Compare the rest</LH2>
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

export default function VsMyFitnessPalPage(): ReactElement {
  const nodes = [
    faqPageNode([...FAQ]),
    breadcrumbNode([
      { name: 'Home', path: '/' },
      { name: 'Thick & Fit vs MyFitnessPal', path: '/vs/myfitnesspal' },
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
            One counts calories. One coaches you.
          </h1>
          <p className="mx-auto mt-6 max-w-[54ch] text-[17px] leading-[1.5] text-white/75 sm:text-[19px]">
            MyFitnessPal is a food log built on a stranger&apos;s guesses. Thick &amp; Fit gets your
            food right, converts your meats, rice and beans back to raw, speaks both your languages,
            and puts a coach in your corner.
          </p>
          <div className="mt-8">
            <Link
              href="/join"
              className="inline-block rounded-full bg-[#ff2d55] px-9 py-4 text-[15px] font-bold uppercase tracking-[0.02em] text-white transition-opacity hover:opacity-90"
            >
              Start today
            </Link>
            <p className="mt-3 text-[13px] text-white/50">Cancel anytime, no contract.</p>
          </div>
        </div>
      </section>

      {/* The comparison table */}
      <LSection tone="dark">
        <LH2 className="text-center text-white">Side by side</LH2>
        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr>
                <th className="w-[26%] px-4 pb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-white/40" />
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

      {/* Your food, finally */}
      <LSection tone="bone">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <LEyebrow className="text-[#0e0e0e]">Your food, finally</LEyebrow>
            <LH2 className="mt-1 text-[#0e0e0e]">It knows abuela&apos;s cooking</LH2>
            <LBody className="mt-5 text-[#4a4a4a]">
              MyFitnessPal&apos;s database is built by strangers, mostly in English, so your dishes come
              back wrong or not at all. Thick &amp; Fit grounds every food in validated nutrition data
              and reads Latin home cooking the way you actually eat it, then converts your meats, rice
              and beans from cooked back to raw so the numbers are honest without you weighing
              anything twice.
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

      {/* Not a tracker, a coach */}
      <LSection tone="dark">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/shoot/rack-pose.avif"
            alt="Stephanie Pantoja"
            className="aspect-[4/3] w-full rounded-xl object-cover object-[center_25%] lg:order-2"
          />
          <div className="lg:order-1">
            <LEyebrow className="text-white">Not a tracker</LEyebrow>
            <LH2 className="mt-1 text-white">A whole team, not an app</LH2>
            <LBody className="mt-5 text-[#bcbcbc]">
              A calorie count never held anyone accountable. Thick &amp; Fit gives you workouts with
              Stephanie&apos;s filmed demos built around the equipment you have, her method guiding you
              every day, a community that notices when you disappear, and a timeline that shows you
              changing, week by week. You are not doing this alone anymore.
            </LBody>
            {/* Mid-page CTA. The other two /vs pages close their second section with one and this
                page was the only one asking a reader to scroll all the way back to convert. */}
            <Link
              href="/join"
              className="mt-8 inline-block rounded-full bg-[#ff2d55] px-9 py-4 text-[15px] font-bold uppercase tracking-[0.02em] text-white transition-opacity hover:opacity-90"
            >
              Start today
            </Link>
          </div>
        </div>
      </LSection>

      <MoreComparisons />


      {/* FAQ */}
      <LSection tone="dark" id="faq">
        <LH2 className="text-white">Questions</LH2>
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

      {/* Close */}
      <LSection tone="raised">
        <div className="text-center">
          <LH2 className="text-white">
            Stop logging.
            <br />
            <span className="text-[#ff2d55]">Start changing.</span>
          </LH2>
          <div className="mt-8">
            <Link
              href="/join"
              className="inline-block rounded-full bg-[#ff2d55] px-9 py-4 text-[15px] font-bold uppercase tracking-[0.02em] text-white transition-opacity hover:opacity-90"
            >
              Start today
            </Link>
            <p className="mt-3 text-[13px] text-white/50">
              $19.97 a month founding price, $24.97 after the founding window. Cancel anytime, no
              contract.
            </p>
          </div>
        </div>
      </LSection>
    </MarketingShell>
  );
}
