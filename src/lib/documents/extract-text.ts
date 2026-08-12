// Turning a file she drops in into text her assistant can actually learn from.
//
// Nothing in here touches the network or the database, so all of it is testable against real files
// on disk, which is the only way to know a PDF reader works. The one extraction that DOES need a
// model (a screenshot) lives in read-file.ts.
//
// THE RULE THIS FILE IS BUILT AROUND: a bad extraction must fail loudly, never quietly. Half-read
// text is worse than no text, because it lands in the knowledge base looking exactly like a good
// document and then answers her clients with fragments of it. So every path either returns text that
// passed a legibility check or returns a reason she can act on.

import { readZip } from '@/lib/documents/zip';

export type DocKind = 'pdf' | 'sheet' | 'doc' | 'text' | 'image';

export type ExtractFailure =
  // A PDF with no text layer: a scan or an image export. Screenshots of the pages work, so say that.
  | 'scanned'
  // Text came out, but it is not language. Almost always a PDF using embedded font encodings we
  // cannot map back to characters.
  | 'unreadable'
  | 'empty'
  | 'corrupt'
  | 'unsupported';

export type ExtractResult =
  | { ok: true; text: string; note: string | null }
  | { ok: false; reason: ExtractFailure };

// --- shared helpers ---------------------------------------------------------

const XML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

export function decodeXmlEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    if (body.startsWith('#')) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return XML_ENTITIES[body] ?? whole;
  });
}

function tidy(s: string): string {
  return s
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Is this actually language, or is it the debris of a failed decode?
 *
 * The specific failure this catches: a PDF whose fonts use a custom encoding decodes to
 * well-formed-looking bytes that are not the characters on the page. It never throws, it just
 * produces "" forever. Counting the share of characters that belong in
 * prose separates that from real text without needing a dictionary or a language guess, so it works
 * the same on English and Spanish.
 */
export function looksLikeLanguage(text: string): boolean {
  const t = text.trim();
  if (t.length < 30) return false;
  let legible = 0;
  for (const ch of t) {
    const c = ch.codePointAt(0) ?? 0;
    // Letters (incl. accented Latin), digits, whitespace and the punctuation prose actually uses.
    if (
      (c >= 0x41 && c <= 0x5a) ||
      (c >= 0x61 && c <= 0x7a) ||
      (c >= 0x30 && c <= 0x39) ||
      (c >= 0xc0 && c <= 0x24f) ||
      c === 0x20 ||
      c === 0x0a ||
      c === 0x09 ||
      '.,;:!?¿¡\'"()[]{}/\\-–—_%$€£&@#*+=<>|~`°'.includes(ch)
    ) {
      legible += 1;
    }
  }
  const ratio = legible / [...t].length;
  if (ratio < 0.85) return false;
  // A page of pure punctuation and digits would pass the ratio test. Require some actual words.
  return /[A-Za-zÀ-ÿ]{3,}/.test(t);
}

/** Strip the path a browser sometimes sends, drop the extension, and tidy separators into words. */
export function titleFromFilename(filename: string): string {
  const base = (filename.split(/[\\/]/).pop() ?? filename).replace(/\.[^.]+$/, '');
  const cleaned = base.replace(/[_-]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return cleaned.slice(0, 120) || 'Untitled';
}

// --- plain text -------------------------------------------------------------

export function extractPlainText(buf: Buffer): ExtractResult {
  // A UTF-8 BOM survives Buffer.toString and shows up as a stray character in the first chunk.
  const text = tidy(buf.toString('utf8').replace(/^﻿/, ''));
  if (!text) return { ok: false, reason: 'empty' };
  return { ok: true, text, note: null };
}

// --- delimited text (csv / tsv) ---------------------------------------------

/**
 * RFC 4180 fields: quoted values may contain the delimiter, a newline, or a doubled quote.
 * Splitting on commas is the obvious shortcut and it corrupts every row containing "Chicken, raw".
 */
export function parseDelimited(input: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = input.replace(/\r\n?/g, '\n');

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

function sniffDelimiter(sample: string): string {
  const firstLine = sample.split('\n')[0] ?? '';
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const semis = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  if (tabs >= commas && tabs >= semis && tabs > 0) return '\t';
  // Spanish-locale Excel exports use ';' because the comma is the decimal separator. Guessing wrong
  // collapses every row into one field, which is exactly the silent corruption we are avoiding.
  if (semis > commas) return ';';
  return ',';
}

export function extractDelimited(buf: Buffer): ExtractResult {
  const raw = buf.toString('utf8').replace(/^﻿/, '');
  const rows = parseDelimited(raw, sniffDelimiter(raw));
  if (rows.length === 0) return { ok: false, reason: 'empty' };
  return { ok: true, text: rowsToText(rows), note: null };
}

// A spreadsheet is read by a language model, not a spreadsheet engine, so the useful shape is the
// header repeated per value rather than a grid: "Protein: 32 g" survives chunking, whereas a column
// of bare numbers loses its meaning the moment a chunk boundary cuts the header off.
function rowsToText(rows: string[][]): string {
  const header = rows[0]?.map((h) => h.trim()) ?? [];
  const headerIsLabels = header.length > 1 && header.every((h) => h.length > 0 && !/^-?[\d.,]+$/.test(h));
  if (!headerIsLabels) return tidy(rows.map((r) => r.join(' | ')).join('\n'));

  const lines: string[] = [header.join(' | ')];
  for (const row of rows.slice(1)) {
    const pairs = row
      .map((cell, i) => (cell.trim() ? `${header[i] ?? `col${i + 1}`}: ${cell.trim()}` : ''))
      .filter(Boolean);
    if (pairs.length > 0) lines.push(pairs.join(' · '));
  }
  return tidy(lines.join('\n'));
}

// --- xlsx -------------------------------------------------------------------

function xmlTagValues(xml: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</${tag}>)`, 'g');
  let m: RegExpExecArray | null = re.exec(xml);
  while (m !== null) {
    out.push(m[1] ?? '');
    m = re.exec(xml);
  }
  return out;
}

export function extractXlsx(buf: Buffer): ExtractResult {
  const zip = readZip(buf);
  if (!zip.ok) return { ok: false, reason: zip.reason === 'notZip' ? 'unsupported' : 'corrupt' };

  // Shared strings are stored once and referenced by index from every cell that uses them, so a
  // sheet read without this file is a sheet of integers.
  const sharedXml = zip.entries.get('xl/sharedStrings.xml')?.toString('utf8') ?? '';
  const shared = xmlTagValues(sharedXml, 'si').map((si) =>
    decodeXmlEntities(xmlTagValues(si, 't').join('')).trim(),
  );

  const sheetNames = xmlTagValues(zip.entries.get('xl/workbook.xml')?.toString('utf8') ?? '', 'sheets')
    .join('')
    .match(/name="([^"]*)"/g)
    ?.map((s) => decodeXmlEntities(s.slice(6, -1)));

  const paths = [...zip.entries.keys()]
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort((a, b) => Number(a.match(/(\d+)/)?.[1] ?? 0) - Number(b.match(/(\d+)/)?.[1] ?? 0));
  if (paths.length === 0) return { ok: false, reason: 'corrupt' };

  const sections: string[] = [];
  paths.forEach((path, idx) => {
    const xml = zip.entries.get(path)?.toString('utf8') ?? '';
    const rows: string[][] = [];
    for (const rowXml of xmlTagValues(xml, 'row')) {
      const cells: string[] = [];
      const cellRe = /<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
      let cm: RegExpExecArray | null = cellRe.exec(rowXml);
      while (cm !== null) {
        const attrs = cm[1] ?? '';
        const body = cm[2] ?? '';
        const type = attrs.match(/\bt="([^"]*)"/)?.[1] ?? 'n';
        let value: string;
        if (type === 's') {
          const i = Number.parseInt(xmlTagValues(body, 'v')[0] ?? '', 10);
          value = Number.isFinite(i) ? (shared[i] ?? '') : '';
        } else if (type === 'inlineStr') {
          value = decodeXmlEntities(xmlTagValues(body, 't').join(''));
        } else {
          value = decodeXmlEntities(xmlTagValues(body, 'v')[0] ?? '');
        }
        cells.push(value.trim());
        cm = cellRe.exec(rowXml);
      }
      if (cells.some((c) => c.length > 0)) rows.push(cells);
    }
    if (rows.length === 0) return;
    const name = sheetNames?.[idx] ?? `Sheet ${idx + 1}`;
    sections.push(`${name}\n${rowsToText(rows)}`);
  });

  if (sections.length === 0) return { ok: false, reason: 'empty' };
  return {
    ok: true,
    text: tidy(sections.join('\n\n')),
    note: sections.length > 1 ? `${sections.length} sheets` : null,
  };
}

// --- docx -------------------------------------------------------------------

export function extractDocx(buf: Buffer): ExtractResult {
  const zip = readZip(buf);
  if (!zip.ok) return { ok: false, reason: zip.reason === 'notZip' ? 'unsupported' : 'corrupt' };
  const xml = zip.entries.get('word/document.xml')?.toString('utf8');
  if (!xml) return { ok: false, reason: 'corrupt' };

  const text = tidy(
    decodeXmlEntities(
      xml
        // Paragraph and row ends are the only structure worth keeping; everything else in a .docx
        // is formatting that a language model does not benefit from.
        .replace(/<\/w:p>/g, '\n')
        .replace(/<\/w:tr>/g, '\n')
        .replace(/<w:tab\b[^>]*\/?>/g, '\t')
        .replace(/<w:br\b[^>]*\/?>/g, '\n')
        .replace(/<\/w:tc>/g, ' | ')
        .replace(/<[^>]+>/g, ''),
    ),
  );
  if (!text) return { ok: false, reason: 'empty' };
  return { ok: true, text, note: null };
}

// --- pdf --------------------------------------------------------------------

/**
 * Read a PDF's text layer.
 *
 * THIS WAS HAND-ROLLED FIRST AND THE HAND-ROLLED VERSION WAS WRONG, which is worth recording so
 * nobody re-litigates it. Pulling literal `(strings)` out of the content streams is a tidy ~120
 * lines and it returns ABSOLUTELY NOTHING for her actual documents: her protocol PDF is a Canva
 * export, Canva embeds subset fonts as Type0/CIDFontType2 with Identity encoding, so every glyph is
 * a hex-encoded font-specific id that only means anything through the /ToUnicode CMap. Mapping
 * those back correctly IS a PDF library. So we use one.
 *
 * WHAT STILL FAILS, deliberately and loudly: a scanned PDF has no text layer at all, and returns
 * 'scanned' so she is told to drop screenshots of the pages instead, which goes down the vision
 * path and works. Anything that decodes to non-language returns 'unreadable' rather than being
 * stored.
 */
export async function extractPdf(buf: Buffer): Promise<ExtractResult> {
  if (buf.toString('latin1', 0, 5) !== '%PDF-') return { ok: false, reason: 'unsupported' };
  const { extractText, getDocumentProxy } = await import('unpdf');

  let text: string;
  try {
    // verbosity 0 = errors only. Left at the default, pdfjs writes a console warning for every
    // subset font it cannot substitute, which on a five-page Canva export is ~30 lines of noise in
    // the production log for a document that read perfectly.
    const doc = await getDocumentProxy(new Uint8Array(buf), { verbosity: 0 });
    const res = await extractText(doc, { mergePages: true });
    text = tidy(Array.isArray(res.text) ? res.text.join('\n') : String(res.text));
  } catch {
    return { ok: false, reason: 'corrupt' };
  }

  if (text.length < 30) return { ok: false, reason: 'scanned' };
  if (!looksLikeLanguage(text)) return { ok: false, reason: 'unreadable' };
  return { ok: true, text, note: null };
}

// --- kind detection ---------------------------------------------------------

const EXT_KIND: Record<string, DocKind> = {
  pdf: 'pdf',
  csv: 'sheet',
  tsv: 'sheet',
  xlsx: 'sheet',
  xlsm: 'sheet',
  docx: 'doc',
  txt: 'text',
  md: 'text',
  markdown: 'text',
  rtf: 'text',
  json: 'text',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  webp: 'image',
  gif: 'image',
  heic: 'image',
  heif: 'image',
};

export type DetectedKind = { kind: DocKind; ext: string } | null;

/**
 * Extension first, magic bytes as the check.
 *
 * The extension carries information the bytes do not: .xlsx and .docx are byte-identical ZIP
 * archives, so only the name (or reading the manifest) tells them apart. The magic bytes are used
 * to catch the reverse case, a file renamed to .pdf that is really a screenshot, which would
 * otherwise fail with a confusing "this PDF is a scan" instead of just being read as an image.
 */
export function detectKind(filename: string, buf: Buffer): DetectedKind {
  const ext = (filename.split('.').pop() ?? '').toLowerCase();
  const byExt = EXT_KIND[ext];
  const magic = sniffMagic(buf);

  if (magic === 'image' && byExt !== 'image') return { kind: 'image', ext };
  if (magic === 'pdf' && byExt !== 'pdf') return { kind: 'pdf', ext: 'pdf' };
  if (byExt) return { kind: byExt, ext };
  if (magic === 'pdf') return { kind: 'pdf', ext: 'pdf' };
  if (magic === 'image') return { kind: 'image', ext };
  return null;
}

function sniffMagic(buf: Buffer): 'pdf' | 'image' | 'zip' | null {
  if (buf.length < 12) return null;
  if (buf.toString('latin1', 0, 5) === '%PDF-') return 'pdf';
  if (buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG') return 'image';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image';
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'image';
  if (buf.toString('latin1', 0, 3) === 'GIF') return 'image';
  if (buf.toString('latin1', 4, 8) === 'ftyp' && /hei[cf]|mif1|msf1/.test(buf.toString('latin1', 8, 12))) {
    return 'image';
  }
  if (buf[0] === 0x50 && buf[1] === 0x4b) return 'zip';
  return null;
}

/** Everything except an image, which needs a model and therefore lives in read-file.ts. */
export async function extractOffline(kind: DocKind, ext: string, buf: Buffer): Promise<ExtractResult> {
  if (kind === 'pdf') return extractPdf(buf);
  if (kind === 'doc') return extractDocx(buf);
  if (kind === 'text') return extractPlainText(buf);
  if (kind === 'sheet') {
    if (ext === 'csv' || ext === 'tsv') return extractDelimited(buf);
    return extractXlsx(buf);
  }
  return { ok: false, reason: 'unsupported' };
}
