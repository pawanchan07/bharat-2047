#!/usr/bin/env node
/**
 * Shrink the large one-off PNGs that are shipped to browsers.
 *
 * `compress-images.mjs` handles the sprite sheets under public/assets. This handles the
 * rest: social cards and touch icons, which were being served at multi-megabyte sizes.
 * Re-running it is safe: each target is skipped once it is already under budget.
 */

import sharp from 'sharp';
import { readFile, stat, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

/**
 * Recompress a PNG in place, capping its longest edge. Converges: the result is only
 * written when it is at least a fifth smaller, so re-running settles instead of
 * re-quantising the same image over and over.
 */
async function shrink(relPath, { maxEdge, quality = 82 }) {
  const file = path.join(ROOT, relPath);
  if (!existsSync(file)) return console.log(`  skip (missing) ${relPath}`);

  const before = (await stat(file)).size;
  // Read into memory first: sharp keeps a handle on a file path, which blocks the
  // in-place write on Windows.
  const out = await sharp(await readFile(file))
    .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
    .png({ quality, compressionLevel: 9, palette: true })
    .toBuffer();

  if (out.length > before * 0.8) return console.log(`  ok     ${relPath}: ${kb(before)}`);
  await writeFile(file, out);
  console.log(`  shrank ${relPath}: ${kb(before)} → ${kb(out.length)}`);
}

/** The touch icon browsers fetch for a bookmark: the tricolour, at the size iOS wants. */
async function writeTouchIcon() {
  const spokes = Array.from({ length: 24 }, (_, i) => {
    const a = ((i * 360) / 24 - 90) * (Math.PI / 180);
    return `<line x1="90" y1="90" x2="${(90 + 46 * Math.cos(a)).toFixed(2)}" y2="${(90 + 46 * Math.sin(a)).toFixed(2)}" stroke="#000088" stroke-width="2.4"/>`;
  }).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
    <rect width="180" height="180" fill="#0b1020"/>
    <rect x="10" y="30" width="160" height="40" fill="#FF9933"/>
    <rect x="10" y="70" width="160" height="40" fill="#FFFFFF"/>
    <rect x="10" y="110" width="160" height="40" fill="#138808"/>
    <g fill="none" stroke="#000088">${spokes}<circle cx="90" cy="90" r="46" stroke-width="4"/></g>
    <circle cx="90" cy="90" r="8" fill="#000088"/>
  </svg>`;

  const file = path.join(ROOT, 'public', 'apple-touch-icon.png');
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(file);
  const size = (await stat(file)).size;
  console.log(`  wrote  public/apple-touch-icon.png: ${kb(size)}`);
}

console.log('Optimising static images…');
await shrink('public/og-image.png', { maxEdge: 1200 });
await shrink('src/app/opengraph-image.png', { maxEdge: 900 });
await shrink('src/app/coaster/opengraph-image.png', { maxEdge: 1200 });
await writeTouchIcon();
console.log('Done.');
