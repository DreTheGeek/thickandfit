'use client';

// Train screen pieces, 8.0 handoff (data-screen="train").
//
// Presentational only. The program, its day list and the active day all arrive as props from
// activities-screen.tsx; nothing here reads the database.
import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';
import { PortalCard, PortalLabel } from '@/components/portal/today-cards';
import { shootImage } from '@/lib/brand/shoot';
import { PortalMediaRow } from '@/components/portal/portal-chrome';


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
          <PortalMediaRow
            key={r.key}
            href={r.href}
            title={r.title}
            sub={r.sub}
            thumb={
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={shootImage(r.imageIndex)}
                alt=""
                className="h-[53px] w-[53px] rounded-[9px] object-cover"
              />
            }
          />
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
