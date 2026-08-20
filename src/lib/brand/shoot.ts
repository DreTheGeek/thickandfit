/**
 * Her own training photography, in one place.
 *
 * The 8.0 handoff points every workout image at Unsplash. These are the real files in
 * public/brand/shoot, and using them is correct rather than merely available: it is HER programming,
 * so her photography is the honest illustration for it and a stock model is not.
 *
 * Picked by INDEX rather than at random, so a given program or day keeps the same photo between
 * renders. A library that reshuffles its own artwork every time you open it reads as broken.
 *
 * No 'use client' and no imports: both a server component (the coach's program library) and a client
 * one (the member's Train screen) need this, and a helper that lives in a client module cannot be
 * called from the server without dragging the whole module across the boundary.
 */
export const SHOOT = [
  '/brand/shoot/deadlift.avif',
  '/brand/shoot/legpress.avif',
  '/brand/shoot/cable.avif',
  '/brand/shoot/rack-pose.avif',
  '/brand/shoot/power-stance.avif',
  '/brand/shoot/trust-process.avif',
] as const;

export function shootImage(index: number): string {
  return SHOOT[Math.abs(index) % SHOOT.length];
}
