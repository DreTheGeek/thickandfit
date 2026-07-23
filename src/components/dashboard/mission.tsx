'use client';
// Today's mission: the identity framing from .planning/POSITIONING-IDENTITY.md. The screen should
// open on "here is your day and how much of it you own", not on a number.
//
// HONESTY CONSTRAINT: the brief asked for TRAIN / FUEL / MOVE / RECOVER. Move and Recover would need
// step and sleep data, which this app does not collect (Apple Health is deferred, see the Gap Log),
// so rendering them would mean either an always-empty row or an invented one. The mission therefore
// runs on the four things that ARE tracked: the assigned workout, the food diary, today's habits and
// the weekly check-in. Add Move and Recover here the day wearable sync ships, not before.
import type { ReactElement } from 'react';
import Link from 'next/link';

import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';

export type MissionItem = {
  key: 'train' | 'fuel' | 'habits' | 'checkin';
  label: string;
  detail: string;
  href: string;
  done: boolean;
};

export function Mission({
  items,
  title,
  weekLine,
  evolutionHref,
  evolutionLabel,
}: {
  items: MissionItem[];
  title: string;
  weekLine: string | null;
  /** When set, the week line becomes the front door to the Evolution timeline. */
  evolutionHref?: string;
  evolutionLabel?: string;
}): ReactElement | null {
  if (items.length === 0) return null;

  const done = items.filter((i) => i.done).length;
  const pct = Math.round((done / items.length) * 100);

  const ICONS: Record<MissionItem['key'], 'dumbbell' | 'nutrition' | 'check' | 'ruler'> = {
    train: 'dumbbell',
    fuel: 'nutrition',
    habits: 'check',
    checkin: 'ruler',
  };

  return (
    <Card className="p-[22px]">
      <div className="flex items-end justify-between gap-4">
        <p className="text-[11px] font-semibold uppercase tracking-[2px] text-faint">{title}</p>
        <p className="tf-display text-[26px] leading-none text-accent">{pct}%</p>
      </div>

      <div className="mt-3 h-[6px] w-full overflow-hidden rounded-full bg-warm">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="mt-5 flex flex-col gap-2.5">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="tf-press flex items-center gap-3.5 rounded-2xl bg-warm/60 px-4 py-3 hover:bg-warm"
            >
              <span
                className={[
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  item.done ? 'bg-accent text-accent-ink' : 'bg-surface text-muted',
                ].join(' ')}
              >
                <Icon name={ICONS[item.key]} size={18} strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold uppercase tracking-[1.4px] text-faint">
                  {item.label}
                </span>
                <span className="block truncate text-[14px] font-semibold text-ink">
                  {item.detail}
                </span>
              </span>
              {item.done ? (
                <span className="shrink-0 text-accent">
                  <Icon name="check" size={18} strokeWidth={3} />
                </span>
              ) : (
                <span className="shrink-0 text-faint">
                  <Icon name="chevronRight" size={18} />
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      {weekLine ? (
        evolutionHref ? (
          <Link
            href={evolutionHref}
            className="tf-press mt-5 flex items-center justify-between gap-3 border-t border-divider pt-4"
          >
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-[2px] text-faint">
                {weekLine}
              </span>
              {evolutionLabel ? (
                <span className="mt-0.5 block truncate text-[13px] font-semibold text-ink">
                  {evolutionLabel}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-faint">
              <Icon name="chevronRight" size={18} />
            </span>
          </Link>
        ) : (
          <div className="mt-5 border-t border-divider pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[2px] text-faint">
              {weekLine}
            </p>
          </div>
        )
      ) : null}
    </Card>
  );
}
