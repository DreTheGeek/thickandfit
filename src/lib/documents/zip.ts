// A minimal ZIP reader, because .xlsx and .docx are both ZIP archives of XML and nothing else in
// this codebase needed a ZIP until now.
//
// WHY NOT A LIBRARY. The dependency list here is deliberately short (24 runtime packages), and the
// two office formats need exactly one capability: pull a named entry out of an archive and inflate
// it. That is this file. Adding a spreadsheet library to read one XML file inside a zip is a bad
// trade on a codebase this lean.
//
// WHY THE CENTRAL DIRECTORY AND NOT SEQUENTIAL LOCAL HEADERS. Walking local file headers is shorter
// but silently wrong on archives written with a streaming writer: bit 3 of the general-purpose flag
// means the compressed size in the local header is ZERO and the real size lives in a trailing data
// descriptor. Excel does not do that, but plenty of exporters do, and the failure mode is reading
// garbage rather than erroring. The central directory always carries the true sizes.

import { inflateRawSync } from 'node:zlib';

const EOCD_SIG = 0x06054b50;
const CD_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;
const ZIP64_SENTINEL = 0xffffffff;

export type ZipReadResult =
  | { ok: true; entries: Map<string, Buffer> }
  | { ok: false; reason: 'notZip' | 'zip64' | 'corrupt' };

export function readZip(buf: Buffer): ZipReadResult {
  // The end-of-central-directory record sits at the very end unless there is an archive comment,
  // which is capped at 65535 bytes. Scan backwards over that window rather than assuming offset -22.
  const minEocd = 22;
  if (buf.length < minEocd) return { ok: false, reason: 'notZip' };
  let eocd = -1;
  const floor = Math.max(0, buf.length - minEocd - 0xffff);
  for (let i = buf.length - minEocd; i >= floor; i -= 1) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return { ok: false, reason: 'notZip' };

  const count = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  // Anything needing ZIP64 is far outside the size we accept for an upload, so refuse it by name
  // instead of reading a sentinel value as a real offset.
  if (cdOffset === ZIP64_SENTINEL || count === 0xffff) return { ok: false, reason: 'zip64' };

  const entries = new Map<string, Buffer>();
  let p = cdOffset;
  try {
    for (let n = 0; n < count; n += 1) {
      if (buf.readUInt32LE(p) !== CD_SIG) return { ok: false, reason: 'corrupt' };
      const method = buf.readUInt16LE(p + 10);
      const compressedSize = buf.readUInt32LE(p + 20);
      const nameLen = buf.readUInt16LE(p + 28);
      const extraLen = buf.readUInt16LE(p + 30);
      const commentLen = buf.readUInt16LE(p + 32);
      const localOffset = buf.readUInt32LE(p + 42);
      const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
      p += 46 + nameLen + extraLen + commentLen;

      if (compressedSize === ZIP64_SENTINEL || localOffset === ZIP64_SENTINEL) {
        return { ok: false, reason: 'zip64' };
      }
      // The local header repeats the name and extra fields, and its extra field length routinely
      // DIFFERS from the central one, so the data offset has to be computed from the local header.
      if (buf.readUInt32LE(localOffset) !== LOCAL_SIG) return { ok: false, reason: 'corrupt' };
      const lNameLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const raw = buf.subarray(start, start + compressedSize);

      if (method === 0) entries.set(name, Buffer.from(raw));
      else if (method === 8) entries.set(name, inflateRawSync(raw));
      // Any other method (bzip2, lzma) is not something Office writes; skip rather than fail the
      // whole archive, since the entry we want is almost certainly stored or deflated.
    }
  } catch {
    return { ok: false, reason: 'corrupt' };
  }

  return { ok: true, entries };
}
