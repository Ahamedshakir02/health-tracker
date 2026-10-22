/**
 * Generates the raster icon set from the brand mark.
 *
 * ffmpeg has no SVG decoder and there is no image library in this project, so
 * the shapes are rasterised directly and the PNG/ICO containers are written by
 * hand. That sounds worse than it is: the mark is a rounded square, a heart
 * outline of two arcs and two curves, and a heartbeat trace of straight
 * segments cut out of it. The heart and trace below are copied from
 * public/favicon.svg, in its 64×64 space, so the PNGs match it exactly. The
 * script still needs no dependencies, so the icon set is easy to rebuild.
 *
 *   node scripts/build-icons.mjs
 *
 * favicon.svg stays the source of truth for modern browsers; these are the
 * fallbacks (Safari's touch icon, the .ico for older tab strips, and the
 * manifest icons for an installed PWA). Change the mark there first, then
 * mirror it here.
 */

import { deflateSync, crc32 as zlibCrc32 } from 'node:zlib';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const PLATE = [0x1e, 0x4d, 0x2b]; // --hero, the forest plate the mark sits on
const MARK = [0xf4, 0xa5, 0x2a]; // --accent, the saffron heart struck on it

/** 4× supersampling in each axis: plenty for flat shapes, and cheap. */
const SS = 4;

/* --- geometry (favicon.svg's 64×64 space) --------------------------------- */

/** Rounded-square tile, in 0..1 space with the given corner radius. */
function inTile(x, y, r) {
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function cubic(p0, p1, p2, p3, steps = 48) {
  const pts = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const m = 1 - t;
    pts.push([
      m ** 3 * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t ** 3 * p3[0],
      m ** 3 * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t ** 3 * p3[1],
    ]);
  }
  return pts;
}

/** SVG arc with large-arc 0 and sweep 1 (clockwise on screen), as points. */
function arc(p0, p1, r, steps = 48) {
  const mx = (p0[0] + p1[0]) / 2;
  const my = (p0[1] + p1[1]) / 2;
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const half = Math.hypot(dx, dy) / 2;
  const h = Math.sqrt(Math.max(0, r * r - half * half));
  const nx = -dy / (2 * half);
  const ny = dx / (2 * half);
  // Of the two possible centres, sweep 1 + small arc is the one where the
  // angle grows from p0 to p1 by less than half a turn.
  for (const s of [1, -1]) {
    const cx = mx + s * h * nx;
    const cy = my + s * h * ny;
    const a0 = Math.atan2(p0[1] - cy, p0[0] - cx);
    let da = Math.atan2(p1[1] - cy, p1[0] - cx) - a0;
    while (da <= 0) da += 2 * Math.PI;
    if (da <= Math.PI) {
      const pts = [];
      for (let i = 1; i <= steps; i++) {
        const a = a0 + (da * i) / steps;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      return pts;
    }
  }
  throw new Error('arc has no centre');
}

/**
 * The heart from favicon.svg:
 *   M32 51.2 c-2.67-1.87-21.33-14.4-21.33-29.33 A12 12 0 0 1 32 14.4
 *   a12 12 0 0 1 21.33 7.47 C53.33 36.8 34.67 49.33 32 51.2z
 */
const HEART = (() => {
  const tip = [32, 51.2];
  const left = [10.67, 21.87];
  const top = [32, 14.4];
  const right = [53.33, 21.87];
  return [
    tip,
    ...cubic(tip, [29.33, 49.33], [10.67, 36.8], left),
    ...arc(left, top, 12),
    ...arc(top, right, 12),
    ...cubic(right, [53.33, 36.8], [34.67, 49.33], tip),
  ];
})();

/** Centre the mark is scaled about for the small .ico sizes. */
const CENTRE = [32, 32.8];

function inHeart(x, y) {
  let inside = false;
  for (let i = 0, j = HEART.length - 1; i < HEART.length; j = i++) {
    const [xi, yi] = HEART[i];
    const [xj, yj] = HEART[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * The heartbeat trace from favicon.svg: flat, a small bump, a dip, the tall
 * spike, back to flat. Both ends stop inside the heart so the knockout never
 * breaks the outline.
 */
const PULSE = [
  [17.6, 28.7],
  [21.9, 28.7],
  [25.6, 21.6],
  [30.4, 36.7],
  [35.7, 19.5],
  [39.7, 28.7],
  [46.4, 28.7],
];

function distToSegment(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

function inPulse(x, y, halfWidth) {
  for (let i = 1; i < PULSE.length; i++) {
    if (distToSegment(x, y, PULSE[i - 1], PULSE[i]) <= halfWidth) return true;
  }
  return false;
}

/**
 * Renders the mark at `size`, returning raw RGBA. `scale` enlarges the heart
 * within the tile, and `pulse` is the trace's half-width in 64-unit space
 * (favicon.svg's stroke-width 4.2 is 2.1).
 */
function renderIcon(size, { radius = 15 / 64, scale = 1, pulse = 2.1 } = {}) {
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
          // Into the favicon's 64-unit space, undoing any scale-up.
          const x = CENTRE[0] + (u * 64 - CENTRE[0]) / scale;
          const y = CENTRE[1] + (v * 64 - CENTRE[1]) / scale;
          if (inHeart(x, y) && !inPulse(x, y, pulse)) heartHits++;
        }
      }

      const total = SS * SS;
      const alpha = tileHits / total;
      const heart = heartHits / total;
      const i = (py * size + pxi) * 4;

      if (alpha === 0) continue;

      // Composite the saffron heart over the plate, then apply tile coverage
      // as the alpha so the rounded corners stay smooth.
      const mix = heart / alpha;
      for (let c = 0; c < 3; c++) {
        px[i + c] = Math.round(PLATE[c] * (1 - mix) + MARK[c] * mix);
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

// Small sizes get a slightly larger heart so it doesn't shrink to mush
// at 16px in a tab strip, and a slightly bolder trace so it stays a line.
const ico = encodeIco([
  { size: 16, png: png(16, { scale: 1.12, pulse: 2.6 }) },
  { size: 32, png: png(32, { scale: 1.06, pulse: 2.3 }) },
  { size: 48, png: png(48, { scale: 1.03 }) },
]);
await writeFile(join(OUT, 'favicon.ico'), ico);
written.push(`favicon.ico (16/32/48px, ${(ico.length / 1024).toFixed(1)} KB)`);

console.log(written.map((w) => `  ${w}`).join('\n'));
