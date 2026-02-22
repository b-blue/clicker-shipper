# Asset Pipeline Documentation

## Overview

This document describes how to add items to the radial dial system in Clicker-Shipper. Items are divided into two types:
1. **Navigation Items** (Categories) - Top-level items with sub-items that open a new dial
2. **Selectable Items** (Sub-items) - Final items that can be added to orders

## Current System Architecture

### File Structure
```
public/
  assets/
    items/
      item_1.png          # Navigation item (category)
      item_1_1.png        # Selectable item
      item_1_2.png        # Selectable item
      item_2.png          # Navigation item (category)
      item_2_1.png        # Selectable item
      ...
  data/
    items.json            # Item definitions and metadata
```

### Naming Convention

**Navigation Items (Categories):**
- Format: `item_X.png` where X is the category number (1-6)
- Examples: `item_1.png`, `item_2.png`, `item_3.png`

**Selectable Items (Sub-items):**
- Format: `item_X_Y.png` where X is the category and Y is the item number
- Examples: `item_1_1.png`, `item_1_2.png`, `item_2_1.png`

**Differentiation:**
- Navigation items have a single underscore: `item_1`
- Selectable items have two underscores: `item_1_1`
- This pattern is used in both filenames and item IDs in items.json

## How to Add New Items

### Step 1: Prepare Your Assets

**For Navigation Items:**
1. Create a PNG image (recommended: 128x128px or higher)
2. Name it following the pattern: `item_X.png`
3. Place it in `public/assets/items/`

**For Selectable Items:**
1. Create a PNG image (recommended: 128x128px or higher)
2. Name it following the pattern: `item_X_Y.png`
3. Place it in `public/assets/items/`

**Image Guidelines:**
- Use square dimensions for best results
- Transparent backgrounds work well against the dial slices
- Higher resolution assets (256x256) will look better on high-DPI displays
- Keep file sizes reasonable (< 100KB per image)

### Step 2: Update items.json

Add or update entries in `/public/data/items.json`:

**Adding a New Category (Navigation Item):**
```json
{
  "id": "item_7",
  "name": "New Category",
  "icon": "item_7",
  "description": "Description of this category",
  "subItems": [
    {
      "id": "item_7_1",
      "name": "First Item",
      "icon": "item_7_1",
      "cost": 15,
      "description": "Description of first item"
    }
  ]
}
```

**Adding a Sub-item to Existing Category:**
```json
{
  "id": "item_7_2",
  "name": "Second Item",
  "icon": "item_7_2",
  "cost": 20,
  "description": "Description of second item"
}
```

### Step 3: Automatic Loading

Assets are automatically loaded by `AssetLoader.ts`:
- During the Boot scene, `AssetLoader.preloadItemAssets()` reads items.json
- For each item, it loads the corresponding PNG from `assets/items/{id}.png`
- No additional code changes needed if you follow the naming convention

## Data Structure Reference

### Item Interface (Navigation Items)
```typescript
interface Item {
  id: string;           // Must match PNG filename (e.g., "item_1")
  name: string;         // Display name shown in UI
  icon: string;         // Should match id (used for loading asset)
  description?: string; // Optional category description
  subItems: SubItem[];  // Array of selectable items
}
```

### SubItem Interface (Selectable Items)
```typescript
interface SubItem {
  id: string;           // Must match PNG filename (e.g., "item_1_1")
  name: string;         // Display name shown in UI
  icon: string;         // Should match id (used for loading asset)
  cost: number;         // Item cost for orders
  description?: string; // Optional item description
}
```

## Rendering Details

### Display Scaling
- **Level 0 (Categories):** Images scaled to 1.4x
- **Level 1 (Sub-items):** Images scaled to 1.2x
- **Center Preview:** Images scaled to 1.2x

### Z-Depth
- Slice graphics: depth 0
- Slice text fallbacks: depth 0
- Item images: depth 2
- Badge indicators: depth 5
- Center preview: depth 1

### Fallback Behavior
If an asset is missing:
- The system falls back to text rendering
- Uses item name as text
- No error is thrown
- Check browser console for missing texture warnings

## Layered Images (Multi-Layer Assets)

**Yes, it's possible to display multiple PNG files layered on top of each other.**

### Current Single-Layer Rendering
```typescript
const image = this.scene.add.image(x, y, itemId);
image.setScale(1.4);
image.setDepth(2);
```

### Proposed Multi-Layer Approach

#### Option 1: Suffix-Based Layers
Use filename suffixes to indicate layers:
- `item_1_base.png` - Base layer (depth 2)
- `item_1_overlay.png` - Overlay layer (depth 3)
- `item_1_highlight.png` - Highlight layer (depth 4)

#### Option 2: JSON Layer Definitions
Extend the item definition with layer information:
```json
{
  "id": "item_1_1",
  "name": "Plasma Cell",
  "icon": "item_1_1",
  "cost": 12,
  "layers": [
    { "texture": "item_1_1_base", "depth": 2 },
    { "texture": "item_1_1_overlay", "depth": 3, "tint": 0xff0000 }
  ]
}
```

#### Option 3: Composite Sprite Approach
Create a container with multiple sprites:
```typescript
const container = this.scene.add.container(x, y);
const baseImage = this.scene.add.image(0, 0, `${itemId}_base`);
const overlayImage = this.scene.add.image(0, 0, `${itemId}_overlay`);
container.add([baseImage, overlayImage]);
container.setScale(1.4);
```

### Use Cases for Layered Images
- **Base + Badge:** Show rarity or status indicators
- **Background + Icon:** Consistent backgrounds with varied icons
- **Item + Glow:** Dynamic visual effects for selected/hovered items
- **Frame + Content:** Reusable frames with different content
- **Animation Layers:** Separate static and animated elements

## Common Tasks

### Checking if Asset Loaded
```typescript
if (this.scene.textures.exists(itemId)) {
  // Asset available
} else {
  // Use fallback
}
```

### Debugging Missing Assets
1. Open browser console (F12)
2. Look for warnings like: `Texture Missing: item_3_4`
3. Check filename in `public/assets/items/`
4. Verify ID matches in items.json

### Changing Icon Scale
Edit in `RadialDial.ts` around line 413:
```typescript
image.setScale(this.currentLevel === 0 ? 1.4 : 1.2);
```

## Future Enhancements

Potential improvements to the asset system:
- [ ] Support for animated sprites (sprite sheets)
- [ ] Dynamic tinting based on item state
- [ ] SVG support for scalable icons
- [ ] Asset preloading progress indicator
- [ ] Hot-reloading during development
- [ ] Multi-layer compositing system
- [ ] Asset validation tool (check for missing files)
- [ ] Bulk asset renaming/migration scripts

## Technical Implementation Details

### Asset Loading (Boot.ts → AssetLoader.ts)
```typescript
// Boot scene preload
const itemsData = await fetch('data/items.json').then(r => r.json());
AssetLoader.preloadItemAssets(this, itemsData.items);

// AssetLoader implementation
items.forEach((category) => {
  scene.load.image(category.id, `assets/items/${category.id}.png`);
  category.subItems.forEach((subItem) => {
    scene.load.image(subItem.id, `assets/items/${subItem.id}.png`);
  });
});
```

### Rendering (RadialDial.ts)
```typescript
if (this.scene.textures.exists(itemId)) {
  const image = this.scene.add.image(x, y, itemId);
  image.setScale(this.currentLevel === 0 ? 1.4 : 1.2);
  image.setDepth(2);
  this.sliceImages.push(image);
}
```

## Related Files

- `/src/game/managers/AssetLoader.ts` - Asset loading logic
- `/src/game/ui/RadialDial.ts` - Asset rendering (lines 390-450)
- `/src/game/types/GameTypes.ts` - Item type definitions
- `/src/game/scenes/Boot.ts` - Asset preloading initialization
- `/public/data/items.json` - Item metadata and configuration

## Questions or Issues?

- Check the browser console for missing texture warnings
- Verify file naming matches the convention exactly (case-sensitive)
- Ensure PNG files are valid and not corrupted
- Test with a simple test asset before adding multiple items
