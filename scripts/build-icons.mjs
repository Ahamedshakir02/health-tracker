/**
 * Generates the raster icon set from the brand mark.
 *
 * ffmpeg has no SVG decoder and there is no image library in this project, so
 * the shapes are rasterised directly and the PNG/ICO containers are written by
 * hand. That sounds worse than it is — the mark is a rounded square and one
 * round-capped heartbeat line, exactly the geometry of public/favicon.svg — and
 * it keeps the icon set reproducible with zero dependencies.
 *
 *   node scripts/build-icons.mjs
 *
 * favicon.svg stays the source of truth for modern browsers; these are the
 * fallbacks (Safari's touch icon, the .ico for older tab strips, and the
 * manifest icons for an installed PWA).
 */

import { deflateSync, crc32 as zlibCrc32 } from 'node:zlib';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const PLATE = [0x1e, 0x4d, 0x2b]; // --hero, the forest plate the mark sits on
const MARK = [0xf4, 0xa5, 0x2a]; // --accent, the saffron pulse struck on it

/**
 * The pulse, in favicon.svg's 64×64 space: a flat trace, a small blip, then
 * the deep dip and tall spike that make the V of Vitals. Keep these points in
 * step with the polyline in favicon.svg.
 */
const PULSE = [
  [9, 33],
  [19, 33],
  [23, 26],
  [31, 47],
  [41, 15],
  [45, 33],
  [55, 33],
];
const PULSE_WIDTH = 5.5;
const TILE_RADIUS = 15;

/** 4× supersampling in each axis: plenty for flat shapes, and cheap. */
const SS = 4;

/* --- geometry ------------------------------------------------------------- */

/** Rounded-square tile filling the 64×64 box. */
function inTile(x, y) {
  const r = TILE_RADIUS;
  const cx = Math.min(Math.max(x, r), 64 - r);
  const cy = Math.min(Math.max(y, r), 64 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/** Squared distance from (x, y) to the segment a–b. */
function segDist2(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2;
}

/**
 * A stroke with round caps and joins is every point within half the width of
 * any segment, which is exactly what stroke-linecap/linejoin="round" draw.
 */
function inPulse(x, y, width) {
  const r2 = (width / 2) ** 2;
  for (let i = 1; i < PULSE.length; i++) {
    if (segDist2(x, y, PULSE[i - 1], PULSE[i]) <= r2) return true;
  }
  return false;
}

/** Renders the mark at `size`, returning raw RGBA. */
function renderIcon(size, { width = PULSE_WIDTH } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const scale = 64 / size;

  for (let py = 0; py < size; py++) {
    for (let pxi = 0; pxi < size; pxi++) {
      let tileHits = 0;
      let markHits = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (pxi + (sx + 0.5) / SS) * scale;
          const y = (py + (sy + 0.5) / SS) * scale;
          if (!inTile(x, y)) continue;
          tileHits++;
          if (inPulse(x, y, width)) markHits++;
        }
      }

      if (tileHits === 0) continue;
      const i = (py * size + pxi) * 4;

      // Composite the pulse over the plate, then apply tile coverage as the
      // alpha so the rounded corners stay smooth.
      const mix = markHits / tileHits;
      for (let c = 0; c < 3; c++) {
        px[i + c] = Math.round(PLATE[c] * (1 - mix) + MARK[c] * mix);
      }
      px[i + 3] = Math.round((tileHits / (SS * SS)) * 255);
    }
  }
  return px;
}

/* --- PNG ------------------------------------------------------------------ */

const crc32 = (buf) => zlibCrc32(buf) >>> 0;

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  // One filter byte (0 = None) per scanline.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* --- ICO ------------------------------------------------------------------ */

/** ICO wrapping PNG payloads — supported everywhere that matters since Vista. */
function encodeIco(entries) {
  const dir = Buffer.alloc(6 + entries.length * 16);
  dir.writeUInt16LE(0, 0); // reserved
  dir.writeUInt16LE(1, 2); // 1 = icon
  dir.writeUInt16LE(entries.length, 4);

  let offset = dir.length;
  entries.forEach(({ size, png }, i) => {
    const at = 6 + i * 16;
    dir[at] = size >= 256 ? 0 : size; // 0 means 256
    dir[at + 1] = size >= 256 ? 0 : size;
    dir[at + 2] = 0; // palette size
    dir[at + 3] = 0; // reserved
    dir.writeUInt16LE(1, at + 4); // colour planes
    dir.writeUInt16LE(32, at + 6); // bits per pixel
    dir.writeUInt32BE(0, at + 8);
    dir.writeUInt32LE(png.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });

  return Buffer.concat([dir, ...entries.map((e) => e.png)]);
}

/* --- main ----------------------------------------------------------------- */

const png = (size, opts) => encodePng(renderIcon(size, opts), size);

await mkdir(OUT, { recursive: true });

const written = [];
for (const [name, size] of [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]) {
  const buf = png(size);
  await writeFile(join(OUT, name), buf);
  written.push(`${name} (${size}px, ${(buf.length / 1024).toFixed(1)} KB)`);
}

// Small sizes get a heavier line so the pulse doesn't thin to a hairline at
// 16px in a tab strip.
const ico = encodeIco([
  { size: 16, png: png(16, { width: 7.5 }) },
  { size: 32, png: png(32, { width: 6.5 }) },
  { size: 48, png: png(48, { width: 6 }) },
]);
await writeFile(join(OUT, 'favicon.ico'), ico);
written.push(`favicon.ico (16/32/48px, ${(ico.length / 1024).toFixed(1)} KB)`);

console.log(written.map((w) => `  ${w}`).join('\n'));
