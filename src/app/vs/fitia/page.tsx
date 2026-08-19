// Comparison page: Thick & Fit vs Fitia. Third of the /vs set (order per
// .planning/MARKETING-AUDIENCE.md). The DEFENSIVE page that protects against the real incumbent.
//
// ANGLE (from the research): Fitia is a genuinely strong nutrition TOOL with deep Latin-food data.
// We do NOT attack its nutrition (that is its strength, and pretending otherwise reads as false).
// We win on what a tool cannot be: a real person. Fitia is a faceless, self-serve app with an
// automated coach; Thick & Fit is Stephanie, her method, her human team, workouts, and a community
// with her in it. "Fitia counts your food. Stephanie coaches you."
//
// CLAIM DISCIPLINE:
//   - Concede Fitia's nutrition-database strength honestly; do not claim we beat it there.
//   - Fitia genuinely has meal planning, a community and an automated coach, so we do NOT say it has
//     "none" of those. We contrast KIND: a faceless app vs a real person; a nutrition-only tool vs a
//     full training + coaching system.
//   - Every T&F line is verified against the code. BRAND RULE: our coach is Stephanie / her method,
//     never "AI"; and we frame Fitia's coach as "an app", not by attacking it.
//
// CLAIM CORRECTIONS, 2026-08-04, verified against fitia.app before writing:
//   - The community row said "a feed of strangers". Fitia's own features page names Fitia Teams:
//     "Join teams and challenges, chat with others, and stay motivated with a nutrition community."
//     So the row now says what they actually ship. Our edge was never that they have nothing there,
//     it is that Stephanie is IN ours, and that still wins stated honestly.
//   - Added a trial row from their own help centre ("Fitia Premium tiene prueba gratis"): 3 days,
//     available only on the annual plan, and the annual subscription activates when it ends. That is
//     checkable and it is a real difference, unlike a characterization.
//   - Cooked-to-raw is scoped to what ships: meats, rice and beans.
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

const TITLE = 'Fitia alternative with a real coach | Thick & Fit';
const DESCRIPTION =
  'Fitia is a strong food tracker, but it is still an app. Thick & Fit is Stephanie coaching you: ' +
  'her method, her team, workouts, and a community with her in it, in English and Spanish.';

export function generateMetadata(): Metadata {
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: {
      canonical: '/vs/fitia',
      languages: { en: '/vs/fitia', es: '/es/vs/fitia', 'x-default': '/vs/fitia' },
    },
    openGraph: {
      url: '/vs/fitia',
      title: TITLE,
      description: DESCRIPTION,
      images: ['/assets/images/open-graph.jpg'],
    },
  };
}

type Row = { label: string; them: string; us: string };
const ROWS: readonly Row[] = [
  { label: 'What it is', them: 'A nutrition tracker and meal planner', us: 'A full coaching system' },
  { label: 'Who coaches you', them: 'An app', us: 'Stephanie, a real person, and her team' },
  { label: 'Training', them: 'Built for food', us: 'Workouts with filmed demos, your equipment' },
  { label: 'Accountability', them: 'Other users', us: 'Her team checks in every week' },
  { label: 'The community', them: 'Teams, challenges and chat', us: 'These women, with Stephanie in it' },
  { label: 'The method', them: 'A plan the app generates', us: "Stephanie's own, in her voice" },
  { label: 'Nutrition', them: 'A strong food database', us: 'Grounded data, plus cooked back to raw on meats, rice and beans' },
  { label: 'Signing up', them: '3 days, annual plan only, then the year starts', us: 'Monthly, price shown first, cancel in one tap' },
];

const FAQ: readonly { question: string; answer: string }[] = [
  {
    question: 'Is Thick & Fit a good alternative to Fitia?',
    answer:
      'It depends on what you want. Fitia is a strong, self-serve food tracker and meal planner. If ' +
      'you only want to log calories on your own, it does that well. If you want someone in your ' +
      'corner, a real coach, her method, workouts and a community, that is a different thing, and ' +
      'that is Thick & Fit.',
  },
  {
    question: 'What does Thick & Fit have that a tracker does not?',
    answer:
      'A person. Thick & Fit is Stephanie coaching you: her training built around the equipment you ' +
      'have, her team checking in every week, her actual method rather than a plan an app generated. ' +
      'Fitia has teams and challenges. What it does not have is her in the room with you. An app can ' +
      'count your food. It cannot notice when you go quiet.',
  },
  {
    question: 'Does Thick & Fit track Latin food and cooked vs raw too?',
    answer:
      'Yes. It reads Latin home cooking in Spanish and grounds the macros in validated data. Cooked ' +
      'portions get converted back to raw on meats, rice and beans, the three that throw the numbers ' +
      'off the most, and that list grows as Stephanie adds more of her foods. The tracking is solid. ' +
      'The difference is that it sits inside real coaching, not on its own.',
  },
  {
    question: 'Is it in Spanish?',
    answer:
      'Yes. Thick & Fit is bilingual by design, in English and Spanish, on both the member and the ' +
      'coaching side, and Stephanie coaches in both.',
  },
  {
    question: 'Can I cancel easily?',
    answer:
      'Yes. The price is shown before you pay, there is no contract, and you can cancel in one tap ' +
      'from inside the app, with no hidden steps. You keep access through the end of the period you ' +
      'already paid for.',
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
    { href: '/vs/myfitnesspal', label: 'Thick & Fit vs MyFitnessPal' },
    { href: '/vs/cal-ai', label: 'Thick & Fit vs Cal AI' },
    { href: '/es/vs/fitia', label: 'Esta página en español' },
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

export default function VsFitiaPage(): ReactElement {
  // The CTA goes to /join, the waitlist, and there is no trial configured unless STRIPE_TRIAL_DAYS
  // is set — so "Start 3 days free" was advertising an offer the product would not have honoured.
  // Reads the same value the checkout call sends, so the sentence and the offer turn on together.
  const trial = configuredTrialDays();
  const ctaLabel = trial > 0 ? `Start ${trial} days free` : 'Join the waitlist';
  const nodes = [
    faqPageNode([...FAQ]),
    breadcrumbNode([
      { name: 'Home', path: '/' },
      { name: 'Thick & Fit vs Fitia', path: '/vs/fitia' },
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
            Fitia counts. Stephanie coaches.
          </h1>
          <p className="mx-auto mt-6 max-w-[54ch] text-[17px] leading-[1.5] text-white/75 sm:text-[19px]">
            Fitia is a good tracker. But you have tracked before. What you have not had is a coach who
            knows your name, your plan, and your food, and stays in it with you.
          </p>
          <div className="mt-8">
            <Link
              href="/join"
              className="inline-block rounded-full bg-[#ff2d55] px-9 py-4 text-[15px] font-bold uppercase tracking-[0.02em] text-white transition-opacity hover:opacity-90"
            >
              {ctaLabel}
            </Link>
            <p className="mt-3 text-[13px] text-white/50">Cancel any time, one tap.</p>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <LSection tone="dark">
        <LH2 className="text-center text-white">Side by side</LH2>
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

      {/* A tool vs a person */}
      <LSection tone="bone">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <LEyebrow className="text-[#0e0e0e]">A tool, or a person</LEyebrow>
            <LH2 className="mt-1 text-[#0e0e0e]">You have tracked before</LH2>
            <LBody className="mt-5 text-[#4a4a4a]">
              And you know a tracker does not carry you through the weeks you want to quit. Fitia is a
              good app. Thick &amp; Fit is a coach. Stephanie&apos;s method, her team every week, and a
              room full of women doing this next to you. That is the part the app was never going to be.
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

      {/* Food + training together */}
      <LSection tone="dark">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/shoot/legpress.avif"
            alt="Stephanie Pantoja"
            className="aspect-[4/5] w-full rounded-xl object-cover object-[center_30%] lg:order-2"
          />
          <div className="lg:order-1">
            <LEyebrow className="text-white">The whole thing</LEyebrow>
            <LH2 className="mt-1 text-white">Not just what you eat</LH2>
            <LBody className="mt-5 text-[#bcbcbc]">
              A nutrition app stops at the plate. Thick &amp; Fit gives you the training too: workouts
              with her filmed demos, built around the equipment you have, moving with your nutrition
              instead of separate from it. One place, one plan, one coach.
            </LBody>
            <Link
              href="/join"
              className="mt-8 inline-block rounded-full bg-[#ff2d55] px-9 py-4 text-[15px] font-bold uppercase tracking-[0.02em] text-white transition-opacity hover:opacity-90"
            >
              {ctaLabel}
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
            Stop tracking alone.
            <br />
            <span className="text-[#ff2d55]">Get a coach.</span>
          </LH2>
          <div className="mt-8">
            <Link
              href="/join"
              className="inline-block rounded-full bg-[#ff2d55] px-9 py-4 text-[15px] font-bold uppercase tracking-[0.02em] text-white transition-opacity hover:opacity-90"
            >
              {ctaLabel}
            </Link>
            <p className="mt-3 text-[13px] text-white/50">
              $19.97 a month founding price, $24.97 after the founding window.
              Cancel any time, one tap.
            </p>
          </div>
        </div>
      </LSection>
    </MarketingShell>
  );
}
