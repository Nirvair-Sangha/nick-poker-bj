/**
 * Generates the PWA icon PNGs with no image dependencies.
 * Run with: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'public', 'icons');

const FELT = [11, 61, 46];
const FELT_EDGE = [7, 42, 32];
const CARD = [251, 251, 248];
const SPADE = [23, 24, 26];
const GOLD = [232, 197, 106];

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter type: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function inTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

/** Spade in normalised card space where x and y both run -1..1 (y down). */
function inSpade(x, y) {
  if (inTriangle(x, y, 0, -1, -0.86, 0.16, 0.86, 0.16)) return true;
  if ((x + 0.44) ** 2 + (y - 0.16) ** 2 <= 0.44 ** 2) return true;
  if ((x - 0.44) ** 2 + (y - 0.16) ** 2 <= 0.44 ** 2) return true;
  // Stem: a trapezoid widening towards the bottom.
  if (y >= 0.3 && y <= 0.92) {
    const t = (y - 0.3) / 0.62;
    const halfWidth = 0.08 + 0.3 * t * t;
    if (Math.abs(x) <= halfWidth) return true;
  }
  return false;
}

function inRoundedRect(x, y, halfW, halfH, radius) {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  if (ax > halfW || ay > halfH) return false;
  const cx = halfW - radius;
  const cy = halfH - radius;
  if (ax <= cx || ay <= cy) return true;
  return (ax - cx) ** 2 + (ay - cy) ** 2 <= radius * radius;
}

function blend(target, offset, colour, alpha) {
  for (let c = 0; c < 3; c += 1) {
    target[offset + c] = Math.round(target[offset + c] * (1 - alpha) + colour[c] * alpha);
  }
  target[offset + 3] = 255;
}

/**
 * `inset` shrinks the artwork so a maskable icon survives Android/iOS cropping.
 * Supersampled 3x for smooth edges.
 */
function renderIcon(size, { inset = 1, rounded = true } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const samples = 3;
  const cardHalfW = 0.34 * inset;
  const cardHalfH = 0.46 * inset;
  const cardRadius = 0.07 * inset;
  const outerRadius = 0.3;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let bgHits = 0;
      let cardHits = 0;
      let spadeHits = 0;
      let ringHits = 0;

      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const nx = ((x + (sx + 0.5) / samples) / size) * 2 - 1;
          const ny = ((y + (sy + 0.5) / samples) / size) * 2 - 1;

          const insideBg = rounded ? inRoundedRect(nx, ny, 1, 1, outerRadius) : true;
          if (insideBg) bgHits += 1;

          const r = Math.hypot(nx, ny);
          if (insideBg && r > 0.80 * inset && r < 0.86 * inset) ringHits += 1;

          if (inRoundedRect(nx, ny, cardHalfW, cardHalfH, cardRadius)) {
            cardHits += 1;
            const sxn = nx / (cardHalfW * 0.78);
            const syn = (ny + 0.02) / (cardHalfH * 0.72);
            if (inSpade(sxn, syn)) spadeHits += 1;
          }
        }
      }

      const total = samples * samples;
      const offset = (y * size + x) * 4;
      if (bgHits === 0) continue;

      const edge = Math.hypot((x / size) * 2 - 1, (y / size) * 2 - 1);
      const base = edge > 0.7 ? FELT_EDGE : FELT;
      blend(rgba, offset, base, bgHits / total);
      if (ringHits > 0) blend(rgba, offset, GOLD, (ringHits / total) * 0.8);
      if (cardHits > 0) blend(rgba, offset, CARD, cardHits / total);
      if (spadeHits > 0) blend(rgba, offset, SPADE, spadeHits / total);
    }
  }

  return encodePng(size, size, rgba);
}

mkdirSync(outDir, { recursive: true });

const targets = [
  ['icon-192.png', 192, { inset: 1, rounded: true }],
  ['icon-512.png', 512, { inset: 1, rounded: true }],
  ['icon-maskable-512.png', 512, { inset: 0.72, rounded: false }],
  ['apple-touch-icon-180.png', 180, { inset: 1, rounded: false }],
];

for (const [name, size, options] of targets) {
  const png = renderIcon(size, options);
  writeFileSync(resolve(outDir, name), png);
  console.log(`wrote ${name} (${size}x${size}, ${png.length} bytes)`);
}
