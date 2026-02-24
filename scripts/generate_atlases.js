#!/usr/bin/env node
/**
 * Generates sprite-atlas PNGs + Phaser-compatible JSON (hash format) from the
 * individual icon PNGs in public/assets/<category>/.
 *
 * Outputs one atlas per logical group to public/assets/atlases/.
 *
 * Uses the `canvas` dev-dependency (already installed) — no extra packages.
 *
 * Usage:  node scripts/generate_atlases.js
 *   or:   npm run generate-atlases
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const ROOT       = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'public/assets/atlases');

/** All atlas groups.  Each group becomes one .png + .json file. */
const GROUPS = [
  {
    name: 'armaments',
    sources: [{ dir: 'public/assets/armaments' }],
  },
  {
    name: 'melee',
    sources: [{ dir: 'public/assets/melee' }],
  },
  {
    name: 'mining',
    sources: [{ dir: 'public/assets/mining' }],
  },
  {
    name: 'radioactive',
    sources: [{ dir: 'public/assets/radioactive' }],
  },
  {
    name: 'resources',
    sources: [{ dir: 'public/assets/resources' }],
  },
  {
    name: 'streetwear',
    sources: [{ dir: 'public/assets/streetwear' }],
  },
  {
    // Navigation icons + the hash-sign bullet used in the UI
    name: 'nav',
    sources: [
      { dir: 'public/assets/nav-items' },
      { files: ['public/assets/punctuation/hash-sign.png'] },
    ],
  },
];

const SPRITE_SIZE = 32; // all sprites are 32×32
const COLS        = 8;  // sprites per row

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function buildAtlas(group) {
  // ── Collect file entries ──────────────────────────────────────────────────
  const entries = []; // { key, filePath }

  for (const source of group.sources) {
    if (source.dir) {
      const absDir = path.join(ROOT, source.dir);
      const pngs = fs.readdirSync(absDir)
        .filter(f => f.endsWith('.png'))
        .sort();
      for (const f of pngs) {
        entries.push({ key: path.basename(f, '.png'), filePath: path.join(absDir, f) });
      }
    }
    if (source.files) {
      for (const rel of source.files) {
        const absPath = path.join(ROOT, rel);
        entries.push({ key: path.basename(absPath, '.png'), filePath: absPath });
      }
    }
  }

  if (entries.length === 0) {
    console.warn(`  [${group.name}] No sprites found — skipping.`);
    return;
  }

  // ── Lay out atlas grid ────────────────────────────────────────────────────
  const rows        = Math.ceil(entries.length / COLS);
  const atlasWidth  = COLS * SPRITE_SIZE;
  const atlasHeight = rows * SPRITE_SIZE;

  const canvas = createCanvas(atlasWidth, atlasHeight);
  const ctx    = canvas.getContext('2d');

  const frames = {};

  for (let i = 0; i < entries.length; i++) {
    const { key, filePath } = entries[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x   = col * SPRITE_SIZE;
    const y   = row * SPRITE_SIZE;

    const img = await loadImage(filePath);
    ctx.drawImage(img, x, y, SPRITE_SIZE, SPRITE_SIZE);

    frames[key] = {
      frame:           { x, y, w: SPRITE_SIZE, h: SPRITE_SIZE },
      rotated:         false,
      trimmed:         false,
      spriteSourceSize:{ x: 0, y: 0, w: SPRITE_SIZE, h: SPRITE_SIZE },
      sourceSize:      { w: SPRITE_SIZE, h: SPRITE_SIZE },
    };
  }

  // ── Write PNG ─────────────────────────────────────────────────────────────
  const pngPath = path.join(OUTPUT_DIR, `${group.name}.png`);
  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(pngPath, buf);

  // ── Write JSON ────────────────────────────────────────────────────────────
  const jsonPath = path.join(OUTPUT_DIR, `${group.name}.json`);
  const atlas = {
    frames,
    meta: {
      image:  `${group.name}.png`,
      size:   { w: atlasWidth, h: atlasHeight },
      format: 'RGBA8888',
      scale:  '1',
    },
  };
  fs.writeFileSync(jsonPath, JSON.stringify(atlas, null, 2));

  console.log(`  [${group.name}] ${entries.length} sprites → ${atlasWidth}×${atlasHeight}  (${(buf.length / 1024).toFixed(1)} KB)`);
}

(async () => {
  console.log('Generating sprite atlases…');
  for (const group of GROUPS) {
    await buildAtlas(group);
  }
  console.log(`Done. Output: ${path.relative(ROOT, OUTPUT_DIR)}/`);
})().catch(err => {
  console.error('Atlas generation failed:', err);
  process.exit(1);
});
