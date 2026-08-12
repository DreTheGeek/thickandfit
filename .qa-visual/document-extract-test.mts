// Tests for reading a dropped file into text.
//
// These run against REAL FILES, not fixtures I generated to match my own parser. That distinction
// is the whole reason this test exists: the first version of the PDF reader was hand-rolled, passed
// every synthetic case, and returned literally nothing for Stephanie's actual protocol PDF, because
// Canva embeds subset fonts whose glyph ids only resolve through a /ToUnicode CMap. A test written
// against a PDF I built myself would have shipped that.
//
// The .xlsx and .docx fixtures ARE built here, because those two formats are a ZIP of XML written to
// a published spec and the risk is in the container reader, not in some exporter's quirks.
//
// Run: npx tsx .qa-visual/document-extract-test.mts
import { readFileSync, existsSync } from 'node:fs';
import { deflateRawSync, crc32 } from 'node:zlib';
import {
  detectKind,
  extractDelimited,
  extractDocx,
  extractPdf,
  extractPlainText,
  extractXlsx,
  looksLikeLanguage,
  parseDelimited,
  titleFromFilename,
} from '@/lib/documents/extract-text';

let passed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail = ''): void {
  if (cond) passed += 1;
  else failures.push(`${name}${detail ? `: ${detail}` : ''}`);
}

// --- a minimal ZIP writer, so the office fixtures are real archives ----------

function zip(files: { name: string; body: string }[]): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const f of files) {
    const raw = Buffer.from(f.body, 'utf8');
    const deflated = deflateRawSync(raw);
    const crc = crc32(raw);
    const nameBuf = Buffer.from(f.name, 'utf8');

    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    nameBuf.copy(local, 30);
    locals.push(local, deflated);

    const cd = Buffer.alloc(46 + nameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(deflated.length, 20);
    cd.writeUInt32LE(raw.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(offset, 42);
    nameBuf.copy(cd, 46);
    central.push(cd);

    offset += local.length + deflated.length;
  }

  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cdBuf, eocd]);
}

/** A real, well-formed one-page PDF carrying no text: the shape a scan or a photo export has. */
function emptyPagePdf(): Buffer {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xrefAt = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) body += `${String(off).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

// --- legibility gate --------------------------------------------------------
// The gate is what stands between a failed decode and a poisoned knowledge base, so it is tested
// from both sides.

check('legible: english prose', looksLikeLanguage('Weigh oats, eggwhites and green beans uncooked. Season as you please.'));
check('legible: spanish prose', looksLikeLanguage('Pesa la avena y las claras de huevo sin cocinar. Bebe 80 onzas de agua al día.'));
check(
  'illegible: CID-decode debris',
  !looksLikeLanguage('\u0003\u0011\u0007\u0002\u0015\u0011\u0004\u0018\u0002\u0011\u0007\u0003\u0015\u0002\u0018\u0011\u0004\u0007\u0002\u0015\u0011\u0004\u0018\u0002'),
);
check('illegible: too short to judge', !looksLikeLanguage('Protein 32g'));
check('illegible: digits and punctuation only', !looksLikeLanguage('12.5 | 33.1 | 44.9 | 12.5 | 33.1 | 44.9 | 12.5 | 33.1 | 44.9 | 12.5'));

// --- delimited --------------------------------------------------------------

check(
  'csv: a quoted comma stays inside its field',
  parseDelimited('name,note\n"Chicken, raw",lean\n', ',')[1]?.[0] === 'Chicken, raw',
  JSON.stringify(parseDelimited('name,note\n"Chicken, raw",lean\n', ',')),
);
check('csv: a doubled quote is one quote', parseDelimited('a\n"she said ""hi"""\n', ',')[1]?.[0] === 'she said "hi"');
check('csv: a newline inside quotes does not end the row', parseDelimited('a,b\n"one\ntwo",three\n', ',').length === 2);

{
  // Spanish-locale Excel writes semicolons because the comma is the decimal separator. Guessing
  // wrong here collapses every row into a single field and nothing errors.
  const res = extractDelimited(Buffer.from('Alimento;Proteína;Grasa\nPollo;32,5;3,6\n', 'utf8'));
  check('csv: semicolon delimiter is sniffed', res.ok && res.text.includes('Proteína: 32,5'), res.ok ? res.text : res.reason);
}
{
  const res = extractDelimited(Buffer.from('Food,Protein,Carbs\nOats,13,68\nEgg whites,11,1\n', 'utf8'));
  // Header-per-value, not a bare grid: a chunk boundary that cuts the header off would otherwise
  // leave a column of numbers meaning nothing.
  check('csv: values carry their header', res.ok && res.text.includes('Protein: 13'), res.ok ? res.text : res.reason);
}

// --- plain text -------------------------------------------------------------

{
  const res = extractPlainText(Buffer.from('\uFEFFRule one.\n\n\n\nRule two.', 'utf8'));
  check('text: BOM stripped and blank runs collapsed', res.ok && res.text === 'Rule one.\n\nRule two.', res.ok ? JSON.stringify(res.text) : res.reason);
}

// --- xlsx -------------------------------------------------------------------

{
  const sheet = `<?xml version="1.0"?><worksheet><sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
    <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>174</v></c></row>
  </sheetData></worksheet>`;
  const shared = `<?xml version="1.0"?><sst><si><t>Client</t></si><si><t>Protein</t></si><si><t>Shelise &amp; co</t></si></sst>`;
  const wb = `<?xml version="1.0"?><workbook><sheets><sheet name="Macros" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const res = extractXlsx(zip([
    { name: 'xl/workbook.xml', body: wb },
    { name: 'xl/sharedStrings.xml', body: shared },
    { name: 'xl/worksheets/sheet1.xml', body: sheet },
  ]));
  check('xlsx: shared strings resolve', res.ok && res.text.includes('Shelise & co'), res.ok ? res.text : res.reason);
  check('xlsx: numeric cells read', res.ok && res.text.includes('Protein: 174'), res.ok ? res.text : res.reason);
  check('xlsx: sheet name kept', res.ok && res.text.startsWith('Macros'), res.ok ? res.text.slice(0, 40) : res.reason);
}
check('xlsx: a non-zip is refused, not guessed at', extractXlsx(Buffer.from('not a zip at all, just text')).ok === false);

// --- docx -------------------------------------------------------------------

{
  const doc = `<?xml version="1.0"?><w:document><w:body>
    <w:p><w:r><w:t>NON-NEGOTIABLE RULES</w:t></w:r></w:p>
    <w:p><w:r><w:t>Weigh oats</w:t></w:r><w:tab/><w:r><w:t>UNCOOKED</w:t></w:r></w:p>
    <w:p><w:r><w:t>Season &amp; enjoy</w:t></w:r></w:p>
  </w:body></w:document>`;
  const res = extractDocx(zip([{ name: 'word/document.xml', body: doc }]));
  check('docx: paragraphs become lines', res.ok && res.text.split('\n').length >= 3, res.ok ? JSON.stringify(res.text) : res.reason);
  check('docx: entities decoded', res.ok && res.text.includes('Season & enjoy'), res.ok ? res.text : res.reason);
  check('docx: runs inside a paragraph stay on one line', res.ok && /Weigh oats\tUNCOOKED/.test(res.text), res.ok ? JSON.stringify(res.text) : res.reason);
}

// --- kind detection ---------------------------------------------------------

const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
check('detect: png by magic', detectKind('shot.png', pngBytes)?.kind === 'image');
// .xlsx and .docx are byte-identical ZIP archives, so only the name separates them.
check('detect: xlsx by extension', detectKind('macros.xlsx', Buffer.from([0x50, 0x4b, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0]))?.kind === 'sheet');
check('detect: docx by extension', detectKind('protocol.docx', Buffer.from([0x50, 0x4b, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0]))?.kind === 'doc');
// A screenshot saved as "page.pdf" would otherwise be reported as an unreadable PDF rather than
// just being read as the image it is.
check('detect: magic bytes beat a wrong extension', detectKind('page.pdf', pngBytes)?.kind === 'image');
check('detect: unknown type refused', detectKind('archive.7z', Buffer.from('7z\xBC\xAF\x27\x1C0000')) === null);

check('title: filename becomes a readable title', titleFromFilename('C:\\Users\\x\\2-week_anti-inflammatory-plan.pdf') === '2 week anti inflammatory plan');

// --- pdf, against her real documents ----------------------------------------

const REAL_PDFS = [
  // Her own protocol, a Canva export with subset CID fonts. This is the document the whole feature
  // exists for.
  { path: '.capture/plans/shayna-anti-inflammatory.pdf', must: ['NON-NEGOTIABLE', 'UNCOOKED'] },
  // A Lenus-generated meal plan, a completely different producer.
  { path: '.planning/Mealplan1.pdf', must: ['calorie intake', 'Protein'] },
];

for (const { path, must } of REAL_PDFS) {
  if (!existsSync(path)) {
    // Not a failure: these live in the working tree, and the assertion is about the reader, not
    // about which files a given checkout happens to carry. Saying so is better than a silent skip.
    failures.push(`SKIPPED (fixture absent): ${path}`);
    continue;
  }
  const res = await extractPdf(readFileSync(path));
  check(`pdf: ${path} reads`, res.ok, res.ok ? '' : res.reason);
  if (res.ok) {
    for (const needle of must) {
      check(`pdf: ${path} contains "${needle}"`, res.text.includes(needle));
    }
  }
}

// The scanned case: a STRUCTURALLY VALID PDF with a page and no text on it. It has to be valid,
// because "malformed file" and "photo saved as a PDF" need different answers from us and a broken
// stub only proves the first. She gets told to drop screenshots of the pages instead, which goes
// down the vision path and works.
{
  const res = await extractPdf(emptyPagePdf());
  check('pdf: a valid page with no text reports scanned', !res.ok && res.reason === 'scanned', res.ok ? 'read text' : res.reason);
}
check('pdf: a non-pdf is refused', (await extractPdf(Buffer.from('hello world'))).ok === false);

// --- report -----------------------------------------------------------------

console.log(`\ndocument extraction: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  FAIL  ${f}`);
  process.exit(1);
}
console.log('PASS');
