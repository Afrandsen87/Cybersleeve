// Generates the PNG icons required for PWA installability on Android.
// Usage: node scripts/generate-icons.mjs   (outputs into ./public)
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const BG = [11, 15, 26];
const CYAN = [25, 227, 255];
const MAGENTA = [255, 43, 214];

function crc32(buf) {
  let c,
    crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Draws the icon: dark background, cyan square frame, magenta diagonal. `inset` shrinks art for maskable icons. */
function pixel(x, y, size, inset) {
  const u = (x / size - 0.5) / inset; // -0.5..0.5 scaled
  const v = (y / size - 0.5) / inset;
  const half = 0.31,
    thick = 0.047;
  const inFrame = Math.max(Math.abs(u), Math.abs(v)) <= half && Math.max(Math.abs(u), Math.abs(v)) >= half - thick;
  const d = Math.abs(u + v) / Math.SQRT2; // distance to anti-diagonal (u + v = 0)
  const inSlash = d < 0.03 && Math.abs(u - v) < 0.45;
  if (inSlash) return MAGENTA;
  if (inFrame) return CYAN;
  return BG;
}

function png(size, inset) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y, size, inset);
      row[1 + x * 3] = r;
      row[2 + x * 3] = g;
      row[3 + x * 3] = b;
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync('public/icon-192.png', png(192, 1));
writeFileSync('public/icon-512.png', png(512, 1));
writeFileSync('public/icon-512-maskable.png', png(512, 0.8)); // art within the maskable safe zone
console.log('Icons written to public/');
