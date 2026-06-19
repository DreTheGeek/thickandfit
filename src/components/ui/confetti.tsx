'use client';

import { useCallback, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';

const COLORS = ['#0f0f0f', '#767676', '#b7b7b7'];

type Piece = { id: number; style: CSSProperties };

function generate(): Piece[] {
  return Array.from({ length: 36 }, (_, i) => {
    const x = `${(Math.random() * 280 - 140).toFixed(0)}px`;
    const y = `${(Math.random() * -300 - 60).toFixed(0)}px`;
    const r = `${(Math.random() * 600 - 300).toFixed(0)}deg`;
    return {
      id: i,
      style: {
        position: 'absolute',
        left: '50%',
        top: '48%',
        width: i % 2 ? 7 : 9,
        height: i % 2 ? 11 : 7,
        background: COLORS[i % 3],
        borderRadius: i % 4 ? 2 : 99,
        ['--x' as string]: x,
        ['--y' as string]: y,
        ['--r' as string]: r,
        animation: 'tf-confetti 1.15s cubic-bezier(.15,.6,.3,1) forwards',
        animationDelay: `${(Math.random() * 0.12).toFixed(2)}s`,
      },
    };
  });
}

/** Trigger handle for milestone confetti. State updates happen in the event handler. */
export function useConfetti(): { pieces: Piece[]; fire: () => void } {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const fire = useCallback(() => {
    setPieces(generate());
    setTimeout(() => setPieces([]), 1400);
  }, []);
  return { pieces, fire };
}

/**
 * Milestone confetti burst (workout complete / streak / goal hit).
 * Renders inside a `position:relative` parent.
 */
export function Confetti({ pieces }: { pieces: Piece[] }): ReactElement | null {
  if (pieces.length === 0) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: 80 }}
      aria-hidden
    >
      {pieces.map((p) => (
        <div key={p.id} style={p.style} />
      ))}
    </div>
  );
}
