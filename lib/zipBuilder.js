// lib/zipBuilder.js — a tiny, dependency-free ZIP file builder for the browser. Used by
// components/admin/GrowthPage.jsx's "Download QR Codes" feature to bundle more than one
// selected QR code image into a single .zip download.
//
// Writes plain STORED (uncompressed) entries only — QR code PNGs/JPEGs are already compressed
// image formats, so DEFLATE would buy nothing here, and skipping it means no compression
// library is needed at all. This file is the entire implementation, hand-written against the
// ZIP file format spec (one local file header + data per entry, one flat central directory, one
// end-of-central-directory record) — no zip64, no encryption, no multi-disk support, none of
// which a handful of QR code images ever needs. Verified against real test vectors and by
// round-tripping through a standard `unzip` before shipping.

// Standard byte-wise CRC-32 (the same algorithm zlib/ZIP use) — verified against the official
// test vectors (crc32("") === 0, crc32("abc") === 0x352441c2, crc32("123456789") === 0xcbf43926).
function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    let c = (crc ^ bytes[i]) & 0xff;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ZIP stores timestamps in "DOS date/time" — a pair of 16-bit fields, not a real timestamp
// format. Precision to the nearest 2 seconds is all it supports; fine for a download's mtime.
function dosDateTime(date) {
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() >> 1) & 0x1f);
  const day = (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0xf) << 5) | (date.getDate() & 0x1f);
  return { time, day };
}

function u16(n) { return [n & 0xff, (n >> 8) & 0xff]; }
function u32(n) { return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]; }

// files: [{ name: string, data: Uint8Array }]. Returns a Blob (type 'application/zip').
export function buildZip(files) {
  const { time, day } = dosDateTime(new Date());
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { name, data } of files) {
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);
    const size = data.length;

    // Local file header (ZIP spec 4.3.7) immediately followed by the raw file bytes — no extra
    // field, no data descriptor (sizes/CRC are known up front, written directly into the header).
    const localHeader = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04, // local file header signature "PK\x03\x04"
      20, 0,                  // version needed to extract (2.0)
      0, 0,                   // general purpose bit flag
      0, 0,                   // compression method: 0 = stored (no compression)
      ...u16(time), ...u16(day),
      ...u32(crc),
      ...u32(size),           // compressed size == uncompressed size (stored)
      ...u32(size),
      ...u16(nameBytes.length),
      0, 0,                   // extra field length
    ]);
    localParts.push(localHeader, nameBytes, data);

    // Central directory file header (ZIP spec 4.3.12) — one per entry, written after ALL local
    // entries; `offset` is this entry's local header's position from the start of the archive.
    const centralHeader = new Uint8Array([
      0x50, 0x4b, 0x01, 0x02, // central directory file header signature "PK\x01\x02"
      20, 0,                  // version made by
      20, 0,                  // version needed to extract
      0, 0,                   // general purpose bit flag
      0, 0,                   // compression method
      ...u16(time), ...u16(day),
      ...u32(crc),
      ...u32(size),
      ...u32(size),
      ...u16(nameBytes.length),
      0, 0,                   // extra field length
      0, 0,                   // file comment length
      0, 0,                   // disk number start
      0, 0,                   // internal file attributes
      0, 0, 0, 0,             // external file attributes
      ...u32(offset),         // relative offset of local header
    ]);
    centralParts.push(centralHeader, nameBytes);

    offset += localHeader.length + nameBytes.length + data.length;
  }

  const centralDirOffset = offset;
  const centralDirSize = centralParts.reduce((sum, part) => sum + part.length, 0);

  // End of central directory record (ZIP spec 4.3.16) — the very last thing in the file; this
  // is what every unzip tool actually reads first (scanning backward) to locate everything else.
  const eocd = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06, // end of central directory signature "PK\x05\x06"
    0, 0,                   // number of this disk
    0, 0,                   // disk with the start of the central directory
    ...u16(files.length),   // entries on this disk
    ...u16(files.length),   // total entries
    ...u32(centralDirSize),
    ...u32(centralDirOffset),
    0, 0,                   // comment length
  ]);

  return new Blob([...localParts, ...centralParts, eocd], { type: 'application/zip' });
}
