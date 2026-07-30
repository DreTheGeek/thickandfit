// CSV export of one past-client segment (F2: the list Stephanie corrects by hand).
//
// Operator-gated. This returns real names, emails and phone numbers, so the guard is the whole point:
// requireOperator throws/redirects for anyone else, and there is no unauthenticated path to it.
import { NextResponse } from 'next/server';
import { requireOperator } from '@/lib/auth/guards';
import { contactsInSegment, segmentsToCsv, SEGMENTS, type Segment } from '@/lib/admin/segments';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const ctx = await requireOperator();
  if (!ctx.companyId) return new NextResponse('No company scope', { status: 400 });

  const raw = new URL(req.url).searchParams.get('segment') ?? '';
  if (!(SEGMENTS as readonly string[]).includes(raw)) {
    return new NextResponse('Unknown segment', { status: 400 });
  }
  const segment = raw as Segment;

  const rows = await contactsInSegment(ctx.companyId, segment);
  const csv = segmentsToCsv(rows);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      // Filename carries the segment so a folder of these stays readable.
      'Content-Disposition': `attachment; filename="thickandfit-${segment}.csv"`,
      // Never cache a file full of member PII at any layer.
      'Cache-Control': 'no-store, private',
    },
  });
}
