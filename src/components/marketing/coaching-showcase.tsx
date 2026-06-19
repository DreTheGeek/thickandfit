import type { ReactElement } from 'react';
import { Icon, type IconName } from '@/components/ui/icons';

/**
 * Native desktop rebuild of the Webflow "coaching showcase" section (Empowering intro +
 * 4 feature blocks + the closing CTA). Rendered ONLY at >=lg; the exact Webflow version
 * still shows on phone/tablet, so the mobile experience is untouched. Content + images are
 * lifted verbatim from the original section.
 */

type Feature = {
  eyebrow: string;
  icon: IconName;
  line1: string;
  line2: string;
  body: string;
  imgs: [string, string];
};

const FEATURES: Feature[] = [
  {
    eyebrow: 'Workout Plans',
    icon: 'bolt',
    line1: 'Get tailored workouts',
    line2: 'designed for your goal',
    body: "No matter where you train; gym or at home, I design workouts around the equipment you have. My job is to make your goals possible with what's available to you.",
    imgs: ['/assets/images/bec132276dbc.avif', '/assets/images/12847e8f578b.avif'],
  },
  {
    eyebrow: 'Support Channel',
    icon: 'megaphone',
    line1: 'Your support system',
    line2: 'in one place.',
    body: "You'll have consistent communication with me and my coaching team directly through the app. We communicate with instant message, voice notes and video messages, so you're supported every step of the way. Inside the private community, you'll connect with women working toward the same goals you are.",
    imgs: ['/assets/images/bec132276dbc.avif', '/assets/images/58b0bf9e4c9e.avif'],
  },
  {
    eyebrow: 'Meal Plans',
    icon: 'nutrition',
    line1: 'Meals you will',
    line2: 'actually enjoy',
    body: 'Meals tailored to your macros without ever losing the flavor. No bland food, just meals that taste good and support your results.',
    imgs: ['/assets/images/12847e8f578b.avif', '/assets/images/ee8356541645.avif'],
  },
  {
    eyebrow: 'Progress Tracker',
    icon: 'steps',
    line1: 'Daily habits that',
    line2: 'keep you on track.',
    body: 'Inside the app, you can set and track daily habits that align with your goals. Water, steps, workouts, meals, everything you need to stay consistent is in one place.',
    imgs: ['/assets/images/58b0bf9e4c9e.avif', '/assets/images/ee8356541645.avif'],
  },
];

function Phones({ imgs }: { imgs: [string, string] }): ReactElement {
  return (
    <div className="relative mx-auto h-[460px] w-full max-w-[460px]">
      {/* back phone */}
      {/* eslint-disable-next-line @next/next/no-img-element -- lifted marketing screenshot */}
      <img
        src={imgs[1]}
        alt=""
        className="absolute right-0 top-8 w-[230px] rounded-[26px] shadow-[0_24px_60px_rgba(0,0,0,0.22)]"
      />
      {/* front phone */}
      {/* eslint-disable-next-line @next/next/no-img-element -- lifted marketing screenshot */}
      <img
        src={imgs[0]}
        alt=""
        className="absolute left-2 top-0 w-[250px] rounded-[26px] shadow-[0_24px_60px_rgba(0,0,0,0.25)]"
      />
    </div>
  );
}

export function CoachingShowcase(): ReactElement {
  return (
    <section className="bg-white px-10 py-24 text-ink">
      <div className="mx-auto max-w-[1180px]">
        {/* Intro */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-[13px] font-semibold uppercase tracking-[3px] text-soft">
            Thick &amp; Fit Coaching
          </div>
          <h2 className="tf-display mt-5 text-[clamp(44px,5vw,76px)] leading-[0.92]">
            Empowering women through fitness,
            <br />
            <span className="text-faint">one rep at a time.</span>
          </h2>
        </div>

        {/* Feature rows (alternating) */}
        <div className="mt-20 flex flex-col gap-28">
          {FEATURES.map((f, i) => {
            const reverse = i % 2 === 1;
            return (
              <div key={f.eyebrow} className="grid grid-cols-2 items-center gap-16">
                <div className={reverse ? 'order-2' : ''}>
                  <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-white">
                      <Icon name={f.icon} size={18} />
                    </span>
                    <span className="text-[12px] font-semibold uppercase tracking-[2px] text-soft">
                      {f.eyebrow}
                    </span>
                  </div>
                  <h3 className="tf-display text-[clamp(34px,3.4vw,52px)] leading-[0.95]">
                    {f.line1}
                    <br />
                    <span className="text-faint">{f.line2}</span>
                  </h3>
                  <p className="mt-6 max-w-[460px] text-[16px] leading-[1.7] text-soft">
                    {f.body}
                  </p>
                </div>
                <div className={reverse ? 'order-1' : ''}>
                  <Phones imgs={f.imgs} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Closing CTA */}
        <div className="mt-28 text-center">
          <h2 className="tf-display text-[clamp(48px,6vw,92px)] leading-[0.9]">
            If you&apos;re ready to lock in,
            <br />
            <span className="text-faint">let&apos;s work.</span>
          </h2>
          <div className="mt-10 flex flex-wrap justify-center gap-3.5">
            {['Move with purpose', 'Fuel your body', 'Sustainable results'].map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-3 rounded-full border border-line bg-white px-6 py-3.5 text-[14px] font-semibold uppercase tracking-[1px] shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-white">
                  <Icon name="check" size={14} strokeWidth={2.6} />
                </span>
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
