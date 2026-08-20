// Shared 8.0 chrome (.planning/design_handoff/8.0/client-portal.html).
//
// Presentational only, and deliberately SERVER-SAFE: no 'use client', no hooks, no handlers. Both
// kinds of screen consume these. today-screen.tsx is a client component, you-screen.tsx is an async
// server component, and a primitive that reached for state would block the second one. Anything
// needing an event handler belongs in the screen, or in a client file of its own.
import type { ReactElement, ReactNode } from 'react';

/**
 * A card that sits RAISED above the page, in either palette.
 *
 * This exists because `<Card dark>` encodes an inversion instead of a role: `bg-ink text-bg`. In the
 * light theme ink is #0f0f0f and bg is #e7e5df, so it renders a dark card on warm paper, which was
 * the intent. Inside `.tf-portal` ink is #ffffff and bg is #000000, so the same class pair renders a
 * WHITE BLOCK on a black screen. It shipped that way on /community (the challenge card and the coach
 * broadcast) and /you (the goal card).
 *
 * `bg-warm` is the raised surface in both palettes, #dddbd3 on paper and #19191c on black, so the
 * card keeps its separation from the feed without the tokens flipping underneath it.
 *
 * The distinction that matters: `.tf-portal` re-themes anything written in ROLES (bg-surface,
 * text-muted) for free, and silently inverts anything written in LITERALS (bg-ink, text-bg). When a
 * component needs to look different from the page, name the role it wants, never the two ends of a
 * palette you are assuming the direction of.
 *
 * These three surfaces in particular render under BOTH shells: a member gets SubscriberShell and the
 * portal scope, a coach opening the same /community route gets CoachShell and does not.
 */
export function RaisedCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  return <div className={`rounded-2xl bg-warm text-ink ${className}`}>{children}</div>;
}
