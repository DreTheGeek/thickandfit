'use client';

import { useEffect, useState, type ReactElement } from 'react';

type Readout = Record<string, string>;

/**
 * Reads the numbers that decide whether a 100dvh shell reaches the physical bottom of an iPhone.
 *
 * The one that settles it is `100dvh vs innerHeight vs screen`: if 100dvh is SHORTER than the
 * screen by roughly the inset, the shell stops above the home indicator and a strip is unavoidable
 * from inside it. If they match, the shell already reaches the bottom and any remaining gap is
 * padding inside the bar.
 */
export function ViewportReadout(): ReactElement {
  const [r, setR] = useState<Readout | null>(null);

  // Measured in a rAF rather than synchronously in the effect body: the values are only meaningful
  // once layout has settled, and it keeps this off the react-hooks/set-state-in-effect exemption
  // list, which a temporary diagnostic has no business joining.
  useEffect(() => {
    const id = requestAnimationFrame(() => setR(measure()));
    return () => cancelAnimationFrame(id);
  }, []);

  return render(r);
}

function measure(): Readout {
  {
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;top:0;left:0;height:100dvh;width:1px;pointer-events:none;visibility:hidden';
    document.body.appendChild(probe);
    const dvh = probe.getBoundingClientRect().height;
    probe.remove();

    const inset = (side: string): string => {
      const el = document.createElement('div');
      el.style.cssText = `position:fixed;padding-bottom:env(safe-area-inset-${side});visibility:hidden`;
      document.body.appendChild(el);
      const v = getComputedStyle(el).paddingBottom;
      el.remove();
      return v;
    };

    const dpr = window.devicePixelRatio || 1;
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari's own flag for "added to home screen".
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    return {
      '100dvh': `${Math.round(dvh)} px`,
      'window.innerHeight': `${window.innerHeight} px`,
      'visualViewport.height': `${Math.round(window.visualViewport?.height ?? 0)} px`,
      'documentElement.clientHeight': `${document.documentElement.clientHeight} px`,
      'screen.height': `${window.screen.height} px`,
      'devicePixelRatio': String(dpr),
      'safe-area-inset-top': inset('top'),
      'safe-area-inset-bottom': inset('bottom'),
      'display-mode standalone': String(standalone),
      // COMPARE AGAINST THE VIEWPORT, NEVER AGAINST screen.height.
      //
      // Both earlier versions of this line got that wrong and both produced a confident, false
      // verdict. screen.height is the whole physical panel, and an app is not given all of it: in
      // Safari the browser chrome takes ~209px, and in the installed PWA the STATUS BAR takes the
      // top inset. The real reading from the installed app was 100dvh 879, innerHeight 879,
      // screen.height 926, top inset 47 - and 926 - 879 is exactly 47, the status bar. The shell
      // reached the bottom perfectly and this line called it "47px SHORT" and blamed the shell.
      //
      // innerHeight IS the viewport, so `dvh vs innerHeight` is the only comparison that answers
      // "does the shell reach the bottom". The green-vs-red bars say the same thing visually, and
      // they were right both times this line was wrong.
      'THE ANSWER': Math.round(dvh) >= window.innerHeight - 1
        ? `100dvh FILLS the viewport (${window.innerHeight}px). The shell reaches the bottom, so any gap is padding inside the bar.${standalone ? '' : ' Note: browser, not the installed app, so the insets are 0 and none of the safe-area handling is exercised here.'}`
        : `100dvh is ${Math.round(window.innerHeight - dvh)}px short of the ${window.innerHeight}px viewport. The shell height IS the fault.`,
      'screen vs viewport': `${window.screen.height - window.innerHeight}px of the panel is system chrome (${standalone ? 'status bar' : 'browser UI'}), which the app is never given. Not a gap.`,
    };
  }
}

function render(r: Readout | null): ReactElement {
  return (
    // Fixed inset-0 on purpose: this box covers the whole visual viewport whatever dvh does, so the
    // red line at its bottom marks the true bottom edge of the screen.
    <div className="fixed inset-0 flex flex-col bg-black font-mono text-[13px] text-white">
      <div className="flex-1 overflow-auto p-4">
        <div className="mb-3 text-[15px] font-bold">viewport check</div>
        {r ? (
          <table>
            <tbody>
              {Object.entries(r).map(([k, v]) => (
                <tr key={k}>
                  <td className="pr-3 align-top text-white/50">{k}</td>
                  <td className="align-top">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-white/50">measuring…</div>
        )}
        <p className="mt-4 max-w-[34ch] text-white/40">
          The green bar below sits at the bottom of a 100dvh box. The red bar sits at the bottom of a
          fixed inset-0 box, which is the real bottom of the screen. If you can see red under green,
          100dvh does not reach the bottom.
        </p>
      </div>

      {/* Bottom of a 100dvh box. */}
      <div className="pointer-events-none absolute left-0 top-0 h-[100dvh] w-full">
        <div className="absolute bottom-0 left-0 h-2 w-full bg-green-500" />
      </div>
      {/* Bottom of the real screen. */}
      <div className="h-2 w-full flex-none bg-red-600" />
    </div>
  );
}
