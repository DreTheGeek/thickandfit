import type { ReactNode } from 'react';

// Split-screen auth layout. Left = a dark "gym wall" with slowly drifting
// inspirational quotes (pure CSS, no image assets). Right = the form column.
type Floater = {
  text: string;
  pos: string;
  size: string;
  tone: string;
  dur: string;
  delay: string;
};

const FLOATERS: Floater[] = [
  { text: 'BUILT, NOT BORN', pos: 'left-[33%] top-[9%]', size: 'text-2xl', tone: 'text-white/20', dur: '10s', delay: '0.4s' },
  { text: 'STRONGER EVERY DAY', pos: 'left-[53%] top-[18%]', size: 'text-3xl', tone: 'text-white/25', dur: '12s', delay: '0s' },
  { text: 'DISCIPLINE > MOTIVATION', pos: 'left-[57%] top-[37%]', size: 'text-xl', tone: 'text-white/15', dur: '13s', delay: '1.1s' },
  { text: 'MÁS FUERTE CADA DÍA', pos: 'left-[60%] top-[55%]', size: 'text-2xl', tone: 'text-olive/35', dur: '14s', delay: '0.6s' },
  { text: 'PROGRESS OVER PERFECTION', pos: 'left-[45%] top-[73%]', size: 'text-xl', tone: 'text-white/15', dur: '11s', delay: '1.7s' },
  { text: 'SHOW UP FOR HER', pos: 'left-[63%] top-[87%]', size: 'text-lg', tone: 'text-white/15', dur: '12.5s', delay: '0.9s' },
];

export function AuthShell({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <div className="flex min-h-screen bg-white text-ink">
      {/* Left: the wall */}
      <aside className="tf-wall tf-grain relative hidden w-1/2 overflow-hidden lg:block">
        <div className="absolute inset-0 z-[1]">
          {FLOATERS.map((q) => (
            <span
              key={q.text}
              style={{ animationDuration: q.dur, animationDelay: q.delay }}
              className={`tf-float absolute ${q.pos} ${q.size} ${q.tone} whitespace-nowrap font-display uppercase leading-none tracking-tight`}
            >
              {q.text}
            </span>
          ))}
        </div>

        {/* vignette */}
        <div className="pointer-events-none absolute inset-0 z-[1] shadow-[inset_0_0_170px_55px_rgba(0,0,0,0.92)]" />

        {/* structured content */}
        <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
          <span className="tf-fade-up text-sm font-black uppercase tracking-[0.28em] text-white">
            Thick &amp; Fit
          </span>

          <div className="tf-fade-up" style={{ animationDelay: '0.1s' }}>
            <div className="mb-5 h-1 w-14 bg-olive" />
            <h2 className="font-display text-6xl uppercase leading-[0.85] text-white xl:text-7xl">
              Earn your
              <br />
              <span className="text-olive">curves</span>
            </h2>
            <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-4 py-2 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-olive opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-olive" />
              </span>
              <span className="text-xs font-medium text-white/85">
                256 women coached · part of a 562K community
              </span>
            </div>
          </div>

          <p
            className="tf-fade-up text-[0.7rem] uppercase tracking-[0.22em] text-white/40"
            style={{ animationDelay: '0.2s' }}
          >
            Stripe-secured · Bilingual coaching · Cancel anytime
          </p>
        </div>
      </aside>

      {/* Right: the form */}
      <main className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2">
        <div className="tf-fade-up mx-auto w-full max-w-sm">
          <span className="mb-10 block text-sm font-black uppercase tracking-[0.28em] text-ink lg:hidden">
            Thick &amp; Fit
          </span>
          <div className="mb-3 h-1 w-12 bg-olive" />
          <h1 className="font-display text-5xl uppercase leading-none text-ink">{title}</h1>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
