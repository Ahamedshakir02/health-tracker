/**
 * Generates the raster icon set from the brand mark.
 *
 * ffmpeg has no SVG decoder and there is no image library in this project, so
 * the shapes are rasterised directly and the PNG/ICO containers are written by
 * hand. That sounds worse than it is — the mark is a rounded square and a heart
 * built from two circles and a triangle, which is exactly the geometry of the
 * path in src/components/icons.tsx — and it keeps the icon set reproducible
 * with zero dependencies.
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

const ACCENT = [0x2a, 0x78, 0xd6]; // --accent, light theme
const WHITE = [0xff, 0xff, 0xff];

/** 4× supersampling in each axis: plenty for flat shapes, and cheap. */
const SS = 4;

/* --- geometry ------------------------------------------------------------- */

/** Rounded-square tile, in 0..1 space with the given corner radius. */
function inTile(x, y, r) {
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/**
 * Heart: two lobes and a point, in a -1..1 box. The same construction as the
 * icon path — two arcs meeting at the top dimple, falling to a point at the
 * bottom — rather than the (x²+y²−1)³ = x²y³ curve, which is rounder and would
 * not match the app's mark.
 */
function inHeart(x, y) {
  const lobeR = 0.5;
  const lobeY = -0.35; // y grows downward
  if ((x + 0.5) ** 2 + (y - lobeY) ** 2 <= lobeR * lobeR) return true;
  if ((x - 0.5) ** 2 + (y - lobeY) ** 2 <= lobeR * lobeR) return true;
  // Triangle from the lobes' widest point down to the tip. The taper has to
  // start at the lobe edges (±1 at y = lobeY) or the shoulders stick out past
  // the curves and it stops reading as a heart.
  if (y < lobeY) return false;
  const tipY = 0.98;
  const halfWidth = (tipY - y) / (tipY - lobeY);
  return y <= tipY && Math.abs(x) <= halfWidth;
}

/** Renders the mark at `size`, returning raw RGBA. */
function renderIcon(size, { radius = 0.234, inset = 0.17 } = {}) {
  const px = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py++) {
    for (let pxi = 0; pxi < size; pxi++) {
      let tileHits = 0;
      let heartHits = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (pxi + (sx + 0.5) / SS) / size;
          const v = (py + (sy + 0.5) / SS) / size;
          if (!inTile(u, v, radius)) continue;
          tileHits++;
          // Map the tile interior onto the heart's -1..1 box.
          const hx = (u - 0.5) / (0.5 - inset);
          const hy = (v - 0.5) / (0.5 - inset);
          if (inHeart(hx, hy)) heartHits++;
        }
      }

      const total = SS * SS;
      const alpha = tileHits / total;
      const heart = heartHits / total;
      const i = (py * size + pxi) * 4;

      if (alpha === 0) continue;

      // Composite white heart over the accent tile, then apply tile coverage
      // as the alpha so the rounded corners stay smooth.
      const mix = heart / alpha;
      for (let c = 0; c < 3; c++) {
        px[i + c] = Math.round(ACCENT[c] * (1 - mix) + WHITE[c] * mix);
      }
      px[i + 3] = Math.round(alpha * 255);
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

// Small sizes get a slightly tighter inset so the heart doesn't shrink to mush
// at 16px in a tab strip.
const ico = encodeIco([
  { size: 16, png: png(16, { inset: 0.13 }) },
  { size: 32, png: png(32, { inset: 0.15 }) },
  { size: 48, png: png(48, { inset: 0.16 }) },
]);
await writeFile(join(OUT, 'favicon.ico'), ico);
written.push(`favicon.ico (16/32/48px, ${(ico.length / 1024).toFixed(1)} KB)`);

console.log(written.map((w) => `  ${w}`).join('\n'));
