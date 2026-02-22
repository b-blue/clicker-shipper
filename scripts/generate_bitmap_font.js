#!/usr/bin/env node

/**
 * Generates a bitmap font atlas and .fnt definition file from individual PNG glyphs
 * Letters: public/assets/letters/1_01.png (A) through 1_26.png (Z), then 1_27.png (a) through 1_52.png (z)
 * Numbers: public/assets/numbers/1_27.png (0) through 1_36.png (9)
 * Output: public/assets/fonts/clicker.png + clicker.fnt
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const GLYPH_SIZE = 14;
const ATLAS_COLS = 16; // 16 chars per row for neat layout
const OUTPUT_DIR = path.join(__dirname, '../public/assets/fonts');
const OUTPUT_NAME = 'clicker';

// Character mappings
const LETTERS_DIR = path.join(__dirname, '../public/assets/letters');
const NUMBERS_DIR = path.join(__dirname, '../public/assets/numbers');

// Mapping: file index -> character
const charMap = {};

// Uppercase A-Z: 1_01.png to 1_26.png
for (let i = 0; i < 26; i++) {
  charMap[`1_${String(i + 1).padStart(2, '0')}.png`] = String.fromCharCode(65 + i); // A=65
}

// Lowercase a-z: 1_27.png to 1_52.png (but we only have 1_01-1_26 in letters, so lowercase must be different)
// Actually, based on 26 files in letters dir, let me assume:
// 1_01 to 1_26 = A-Z
// Let's check if there are more files or if lowercase is separate

// Numbers 0-9: 1_27.png to 1_36.png in numbers dir
const numberFiles = [
  '1_27.png', '1_28.png', '1_29.png', '1_30.png', '1_31.png',
  '1_32.png', '1_33.png', '1_34.png', '1_35.png', '1_36.png'
];
numberFiles.forEach((file, i) => {
  charMap[file] = String.fromCharCode(48 + i); // 0=48
});

// Build glyph list
const glyphs = [];

// Add space character first (empty 14x14 transparent glyph)
glyphs.push({
  char: ' ',
  charCode: 32,
  file: null, // We'll handle this specially
  isEmpty: true
});

// Process letters (uppercase only for now, assuming 1_01-1_26 = A-Z)
const letterFiles = fs.readdirSync(LETTERS_DIR).filter(f => f.endsWith('.png')).sort();
letterFiles.forEach(file => {
  const char = charMap[file];
  if (char) {
    glyphs.push({
      char,
      charCode: char.charCodeAt(0),
      file: path.join(LETTERS_DIR, file)
    });
  }
});

// Process numbers
const numberFilesActual = fs.readdirSync(NUMBERS_DIR).filter(f => f.endsWith('.png')).sort();
numberFilesActual.forEach(file => {
  const char = charMap[file];
  if (char) {
    glyphs.push({
      char,
      charCode: char.charCodeAt(0),
      file: path.join(NUMBERS_DIR, file)
    });
  }
});

// Sort by char code for consistent atlas layout
glyphs.sort((a, b) => a.charCode - b.charCode);

console.log(`Found ${glyphs.length} glyphs to pack (including space)`);

async function generateAtlas() {
  // Calculate atlas dimensions
  const numGlyphs = glyphs.length;
  const rows = Math.ceil(numGlyphs / ATLAS_COLS);
  const atlasWidth = ATLAS_COLS * GLYPH_SIZE;
  const atlasHeight = rows * GLYPH_SIZE;

  console.log(`Creating atlas: ${atlasWidth}x${atlasHeight} (${ATLAS_COLS} cols, ${rows} rows)`);

  // Create canvas
  const canvas = createCanvas(atlasWidth, atlasHeight);
  const ctx = canvas.getContext('2d');

  // Fill with transparent background
  ctx.clearRect(0, 0, atlasWidth, atlasHeight);

  // Place glyphs and track their positions for XML generation
  const glyphData = [];
  for (let i = 0; i < glyphs.length; i++) {
    const glyph = glyphs[i];
    const col = i % ATLAS_COLS;
    const row = Math.floor(i / ATLAS_COLS);
    const x = col * GLYPH_SIZE;
    const y = row * GLYPH_SIZE;

    // Handle space character (empty glyph)
    if (glyph.isEmpty) {
      // Leave it transparent/empty, just track position
      glyphData.push({ glyph, x, y });
      console.log(`  Packed ' ' (32) at (${x}, ${y}) [space]`);
      continue;
    }

    // Load and draw glyph
    const img = await loadImage(glyph.file);
    ctx.drawImage(img, x, y, GLYPH_SIZE, GLYPH_SIZE);
    
    // Get image data to convert white background to transparent and invert glyphs to white
    const imageData = ctx.getImageData(x, y, GLYPH_SIZE, GLYPH_SIZE);
    const data = imageData.data;
    
    // Convert light/white pixels to transparent, convert dark pixels (glyphs) to white
    for (let j = 0; j < data.length; j += 4) {
      const r = data[j];
      const g = data[j + 1];
      const b = data[j + 2];
      
      // Calculate brightness (0-255)
      const brightness = (r + g + b) / 3;
      
      // If pixel is light (white/near-white background), make it transparent
      // If pixel is dark (black glyph), invert it to white
      if (brightness > 200) {
        // Light pixel - make transparent
        data[j + 3] = 0; // Set alpha to 0 (fully transparent)
      } else {
        // Dark pixel (glyph) - invert to white
        data[j] = 255;
        data[j + 1] = 255;
        data[j + 2] = 255;
        // Keep original alpha
      }
    }
    
    // Put the modified image data back
    ctx.putImageData(imageData, x, y);

    glyphData.push({ glyph, x, y });
    console.log(`  Packed '${glyph.char}' (${glyph.charCode}) at (${x}, ${y})`);
  }

  // Write atlas PNG
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  const atlasPath = path.join(OUTPUT_DIR, `${OUTPUT_NAME}.png`);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(atlasPath, buffer);
  console.log(`\n✓ Atlas written to: ${atlasPath}`);

  // Write .fnt file in XML format (Phaser-compatible)
  const fntPath = path.join(OUTPUT_DIR, `${OUTPUT_NAME}.fnt`);
  const xmlLines = [];
  xmlLines.push('<?xml version="1.0"?>');
  xmlLines.push('<font>');
  xmlLines.push(`  <info face="Clicker" size="${GLYPH_SIZE}" bold="0" italic="0" charset="" unicode="1" stretchH="100" smooth="0" aa="1" padding="0,0,0,0" spacing="0,0" outline="0"/>`);
  xmlLines.push(`  <common lineHeight="${GLYPH_SIZE}" base="${GLYPH_SIZE}" scaleW="${atlasWidth}" scaleH="${atlasHeight}" pages="1" packed="0"/>`);
  xmlLines.push('  <pages>');
  xmlLines.push(`    <page id="0" file="${OUTPUT_NAME}.png"/>`);
  xmlLines.push('  </pages>');
  xmlLines.push(`  <chars count="${glyphs.length}">`);
  
  for (let i = 0; i < glyphData.length; i++) {
    const { glyph, x, y } = glyphData[i];
    xmlLines.push(`    <char id="${glyph.charCode}" x="${x}" y="${y}" width="${GLYPH_SIZE}" height="${GLYPH_SIZE}" xoffset="0" yoffset="0" xadvance="${GLYPH_SIZE}" page="0" chnl="15"/>`);
  }
  
  xmlLines.push('  </chars>');
  xmlLines.push('</font>');
  
  fs.writeFileSync(fntPath, xmlLines.join('\n'));
  console.log(`✓ Font definition written to: ${fntPath}`);

  console.log(`\n✓ Bitmap font generation complete!`);
  console.log(`  Characters: ${glyphs.map(g => g.char).join('')}`);
}

generateAtlas().catch(err => {
  console.error('Error generating atlas:', err);
  process.exit(1);
});
