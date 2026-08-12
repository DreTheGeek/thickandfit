// Read one uploaded file and hand back the text inside it.
//
// This is the whole "she can drop a screenshot, a doc, a sheet or a PDF into her method" capability.
// Everything that can be read without a model is read without one (extract-text.ts); a screenshot
// is the only case that needs vision, and it reuses the same flagship model the food scan uses.
//
// WHAT THIS DELIBERATELY DOES NOT DO: save anything. It returns text and the caller shows it to her
// for review before it is stored. That is not politeness, it is the safety property: extraction is
// never perfect, and a knowledge base is the one place where a half-read document is worse than no
// document, because from then on it answers her clients in fragments and looks exactly like a good
// source in the list.
import 'server-only';
import { callJson } from '@/lib/ai/client';
import { AI_MODELS } from '@/lib/ai/models';
import {
  detectKind,
  extractOffline,
  looksLikeLanguage,
  titleFromFilename,
  type DocKind,
  type ExtractFailure,
} from '@/lib/documents/extract-text';

export const MAX_UPLOAD_BYTES = 4_000_000;

// Vercel's serverless request body ceiling is 4.5 MB, so a bigger file does not fail slowly, it
// fails at the edge with a 413 and no message we control. Refuse it here with a number she can act
// on instead.
export type ReadFileResult =
  | { ok: true; kind: DocKind; text: string; title: string; note: string | null }
  | { ok: false; reason: ExtractFailure | 'tooLarge' | 'notConfigured' | 'error' };

// Transcription, NOT description. A screenshot of her protocol should come back as the protocol,
// not as "this image shows a meal plan with several sections", which is what a vision model
// defaults to and which is useless as knowledge.
const IMAGE_PROMPT = `You are transcribing an image so its contents can be stored as reference text.

Return ONLY the text and information visible in the image, as plain text:
- Transcribe all visible text exactly, preserving headings, numbered lists and bullet lists.
- Preserve tables as one line per row with " | " between cells.
- If the image is a chart or a photo rather than a document, describe precisely what it shows,
  including every number, axis label and legend entry you can read.
- Do not add commentary, do not summarise, do not explain what the image is.
- If there is no legible content at all, return exactly: NO_TEXT`;

export async function readUploadedFile(
  filename: string,
  buf: Buffer,
  companyId: string,
  profileId: string | null,
): Promise<ReadFileResult> {
  if (buf.length > MAX_UPLOAD_BYTES) return { ok: false, reason: 'tooLarge' };
  if (buf.length === 0) return { ok: false, reason: 'empty' };

  const detected = detectKind(filename, buf);
  if (!detected) return { ok: false, reason: 'unsupported' };
  const title = titleFromFilename(filename);

  if (detected.kind !== 'image') {
    const res = await extractOffline(detected.kind, detected.ext, buf);
    if (!res.ok) return { ok: false, reason: res.reason };
    return { ok: true, kind: detected.kind, text: res.text, title, note: res.note };
  }

  return readImage(filename, buf, detected.ext, title, companyId, profileId);
}

async function readImage(
  filename: string,
  buf: Buffer,
  ext: string,
  title: string,
  companyId: string,
  profileId: string | null,
): Promise<ReadFileResult> {
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;

  const res = await callJson({
    // Same chain as the food scan: the flagship reads a photo of a label reliably and the fallback
    // means one provider blip degrades the result instead of losing her document.
    models: [AI_MODELS.smartScan, AI_MODELS.smartScanFallback],
    responseFormat: 'text',
    reasoningEffort: 'low',
    timeoutMs: 90_000,
    traceFeature: 'doc-read',
    companyId,
    profileId,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `${IMAGE_PROMPT}\n\nFilename: ${filename}` },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
  });
  // No `provenance` here on purpose: ai_inferences is the eval + correction-capture corpus, keyed to
  // a closed set of features with a scored gold set behind each one. A transcription has no ground
  // truth to score against, so it belongs in ai_trace (which traceFeature above writes, and which is
  // what her method page reads) rather than padding the eval corpus with rows nothing can grade.

  if (res.status === 'notConfigured') return { ok: false, reason: 'notConfigured' };
  if (res.status === 'error') return { ok: false, reason: 'error' };

  const text = res.content.trim();
  // The model is told to answer NO_TEXT rather than invent a description of a blank image, because
  // an invented description is indistinguishable from a real transcription once it is stored.
  if (!text || text === 'NO_TEXT' || !looksLikeLanguage(text)) return { ok: false, reason: 'empty' };
  return { ok: true, kind: 'image', text, title, note: null };
}
