// Compares two PNG screenshots pixel by pixel: node pngdiff.cjs a.png b.png [diff.png]. Prints how many pixels differ
// (and by more than T/255 in any channel, T=16 by default), and writes a diff image marking them in red.
const fs = require('fs'), zlib = require('zlib');
function read(f) {
  const b = fs.readFileSync(f); let p = 8, w, h, bpp, idat = [];
  while (p < b.length) { const len = b.readUInt32BE(p), type = b.toString('latin1', p + 4, p + 8), d = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bpp = {2: 3, 6: 4}[d[9]]; if (d[8] !== 8 || !bpp || d[12]) throw 'unsupported'; }
    if (type === 'IDAT') idat.push(d); p += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), out = Buffer.alloc(w * h * 4), stride = w * bpp; let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)], line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let x = 0; x < stride; x++) { const a = x >= bpp ? line[x - bpp] : 0, up = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      line[x] = (line[x] + [0, a, up, (a + up) >> 1, (() => { const q = a + up - c, pa = Math.abs(q - a), pb = Math.abs(q - up), pc = Math.abs(q - c); return pa <= pb && pa <= pc ? a : pb <= pc ? up : c; })()][f]) & 255; }
    for (let x = 0; x < w; x++) { for (let k = 0; k < 3; k++) out[(y * w + x) * 4 + k] = line[x * bpp + k]; out[(y * w + x) * 4 + 3] = 255; }
    prev = line; }
  return {w, h, px: out};
}
function write(f, {w, h, px}) {
  const raw = Buffer.alloc(h * (w * 4 + 1)); for (let y = 0; y < h; y++) px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const crc = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return b => { let c = ~0; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (~c) >>> 0; }; })();
  const chunk = (type, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(type, 'latin1'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  fs.writeFileSync(f, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
const [a, b] = [read(process.argv[2]), read(process.argv[3])];
if (a.w !== b.w || a.h !== b.h) { console.log('size differs', a.w, a.h, b.w, b.h); process.exit(1); }
let any = 0, big = 0, max = 0; const d = {w: a.w, h: a.h, px: Buffer.from(a.px)};
for (let i = 0; i < a.px.length; i += 4) { const m = Math.max(...[0, 1, 2].map(k => Math.abs(a.px[i + k] - b.px[i + k])));
  if (m) any++; if (m > 16) { big++; d.px[i] = 255; d.px[i + 1] = 0; d.px[i + 2] = 0; } max = Math.max(max, m); }
console.log(`${any} pixels differ, ${big} by more than ${process.env.T || 16}, max ${max}`);
if (process.argv[4]) write(process.argv[4], d);
process.exit(big ? 1 : 0);
