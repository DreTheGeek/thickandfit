import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About | Thick & Fit',
  description:
    'Thick & Fit is the bilingual fitness coaching app built for women who are done settling for platforms that were never made for them.',
};

export default function AboutPage() {
  return (
    <main className="bg-white text-black">

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 py-24 sm:py-32">
        <p className="mb-4 text-xs font-bold uppercase tracking-widest text-neutral-400">
          Thick & Fit by Steph&apos;s Blessed
        </p>
        <h1 className="text-6xl font-black uppercase leading-[0.9] tracking-tighter sm:text-8xl">
          Built for
          <br />
          <span className="text-[#5EBE62]">women</span>
          <br />
          who are done
          <br />
          settling.
        </h1>
        <p className="mt-10 max-w-2xl text-xl leading-relaxed text-neutral-700">
          Thick & Fit is the bilingual fitness coaching platform Stephanie Pantoja built for
          her audience because nothing else was actually built for them. Not for women who move
          between English and Spanish. Not for women who want real math behind their macros.
          Not for women who deserve better than a workout app that dims their screen mid-set.
        </p>
      </section>

      {/* The origin */}
      <section className="border-t border-neutral-100 bg-black py-24">
        <div className="mx-auto max-w-4xl px-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#5EBE62]">
            The origin
          </p>
          <h2 className="mb-8 text-4xl font-black uppercase tracking-tight text-white sm:text-5xl">
            She built six figures on a platform she didn&apos;t own.
          </h2>
          <div className="grid gap-8 sm:grid-cols-2">
            <p className="text-lg leading-relaxed text-neutral-300">
              Stephanie Pantoja is a certified personal trainer with 562,000 Instagram followers
              and 256 paying clients. She ran her coaching business on Lenus, a white-label
              platform that was never designed for her. The biggest complaint from every single
              client: logging food required screenshotting a label into ChatGPT because the app
              could not handle photo-to-macro, did not know cooked vs uncooked weight, and barely
              knew what arroz con pollo was.
            </p>
            <p className="text-lg leading-relaxed text-neutral-300">
              She also did not own her client list. Did not own the brand. Did not own the
              roadmap. Lenus would never build what her audience needed, and the fee structure
              meant she was growing someone else&apos;s asset. So she stopped renting and started
              building. This is the result.
            </p>
          </div>
        </div>
      </section>

      {/* What makes it different */}
      <section className="border-t border-neutral-100 py-24">
        <div className="mx-auto max-w-4xl px-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-neutral-400">
            The product
          </p>
          <h2 className="mb-16 text-4xl font-black uppercase tracking-tight sm:text-5xl">
            Every competitor gets seven things wrong.
            <br />
            <span className="text-[#5EBE62]">We fix all seven.</span>
          </h2>
          <div className="grid gap-0 divide-y divide-neutral-100">
            {[
              {
                problem: 'Nutrition is a nightmare.',
                fix: 'Snap a photo of your plate. The AI returns every food item with calories, protein, carbs, and fat. Adjust if needed. Log. Done. Free barcode scanner. Cooked vs uncooked auto-conversion. US food database plus a full LATAM database with the ingredients your family actually cooks with.',
              },
              {
                problem: 'Your screen dims mid-set.',
                fix: 'Wake Lock keeps your screen on for the entire workout. No tapping. No interruption. The timer is Web Audio, not a video file, so it works even on bad gym Wi-Fi. Reliable HLS video via Mux. If you do not have a barbell, the app offers a coach-curated substitution, not a generic swap.',
              },
              {
                problem: 'The app never tells you what to do next.',
                fix: 'After every session you rate difficulty. The progressive overload engine reads your last four sessions and recommends your exact next weight and rep target. This is standard sports science (double-progression), not AI invention. The math is transparent and auditable.',
              },
              {
                problem: 'Fake bilingual.',
                fix: 'The interface language and the content language are independent settings. You can read the app in English and search food in Spanish. You can follow a program written in Spanish while your labels are in English. The toggle is not a translation layer over English content. It is a genuinely bilingual database.',
              },
              {
                problem: 'Communities that die.',
                fix: 'Challenges with live leaderboards. Coach broadcasts segmented by language, tier, and tag. Groups that mirror the ones clients already know (Team Thick & Fit, HER again, Body Recomp). Every surface is designed to bring people back daily, not just when they remember to open the app.',
              },
              {
                problem: 'Billing you cannot trust.',
                fix: 'Your next charge date is always visible. You get a 48-hour warning before renewal. Cancel in one tap with no confirmation maze. Prorated refunds are real, not policy theater. Honest billing is a product feature here, not an afterthought. The FTC has fined competitors $62 million for this. We read the case.',
              },
              {
                problem: 'The creator is a renter.',
                fix: "Stephanie owns the brand, the client data, the pricing, and the roadmap. She is not on a white-label platform that decides her feature set. When a client pays Thick & Fit, the relationship is with Stephanie, not an intermediary platform that can reprice, reterm, or disappear.",
              },
            ].map(({ problem, fix }) => (
              <div key={problem} className="grid gap-4 py-10 sm:grid-cols-2">
                <p className="text-lg font-bold uppercase tracking-tight">{problem}</p>
                <p className="text-base leading-relaxed text-neutral-600">{fix}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The platform */}
      <section className="border-t border-neutral-100 bg-neutral-950 py-24">
        <div className="mx-auto max-w-4xl px-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#5EBE62]">
            Platform
          </p>
          <h2 className="mb-4 text-4xl font-black uppercase tracking-tight text-white sm:text-5xl">
            Everything you need. Nothing you don&apos;t.
          </h2>
          <p className="mb-16 max-w-2xl text-lg text-neutral-400">
            Six modules. One app. Built for the full coaching relationship from day one to month twelve.
          </p>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'Nutrition',
                description:
                  'AI photo-to-macro, free barcode scanner, cooked/uncooked conversion, USDA and LATAM food databases, daily diary, macro targets, meal plans, recipes. The most accurate low-friction tracking in the category.',
              },
              {
                title: 'Workouts',
                description:
                  'Exercise library with Stephanie\'s filmed demos, structured multi-week programs, audible timer, Wake Lock, equipment substitutions, auto progressive overload, follow-along mode.',
              },
              {
                title: 'Community',
                description:
                  'Feed, groups, challenges with live leaderboards, coach broadcasts in English and Spanish, direct messages. Built to create daily return, not passive scrolling.',
              },
              {
                title: 'Progress',
                description:
                  'Side-by-side progress photos (front, back, side), body measurements, weight charts across four date ranges, weekly check-in forms, habits, water, streaks.',
              },
              {
                title: 'AI Coach',
                description:
                  'Responds in Stephanie\'s voice and communication style. Text in Phase 1, ElevenLabs voice clone in Phase 2, Higgsfield video clone post-launch. Trained on a hand-authored knowledge base, not a generic fitness prompt.',
              },
              {
                title: 'Coach Toolbox',
                description:
                  '7-tab client profiles, engagement and financial analytics, multi-form builder, branding settings, assistant inbox, PT workflow, in-app ratings inbox. The IA Lenus got right, the execution Lenus never delivered.',
              },
            ].map(({ title, description }) => (
              <div key={title} className="border border-neutral-800 p-6">
                <p className="mb-3 text-sm font-bold uppercase tracking-widest text-[#5EBE62]">
                  {title}
                </p>
                <p className="text-sm leading-relaxed text-neutral-400">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The audience */}
      <section className="border-t border-neutral-100 py-24">
        <div className="mx-auto max-w-4xl px-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-neutral-400">
            Who it&apos;s for
          </p>
          <h2 className="mb-8 text-4xl font-black uppercase tracking-tight sm:text-5xl">
            Built for a specific woman.
            <br />
            <span className="text-[#5EBE62]">Not for everyone.</span>
          </h2>
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <p className="mb-4 text-lg leading-relaxed text-neutral-700">
                The core audience is bilingual women in the US and Latin America who follow
                Stephanie Pantoja. They are 18-40, fitness-motivated but not obsessive, and they
                want results without a second app to manage their macros and a third app to
                follow along with workouts.
              </p>
              <p className="text-lg leading-relaxed text-neutral-700">
                Many of them switch between Spanish and English depending on context. Every
                other fitness app makes them choose one. This one does not.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { stat: '562K', label: 'Instagram followers' },
                { stat: '256', label: 'Paying clients migrating from Lenus' },
                { stat: '$16,798', label: 'Current monthly recurring revenue' },
                { stat: '2', label: 'Languages. Full database depth in both.' },
              ].map(({ stat, label }) => (
                <div key={label} className="border border-neutral-200 p-4">
                  <p className="text-3xl font-black">{stat}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-neutral-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="border-t border-neutral-100 bg-black py-24">
        <div className="mx-auto max-w-4xl px-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#5EBE62]">
            Pricing
          </p>
          <h2 className="mb-4 text-4xl font-black uppercase tracking-tight text-white sm:text-5xl">
            Three ways in.
          </h2>
          <p className="mb-16 max-w-xl text-lg text-neutral-400">
            Free trial, low-ticket subscription, and high-ticket 1:1 coaching. Each tier is a
            complete product, not a crippled version asking you to upgrade.
          </p>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                tier: 'Free',
                price: '7-day trial',
                features: [
                  'Workout library browse',
                  'Basic nutrition calculator',
                  'Community read access',
                  'Bilingual',
                ],
              },
              {
                tier: 'Self-Guided',
                price: '$19.99/mo',
                features: [
                  'Full workout programs + player',
                  'Progressive overload engine',
                  'Full nutrition tracking + barcode',
                  'AI photo-to-macro (5/day)',
                  'Community full access',
                  'Progress tracking',
                  'AI coach (text)',
                  'Bilingual',
                ],
              },
              {
                tier: 'Coached',
                price: '$275/mo',
                features: [
                  'Everything in Self-Guided',
                  'PT assistant inbox',
                  'Stephanie last-eyes on your plan',
                  'Unlimited AI photo-to-macro',
                  'Custom meal plans',
                  'Weekly check-in review',
                  'Priority AI coach',
                  'Bilingual',
                ],
              },
            ].map(({ tier, price, features }) => (
              <div key={tier} className="border border-neutral-800 p-6">
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[#5EBE62]">
                  {tier}
                </p>
                <p className="mb-6 text-2xl font-black text-white">{price}</p>
                <ul className="space-y-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-neutral-400">
                      <span className="mt-0.5 text-[#5EBE62]">+</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-neutral-600">
            256 clients migrating from Lenus keep their original pricing ($129-$369/mo) and are
            never subject to rev-share calculations. Grandfathered rates are permanent.
          </p>
        </div>
      </section>

      {/* The build */}
      <section className="border-t border-neutral-100 py-24">
        <div className="mx-auto max-w-4xl px-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-neutral-400">
            The build
          </p>
          <h2 className="mb-8 text-4xl font-black uppercase tracking-tight sm:text-5xl">
            Three partners.
            <br />
            <span className="text-[#5EBE62]">One product.</span>
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <p className="mb-2 font-bold uppercase tracking-tight">Thick & Fit by Steph&apos;s Blessed</p>
              <p className="text-sm leading-relaxed text-neutral-600">
                Stephanie Pantoja owns the brand, the content, the audience, and the product
                vision. She is the coach, the creator, and the first user. Every decision routes
                through what her clients actually need.
              </p>
            </div>
            <div>
              <p className="mb-2 font-bold uppercase tracking-tight">LevelUp Automations</p>
              <p className="text-sm leading-relaxed text-neutral-600">
                Rodney Williams and Shakira Canty own the client relationship and scope. Rodney
                manages the business and migration. Shakira authors the AI Knowledge Base that
                trains the AI coach in Stephanie&apos;s voice.
              </p>
            </div>
            <div>
              <p className="mb-2 font-bold uppercase tracking-tight">Kaldr Tech</p>
              <p className="text-sm leading-relaxed text-neutral-600">
                LaSean Pickens leads engineering. Next.js 16, Supabase, OpenRouter, Stripe
                Connect, Mux, Vercel. Multi-tenant from day one. Security-first. Built to
                white-label, not just to ship.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-neutral-100 bg-[#5EBE62] py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="mb-4 text-5xl font-black uppercase leading-[0.9] tracking-tighter text-black sm:text-7xl">
            Launching
            <br />
            September 2026.
          </h2>
          <p className="mb-10 text-xl font-medium text-black/70">
            Get early access and the lead magnet before the public launch.
          </p>
          <a
            href="/join"
            className="inline-block bg-black px-10 py-4 text-sm font-bold uppercase tracking-widest text-white"
          >
            Join the waitlist
          </a>
        </div>
      </section>

    </main>
  );
}
