// The one container every coach page renders inside. Width and gutters are decided HERE, once, not
// re-invented per page: see .tf-coach-page in src/app/globals.css for the ceiling and the
// data-coach-bleed escape hatch that full-height surfaces (the inbox) use.
//
// This layout deliberately does no auth work. requireCoach() stays on each page, matching the
// per-page guard rule in src/app/(app)/layout.tsx.
import type { ReactElement, ReactNode } from 'react';

export default function CoachLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="tf-coach-page">
      {/* Mounted ONCE here rather than on each of the eleven tracked pages. One mount cannot drift
          out of sync; eleven can, and the twelfth page anybody adds would silently never tick.
          The action re-derives the step from the path server-side, so this cannot mark anything the
          coach did not actually open. */}
      {children}
    </div>
  );
}
