# Bitmap Font Implementation

## Overview
Implemented a custom bitmap font system using individual PNG glyphs (14×14 pixels) to replace all UI text with a distinctive retro aesthetic.

## Assets Generated
- **Source Glyphs**: Individual PNGs in `/public/assets/letters` (A-Z) and `/public/assets/numbers` (0-9)
- **Atlas Output**: `/public/assets/fonts/clicker.png` (224×42, 36 characters)
- **Font Definition**: `/public/assets/fonts/clicker.fnt` (BMFont format)

## Character Set
- **Uppercase**: A-Z (26 characters)
- **Numbers**: 0-9 (10 characters)
- **Total**: 36 glyphs packed into 3 rows × 16 columns

## Build Script
Run `npm run generate-font` to regenerate the bitmap font atlas from source glyphs.

Script: `/scripts/generate_bitmap_font.js`
- Uses `canvas` package for image manipulation
- Generates BMFont-compatible `.fnt` file
- Packs glyphs in ASCII order for consistent lookup

## Implementation Details

### Preloader
```typescript
this.load.bitmapFont('clicker', 'assets/fonts/clicker.png', 'assets/fonts/clicker.fnt');
```

### Usage Pattern
```typescript
// Before (web font):
this.add.text(x, y, 'Hello World', { fontSize: '18px', color: '#ffd54a' });

// After (bitmap font):
this.add.bitmapText(x, y, 'clicker', 'HELLO WORLD', 18)
  .setOrigin(0.5)
  .setTint(0xffd54a);
```

### Text Replacement Summary
- **ItemManual.ts**: 5 text objects → bitmapText (title, close button, labels)
- **Game.ts**: 4 text objects → bitmapText (HUD, catalog button, instructions)
- **MainMenu.ts**: 5 text objects → bitmapText (title, subtitle, footer, button labels)
- **Settings.ts**: 11 text objects → bitmapText (labels, values, buttons)
- **GameOver.ts**: 1 text object → bitmapText
- **RadialDial.ts**: 3 fallback text objects → bitmapText (slice labels, badges)

### Styling Notes
- All text converted to **UPPERCASE** (bitmap font only contains uppercase letters)
- Colors applied via `.setTint()` instead of style config
- Font size is direct pixel value (not CSS 'px' string)
- Word wrapping replaced with `.setMaxWidth()` for catalog text

## Testing
- Updated all test mocks to include `bitmapText` factory
- Changed test expectations to match new function signatures
- All 110 tests passing ✅

## Build Verification
- Production build: ✅ Successful
- Font assets deployed: ✅ `dist/assets/fonts/clicker.{png,fnt}`
- Asset sizes: 722 bytes (atlas) + 3.3KB (definition)

## Future Enhancements
- Add lowercase letters (if needed for mixed-case text)
- Add punctuation glyphs (period, comma, apostrophe, etc.)
- Implement custom kerning pairs for better spacing
- Generate multiple font sizes/styles (bold, small, etc.)
