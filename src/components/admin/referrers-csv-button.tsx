'use client';

// Client-side CSV export for the referrers leaderboard. All rows are already on the client
// (server sent them into props), so no round-trip is needed, we just build a Blob and click a
// synthetic anchor. English-only admin tool, so no i18n. RFC 4180 quoting: any value containing
// a comma, quote, or newline gets wrapped in quotes with internal quotes doubled.

import type { ReactElement } from 'react';

export type CsvReferrerRow = {
  rank: number;
  name: string;
  email: string;
  referralCount: number;
  entryCount: number;
  referralCode: string;
  firstReferredAt: string | null;
  milestones: string[];
};

function csvEscape(v: string | number): string {
  const s = String(v);
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCsv(rows: CsvReferrerRow[]): string {
  const header = ['Rank', 'Name', 'Email', 'Referrals', 'Entries', 'Share code', 'First referred at', 'Milestones'];
  const lines = [header.map(csvEscape).join(',')];
  for (const r of rows) {
    lines.push([
      r.rank,
      r.name,
      r.email,
      r.referralCount,
      r.entryCount,
      r.referralCode,
      r.firstReferredAt ?? '',
      r.milestones.join('|'),
    ].map(csvEscape).join(','));
  }
  return lines.join('\r\n');
}

export function ReferrersCsvButton({ rows }: { rows: CsvReferrerRow[] }): ReactElement {
  const disabled = rows.length === 0;

  function download(): void {
    if (disabled) return;
    const csv = toCsv(rows);
    // Excel-safe: BOM prefix so Excel treats it as UTF-8 (accented names in ES survive).
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `waitlist-referrers-top-${rows.length}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke on next tick so Safari has time to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={disabled}
      className="rounded-md border border-line bg-bg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[1.2px] text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
    >
      Download top {rows.length || 500} referrers CSV
    </button>
  );
}
