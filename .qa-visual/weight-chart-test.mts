// The weight trend chart must never write a non-finite number into an SVG attribute.
//
// WHAT THIS PINS. `/progress` shipped rendering the chart with an EMPTY series. `Math.min(...[])`
// is `Infinity` and `Math.max(...[])` is `-Infinity`, so the y scale divides -Infinity by -Infinity
// and every coordinate serialises as the literal string "NaN". The browser rejects each one, twelve
// times per render:
//
//     Error: <line> attribute y1: Expected length, "NaN".
//
// It was live on the DEFAULT tab of a screen every member opens, for every member with no weight
// logged - on launch day, all of them. tsc, eslint and `next build` were all green: NaN is a number
// and `String(NaN)` is a string, so nothing is statically wrong. It surfaced only when a browser
// was pointed at the page with a console attached.
//
// So the check is not "does it look right", it is "can any input make a coordinate non-finite".
// Server-rendering the real component and reading the markup is the cheapest way to ask that, and
// it covers the two callers that guard the length themselves as well as the one that did not.
//
//   npx tsx .qa-visual/weight-chart-test.mts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WeightTrendChart } from '../src/components/progress/weight-trend-chart';
import type { WeightPoint } from '../src/lib/body/types';

const p = (on: string, lb: number): WeightPoint => ({ on, lb }) as WeightPoint;

const CASES: { name: string; series: WeightPoint[]; goalLb: number | null }[] = [
  // The one that shipped broken.
  { name: 'empty series, goal set', series: [], goalLb: 141 },
  { name: 'empty series, no goal', series: [], goalLb: null },
  // A member who logged once. n === 1 takes the other branch of x(), and rawMax - rawMin is 0, so
  // the spread floor is the only thing keeping max - min off zero.
  { name: 'single reading', series: [p('2026-08-01', 165)], goalLb: 140 },
  { name: 'single reading, no goal', series: [p('2026-08-01', 165)], goalLb: null },
  // Every reading identical: the same zero spread as above, with a real line to draw.
  { name: 'flat line', series: [p('2026-08-01', 160), p('2026-08-02', 160), p('2026-08-03', 160)], goalLb: 150 },
  // A goal far outside the data range, which is the case the clamp exists for.
  { name: 'goal far below', series: [p('2026-08-01', 200), p('2026-08-02', 199)], goalLb: 120 },
  { name: 'goal far above', series: [p('2026-08-01', 120), p('2026-08-02', 121)], goalLb: 260 },
  { name: 'goal equals every reading', series: [p('2026-08-01', 150), p('2026-08-02', 150)], goalLb: 150 },
  // Ordinary data, so a pass here is not just "it refused everything".
  { name: 'normal trend', series: [p('2026-06-01', 178), p('2026-07-01', 172), p('2026-08-01', 165)], goalLb: 155 },
];

const failures: string[] = [];
let pass = 0;

for (const c of CASES) {
  let html = '';
  try {
    html = renderToStaticMarkup(
      createElement(WeightTrendChart, { series: c.series, goalLb: c.goalLb, goalLabel: 'Goal' }),
    );
  } catch (e) {
    failures.push(`${c.name}: threw ${String(e).slice(0, 120)}`);
    continue;
  }

  const bad = html.match(/="[^"]*(NaN|Infinity)[^"]*"/g);
  if (bad) {
    failures.push(`${c.name}: ${bad.length} non-finite attribute(s), first: ${bad[0]}`);
    continue;
  }
  // An empty series must render nothing at all, not an axis with no data on it: a bare frame reads
  // as a broken chart, and the callers show their own "log your weight" copy instead.
  if (c.series.length === 0 && html !== '') {
    failures.push(`${c.name}: expected no output for an empty series, got ${html.length} chars`);
    continue;
  }
  if (c.series.length > 0 && !html.includes('<svg')) {
    failures.push(`${c.name}: expected an <svg>, got ${html.slice(0, 80)}`);
    continue;
  }
  pass += 1;
}

if (failures.length) {
  console.error(`FAIL (${failures.length}/${CASES.length})`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log(`OK: ${pass} chart inputs, no NaN or Infinity reaches an SVG attribute`);
