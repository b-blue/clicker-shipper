#!/usr/bin/env node
/**
 * Scans public/assets/ at build time and emits
 * src/game/generated/SpritesManifest.ts — a single authoritative source for
 * all sprite-sheet keys, idle-capable keys, explosion definitions, and atlas
 * names.
 *
 * Usage:  node scripts/generate_manifests.js
 *   or:   npm run gen-manifests
 *
 * The generated file is committed to source control so the TypeScript
 * compiler can validate imports without requiring a pre-build step during CI
 * type-checking.  Regenerate it whenever you drop new assets into the
 * public/assets/ folders.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT     = path.join(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'src/game/generated/SpritesManifest.ts');

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Read width and height from a PNG IHDR chunk (bytes 16-23). */
function pngHeight(filePath) {
  const buf = Buffer.alloc(24);
  const fd  = fs.openSync(filePath, 'r');
  fs.readSync(fd, buf, 0, 24, 0);
  fs.closeSync(fd);
  return buf.readUInt32BE(20);   // height at offset 20
}

/**
 * Convert a bare filename stem (no extension) into a lowercase slug.
 * e.g. "Attack_dust" → "attackdust",  "Walk2" → "walk2",  "BOOM" → "boom"
 */
function slugify(stem) {
  return stem.toLowerCase().replace(/_/g, '');
}

/** List numeric subdir names inside a directory, sorted numerically. */
function numericSubdirs(absDir) {
  return fs.readdirSync(absDir)
    .filter(name => /^\d+$/.test(name) && fs.statSync(path.join(absDir, name)).isDirectory())
    .sort((a, b) => Number(a) - Number(b));
}

// ── 1. Drone + Robot sprite strips ───────────────────────────────────────────

/**
 * Walk public/assets/{prefix}/<n>/<Anim>.png files.
 * Returns DRONE_FILE_MANIFEST entries and the subset with slug === 'idle'.
 */
function scanCharacters(prefix) {
  const baseDir  = path.join(ROOT, 'public/assets', prefix + 's');  // drones / robots
  const manifest = [];   // [key, path]
  const idleKeys = [];   // keys where anim is 'idle'

  for (const n of numericSubdirs(baseDir)) {
    const animDir = path.join(baseDir, n);
    const pngs = fs.readdirSync(animDir)
      .filter(f => f.endsWith('.png'))
      .sort();

    for (const f of pngs) {
      const slug = slugify(path.basename(f, '.png'));
      const key  = `${prefix}-${n}-${slug}`;
      const rel  = `assets/${prefix}s/${n}/${f}`;
      manifest.push([key, rel]);
      if (slug === 'idle') idleKeys.push(key);
    }
  }

  return { manifest, idleKeys };
}

const drones = scanCharacters('drone');
const robots = scanCharacters('robot');

const DRONE_FILE_MANIFEST = [...drones.manifest, ...robots.manifest];
const IDLE_KEYS           = [...drones.idleKeys, ...robots.idleKeys];

// ── 2. Explosion spritesheets ─────────────────────────────────────────────────

/**
 * Map explosion folder names to tier slugs.
 * Folder names follow the pattern "<order> <TierName>" — e.g. "1 Tiny".
 */
const TIER_MAP = {
  'Tiny':   'tiny',
  'Low':    'low',
  'Middle': 'mid',
  'High':   'high',
};

function tierSlug(folderName) {
  for (const [word, slug] of Object.entries(TIER_MAP)) {
    if (folderName.includes(word)) return slug;
  }
  return folderName.toLowerCase().replace(/\s+/g, '-');
}

const EXPLOSION_MANIFEST = [];   // [key, path, frameSize]

const expRoot = path.join(ROOT, 'public/assets/effects/explosions');
const tierDirs = fs.readdirSync(expRoot)
  .filter(n => fs.statSync(path.join(expRoot, n)).isDirectory())
  .sort();

for (const tierDir of tierDirs) {
  const slug     = tierSlug(tierDir);
  const tierPath = path.join(expRoot, tierDir);
  const pngs = fs.readdirSync(tierPath)
    .filter(f => /^\d+\.png$/.test(f))
    .sort((a, b) => Number(path.basename(a, '.png')) - Number(path.basename(b, '.png')));

  for (const f of pngs) {
    const variant   = path.basename(f, '.png');
    const key       = `explosion-${slug}-${variant}`;
    const rel       = `assets/effects/explosions/${tierDir}/${f}`;
    const frameSize = pngHeight(path.join(tierPath, f));
    EXPLOSION_MANIFEST.push([key, rel, frameSize]);
  }
}

// ── 3. Item atlas names ───────────────────────────────────────────────────────
// Only the nav atlas (UI icons) remains; old item atlases are removed.

const atlasDir   = path.join(ROOT, 'public/assets/atlases');
const ITEM_ATLASES = fs.existsSync(atlasDir)
  ? fs.readdirSync(atlasDir)
      .filter(f => f.endsWith('.json'))
      .map(f => path.basename(f, '.json'))
      .sort()
  : [];

// ── 4. Action-folder item images ──────────────────────────────────────────────
//
// For each action in rad-dial.json, strip "action_" to get the folder name
// (e.g. action_reorient → reorient) and scan public/assets/<folder>/ for PNGs.
// A hand-authored names.json alongside the PNGs provides display names and costs.
// The script both:
//   a) Emits ACTION_ITEMS_MANIFEST to SpritesManifest.ts (for Preloader loading)
//   b) Regenerates public/data/modes/<action>/items.json from the discovered PNGs

const radDialPath = path.join(ROOT, 'public/data/rad-dial.json');
const radDialRaw  = fs.existsSync(radDialPath)
  ? JSON.parse(fs.readFileSync(radDialPath, 'utf8'))
  : null;
const radDialActions = radDialRaw?.actions ?? [];

/** ACTION_ITEMS_MANIFEST: { actionId: [[iconKey, relPath], ...] } */
const ACTION_ITEMS_MANIFEST = {};

for (const action of radDialActions) {
  const actionId   = action.id;                        // e.g. 'action_reorient'
  const folderName = actionId.replace(/^action_/, ''); // e.g. 'reorient'
  const assetDir   = path.join(ROOT, 'public/assets', folderName);

  if (!fs.existsSync(assetDir)) continue;

  const pngs = fs.readdirSync(assetDir)
    .filter(f => f.toLowerCase().endsWith('.png'))
    .sort((a, b) => {
      // Numeric sort: reorient1.png < reorient2.png < reorient10.png
      const nA = parseInt(a.replace(/\D/g, ''), 10);
      const nB = parseInt(b.replace(/\D/g, ''), 10);
      return (!isNaN(nA) && !isNaN(nB)) ? nA - nB : a.localeCompare(b);
    });

  if (pngs.length === 0) continue;

  // Load hand-authored names/costs from names.json if present
  const namesPath = path.join(assetDir, 'names.json');
  const namesMap  = fs.existsSync(namesPath)
    ? JSON.parse(fs.readFileSync(namesPath, 'utf8'))
    : {};

  const entries = [];  // [[iconKey, relPath], ...]
  const items   = [];  // items.json content

  for (const png of pngs) {
    const iconKey = path.basename(png, '.png');
    const relPath = `assets/${folderName}/${png}`;
    entries.push([iconKey, relPath]);

    const meta = namesMap[iconKey] ?? {};
    items.push({
      id:   `item_${folderName}_${String(entries.length).padStart(3, '0')}`,
      name: meta.name ?? iconKey.toUpperCase().replace(/(\d+)/, ' $1').trim(),
      icon: iconKey,
      type: folderName,
      cost: meta.cost ?? 10,
    });
  }

  ACTION_ITEMS_MANIFEST[actionId] = entries;

  // Regenerate the data/modes/<action>/items.json
  const itemsJsonDir  = path.join(ROOT, 'public/data/modes', folderName);
  const itemsJsonPath = path.join(itemsJsonDir, 'items.json');
  fs.mkdirSync(itemsJsonDir, { recursive: true });
  fs.writeFileSync(itemsJsonPath, JSON.stringify(items, null, 2), 'utf8');
  console.log(`✓ Regenerated data/modes/${folderName}/items.json (${items.length} items)`);
}

// ── 5. Emit TypeScript ────────────────────────────────────────────────────────

function fmtStringPairs(rows, indent = '  ') {
  return rows
    .map(([k, p]) => `${indent}['${k}', '${p}'],`)
    .join('\n');
}

function fmtTriples(rows, indent = '  ') {
  return rows
    .map(([k, p, s]) => `${indent}['${k}', '${p}', ${s}],`)
    .join('\n');
}

function fmtActionManifest(manifest) {
  const entries = Object.entries(manifest);
  if (entries.length === 0) return '{}';
  const parts = entries.map(([actionId, pairs]) => {
    const pairLines = pairs.map(([k, p]) => `    ['${k}', '${p}'],`).join('\n');
    return `  '${actionId}': [\n${pairLines}\n  ],`;
  });
  return `{\n${parts.join('\n')}\n}`;
}

const ts = `\
// AUTO-GENERATED by scripts/generate_manifests.js — do not edit by hand.
// Run \`npm run gen-manifests\` to regenerate after adding or removing assets.

/**
 * Every drone and robot sprite strip, in load order.
 * Import into Preloader.ts and replace the local DRONE_FILE_MANIFEST.
 */
export const DRONE_FILE_MANIFEST: Array<[string, string]> = [
${fmtStringPairs(DRONE_FILE_MANIFEST)}
];

/**
 * Subset of DRONE_FILE_MANIFEST keys whose animation slug is "idle".
 * Used by DroneStage to pick a random idle-capable sprite.
 */
export const IDLE_KEYS: string[] = [
${IDLE_KEYS.map(k => `  '${k}',`).join('\n')}
];

/**
 * All explosion spritesheets: [textureKey, path, frameSize].
 * Frame size is the auto-detected PNG height (= square frame side in px).
 * Import into Preloader.ts and replace the local EXPLOSION_MANIFEST.
 */
export const EXPLOSION_MANIFEST: Array<[string, string, number]> = [
${fmtTriples(EXPLOSION_MANIFEST)}
];

/**
 * Atlas basenames present in public/assets/atlases/.
 * Only the nav atlas remains; old item-category atlases have been removed.
 */
export const ITEM_ATLASES: string[] = [
${ITEM_ATLASES.map(n => `  '${n}',`).join('\n')}
];

/**
 * Per-action item image files, keyed by action id.
 * Each entry is [iconKey, relativePath] for a standalone PNG under public/assets/<action>/.
 * Import into Preloader.ts to load all action-item images in one loop.
 */
export const ACTION_ITEMS_MANIFEST: Record<string, Array<[string, string]>> = ${fmtActionManifest(ACTION_ITEMS_MANIFEST)};
`;

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, ts, 'utf8');
console.log(`✓ SpritesManifest.ts written (${DRONE_FILE_MANIFEST.length} strips, ${IDLE_KEYS.length} idle keys, ${EXPLOSION_MANIFEST.length} explosions, ${ITEM_ATLASES.length} atlases, ${Object.keys(ACTION_ITEMS_MANIFEST).length} action folders)`);
