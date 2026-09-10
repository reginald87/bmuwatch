// Generates simple solid-color PNG app icons for the PWA.
// Creates icon-192.png and icon-512.png with a centered shield glyph.
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Build raw image rows with a filter byte 0.
  const rowLength = size * 4;
  const raw = Buffer.alloc((rowLength + 1) * size);
  const [r, g, b, a] = rgba;

  const inShield = (px, py) => {
    const cx = size / 2;
    // Normalized y in [0,1]
    const ny = py / size;
    if (ny < 0.16 || ny > 0.86) return false;
    // Half-width at top, tapering to a point at the bottom.
    const topHalf = size * 0.34;
    const bottomY = size * 0.80;
    const pointY = size * 0.86;
    let half;
    if (py <= bottomY) {
      half = topHalf; // straight sides on the upper body
    } else {
      const t = (py - bottomY) / (pointY - bottomY);
      half = topHalf * (1 - t);
    }
    return Math.abs(px - cx) <= half;
  };

  // A small white check mark drawn as two thick diagonal bars within the shield.
  const inCheck = (px, py) => {
    const cx = size / 2;
    const cy = size * 0.50;
    const s = size / 512;
    // Check mark drawn as two thick diagonal bars within the shield.
    const seg = (x1, y1, x2, y2, thick) => {
      const vx = x2 - x1, vy = y2 - y1;
      const len = Math.hypot(vx, vy);
      const t = ((px - x1) * vx + (py - y1) * vy) / (len * len);
      if (t < 0 || t > 1) return false;
      const projX = x1 + t * vx, projY = y1 + t * vy;
      return Math.hypot(px - projX, py - projY) <= thick / 2;
    };
    return seg(cx - 66 * s, cy - 14 * s, cx - 22 * s, cy + 42 * s, 30 * s) ||
           seg(cx - 22 * s, cy + 42 * s, cx + 66 * s, cy - 46 * s, 30 * s);
  };

  for (let y = 0; y < size; y++) {
    const rowStart = y * (rowLength + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      const o = rowStart + 1 + x * 4;
      if (inCheck(x, y)) {
        raw[o] = 255; raw[o + 1] = 255; raw[o + 2] = 255; raw[o + 3] = 255;
      } else if (inShield(x, y)) {
        raw[o] = 255; raw[o + 1] = 255; raw[o + 2] = 255; raw[o + 3] = 255;
      } else {
        raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
      }
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

// Deep purple background with white shield.
const purple = [77, 26, 166, 255];
const outDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "icon-192.png"), makePng(192, purple));
fs.writeFileSync(path.join(outDir, "icon-512.png"), makePng(512, purple));
// Maskable icons with full-bleed background color.
fs.writeFileSync(path.join(outDir, "maskable-192.png"), makePng(192, purple));
fs.writeFileSync(path.join(outDir, "maskable-512.png"), makePng(512, purple));
console.log("Icons written to", outDir);
