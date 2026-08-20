'use client';

// Train screen pieces, 8.0 handoff (data-screen="train").
//
// Presentational only. The program, its day list and the active day all arrive as props from
// activities-screen.tsx; nothing here reads the database.
import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';
import { PortalCard, PortalLabel } from '@/components/portal/today-cards';

/**
 * Her own shoot, standing in for the handoff's stock gym photography.
 *
 * The handoff points every workout image at Unsplash. These are the real files in public/brand/shoot,
 * and using them here is correct rather than merely available: it is HER program, so her training
 * photography is the honest illustration for it. Picked by index so a given day keeps the same photo
 * between renders instead of shuffling under the member.
 */
const SHOOT = [
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

/** The handoff's .train-tabs: underline on the active one, no pill, no fill. */
export function TrainTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}): ReactElement {
  return (
    <div className="mb-3 flex gap-[18px]" role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={[
              'tf-press text-[12px]',
              active ? 'border-b-2 border-ink pb-2 text-ink' : 'pb-2 text-faint',
            ].join(' ')}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Today's workout: a 150px banner with the session name over a darkening gradient, and the one
 * button the screen exists to offer.
 */
export function WorkoutBanner({
  title,
  meta,
  href,
  cta,
  imageIndex = 0,
  children,
}: {
  title: string;
  meta: string;
  href: string;
  cta: string;
  imageIndex?: number;
  children?: ReactNode;
}): ReactElement {
  return (
    <PortalCard className="mt-2 p-3">
      <div className="relative h-[150px] overflow-hidden rounded-[15px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shootImage(imageIndex)} alt="" className="h-full w-full object-cover" />
        {/* Left-weighted so the copy stays legible whatever the photo is doing behind it. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to right, rgba(0,0,0,.78), rgba(0,0,0,.12))' }}
        />
        <div className="absolute bottom-3.5 left-3.5 z-[3]">
          <strong className="block text-[16px] leading-tight text-white">{title}</strong>
          <small className="text-[#bbb]">{meta}</small>
        </div>
      </div>

      <Link
        href={href}
        className="tf-press mt-[11px] block rounded-full bg-ink py-3.5 text-center text-[13px] font-black uppercase tracking-[0.5px] text-bg"
      >
        {cta}
      </Link>

      {children}
    </PortalCard>
  );
}

/** "Up next": the sessions after today, with a thumbnail each. */
export function UpNext({
  label,
  rows,
}: {
  label: string;
  rows: { key: string; title: string; sub: string; href: string; imageIndex: number }[];
}): ReactElement | null {
  if (rows.length === 0) return null;
  return (
    <PortalCard className="mt-2.5 p-[13px]">
      <PortalLabel>{label}</PortalLabel>
      <div className="mt-3 grid gap-2.5">
        {rows.map((r) => (
          <Link key={r.key} href={r.href} className="tf-press grid grid-cols-[53px_1fr] items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shootImage(r.imageIndex)}
              alt=""
              className="h-[53px] w-[53px] rounded-[9px] object-cover"
            />
            <div className="min-w-0">
              <strong className="block truncate text-[12px]">{r.title}</strong>
              <small className="block truncate text-faint">{r.sub}</small>
            </div>
          </Link>
        ))}
      </div>
    </PortalCard>
  );
}

/** "Split overview": every day in the block, with today marked. */
export function SplitOverview({
  label,
  days,
  activeIndex,
  hrefFor,
}: {
  label: string;
  days: { index: number; label: string }[];
  activeIndex: number;
  hrefFor: (index: number) => string;
}): ReactElement | null {
  if (days.length <= 1) return null;
  return (
    <PortalCard className="mt-2.5 p-3.5">
      <PortalLabel>{label}</PortalLabel>
      <div className="mt-2">
        {days.map((d) => {
          const active = d.index === activeIndex;
          return (
            <Link
              key={d.index}
              href={hrefFor(d.index)}
              scroll={false}
              className={[
                'tf-press grid grid-cols-[37px_1fr_auto] py-1.5 text-[11px]',
                active ? 'text-ink' : 'text-soft',
              ].join(' ')}
            >
              <span className="tabular-nums">{d.index + 1}</span>
              <span className="truncate">{d.label}</span>
              {/* The dot is the only thing marking today, so it carries meaning and is not decoration. */}
              <span aria-hidden>{active ? '●' : ''}</span>
            </Link>
          );
        })}
      </div>
    </PortalCard>
  );
}
