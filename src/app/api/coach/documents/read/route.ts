// Read an uploaded file and return the text in it. Coach-gated, stores nothing.
//
// WHY A ROUTE AND NOT A SERVER ACTION. Server actions post through the React payload with a 1 MB
// body limit by default, and a five-page PDF is comfortably past that. Raising the limit globally to
// carry one upload is the wrong trade; a route handler takes multipart directly and the cap lives in
// one place (MAX_UPLOAD_BYTES) instead of in next.config.
import { NextResponse } from 'next/server';
import { requireCoach } from '@/lib/auth/guards';
import { MAX_UPLOAD_BYTES, readUploadedFile } from '@/lib/documents/read-file';

// unpdf is a Node build of pdfjs; it does not run on the edge runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A scanned-image transcription is a vision call on a full-resolution screenshot, which regularly
// takes longer than the 15s default.
export const maxDuration = 120;

export async function POST(req: Request): Promise<NextResponse> {
  const ctx = await requireCoach();
  if (!ctx.companyId) return NextResponse.json({ ok: false, reason: 'error' }, { status: 403 });

  let file: File | null = null;
  try {
    const form = await req.formData();
    const candidate = form.get('file');
    if (candidate instanceof File) file = candidate;
  } catch {
    return NextResponse.json({ ok: false, reason: 'error' }, { status: 400 });
  }
  if (!file) return NextResponse.json({ ok: false, reason: 'error' }, { status: 400 });
  // Check the declared size before reading the body into memory, so an oversized upload costs one
  // header read rather than 40 MB of buffer.
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, reason: 'tooLarge' }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const result = await readUploadedFile(file.name, buf, ctx.companyId, ctx.userId);

  // A file we could not read is not a server fault, and returning 4xx/5xx would make it one in
  // Sentry. The body carries the reason and the client turns it into something she can act on.
  return NextResponse.json(result, { status: 200 });
}
