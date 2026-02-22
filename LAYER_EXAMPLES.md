# Layer System Examples

## Example 1: Navigation Item with Frame

This example shows how to add a frame overlay to a navigation item (category):

```json
{
  "id": "item_1",
  "name": "Power Modules",
  "icon": "item_1",
  "description": "Compact energy systems providing reliable power for various applications",
  "layers": [
    {
      "texture": "item_1",
      "depth": 2
    },
    {
      "texture": "nav_frame",
      "depth": 3,
      "alpha": 0.9
    }
  ],
  "subItems": [ /* ... */ ]
}
```

**What this does:**
- Renders `item_1.png` as the base image at depth 2
- Overlays `nav_frame.png` on top at depth 3 with 90% opacity
- The frame PNG should contain transparent regions to allow the base image to show through

**Required assets:**
- `/public/assets/items/item_1.png` - Base category icon
- `/public/assets/items/nav_frame.png` - Reusable frame overlay

---

## Example 2: All Navigation Items Using Same Frame

Apply a consistent frame to all 6 categories:

```json
{
  "items": [
    {
      "id": "item_1",
      "name": "Power Modules",
      "icon": "item_1",
      "layers": [
        { "texture": "item_1", "depth": 2 },
        { "texture": "nav_frame", "depth": 3 }
      ],
      "subItems": [ /* ... */ ]
    },
    {
      "id": "item_2",
      "name": "Metallic Alloys",
      "icon": "item_2",
      "layers": [
        { "texture": "item_2", "depth": 2 },
        { "texture": "nav_frame", "depth": 3 }
      ],
      "subItems": [ /* ... */ ]
    },
    {
      "id": "item_3",
      "name": "Synthetic Lubricants",
      "icon": "item_3",
      "layers": [
        { "texture": "item_3", "depth": 2 },
        { "texture": "nav_frame", "depth": 3 }
      ],
      "subItems": [ /* ... */ ]
    }
    /* ...continue for item_4, item_5, item_6 */
  ]
}
```

**Benefits:**
- Single `nav_frame.png` asset reused across all categories
- Consistent visual language for navigable items
- Easy to update frame style by replacing one file

---

## Example 3: Category-Specific Frames

Use different colored frames for different categories:

```json
{
  "id": "item_1",
  "name": "Power Modules",
  "layers": [
    { "texture": "item_1", "depth": 2 },
    { "texture": "frame_energy", "depth": 3, "tint": 0xffaa00 }
  ]
},
{
  "id": "item_2",
  "name": "Metallic Alloys",
  "layers": [
    { "texture": "item_2", "depth": 2 },
    { "texture": "frame_metal", "depth": 3, "tint": 0xaaaaaa }
  ]
}
```

**Features:**
- Different frame designs per category type
- Optional tinting for color variation
- Helps players quickly identify category types

---

## Example 4: Multi-Layer Effect with Background + Icon + Frame

Three-layer composition for rich visual effects:

```json
{
  "id": "item_1",
  "name": "Power Modules",
  "layers": [
    {
      "texture": "bg_gradient",
      "depth": 1,
      "alpha": 0.5
    },
    {
      "texture": "item_1_icon",
      "depth": 2,
      "scale": 0.9
    },
    {
      "texture": "nav_frame_ornate",
      "depth": 3
    }
  ]
}
```

**Result:**
- Soft gradient background
- Centered icon slightly smaller than frame
- Ornate frame on top

---

## Example 5: Selectable Item with Badge Overlay

Add a rarity or status indicator to selectable items:

```json
{
  "id": "item_1_1",
  "name": "Plasma Cell",
  "icon": "item_1_1",
  "cost": 12,
  "layers": [
    {
      "texture": "item_1_1",
      "depth": 2
    },
    {
      "texture": "badge_rare",
      "depth": 4,
      "scale": 0.4,
      "alpha": 0.8
    }
  ]
}
```

**Use cases:**
- Rarity indicators (common, rare, epic, legendary)
- "New" badges for recently unlocked items
- Status icons (locked, unlocked, favorite)
- Quality indicators

---

## Example 6: Animated Glow Effect

Create a pulsing glow effect using alpha:

```json
{
  "id": "item_1_1",
  "name": "Plasma Cell",
  "layers": [
    {
      "texture": "item_1_1",
      "depth": 2
    },
    {
      "texture": "glow_ring",
      "depth": 1,
      "tint": 0x4aa3ff,
      "alpha": 0.6
    }
  ]
}
```

**Note:** This creates a static glow. For animation, you could:
- Update alpha values in game code based on time
- Use Phaser tweens to animate layer properties
- Implement in RadialDial.ts update() method

---

## Layer Property Reference

### ImageLayer Interface

```typescript
interface ImageLayer {
  texture: string;   // Texture name (loaded from assets/items/{texture}.png)
  depth?: number;    // Z-index (higher = on top), default: 2 + index
  tint?: number;     // Color tint (0xRRGGBB format), default: no tint
  alpha?: number;    // Opacity (0.0 = invisible, 1.0 = opaque), default: 1.0
  scale?: number;    // Size multiplier (1.0 = normal), default: 1.0
}
```

### Property Details

**texture** (required)
- File must exist at `/public/assets/items/{texture}.png`
- Case-sensitive
- No file extension in JSON (automatically adds .png)

**depth** (optional)
- Default: `2 + layer_index`
- Lower values render behind, higher values render in front
- Slice graphics: 0, Center graphics: 10
- Recommended range: 1-9 for item layers

**tint** (optional)
- Hex color value: `0xRRGGBB`
- Example: `0xff0000` = red, `0x00ff00` = green, `0x0000ff` = blue
- Multiplies with original image colors
- White/transparent areas less affected

**alpha** (optional)
- Range: 0.0 (fully transparent) to 1.0 (fully opaque)
- Useful for subtle overlays
- Example: `0.5` = 50% transparent

**scale** (optional)
- Relative to the base scale (1.4 for categories, 1.2 for items)
- `1.0` = normal size (matches base scale)
- `0.5` = half size, `1.5` = 150% size
- Applied multiplicatively with base scale

---

## Asset Creation Tips

### Frame PNGs
- Use transparent backgrounds
- Leave center area transparent for base icon visibility
- Common sizes: 128x128, 256x256
- Design with padding to account for scaling

### Layering Strategy
1. **Background layer** (depth 1): Fills, gradients, auras
2. **Main icon** (depth 2): Primary item imagery
3. **Overlay layer** (depth 3): Frames, borders, highlights
4. **Badge layer** (depth 4-5): Status indicators, rarity

### Performance Considerations
- Keep total layers to 2-3 per item for best performance
- Reuse frame/badge assets across multiple items
- Use 256x256 or smaller for web deployment
- Optimize PNGs (compress, reduce colors where possible)

---

## Migration from Single-Icon System

**Before (single icon):**
```json
{
  "id": "item_1",
  "name": "Power Modules",
  "icon": "item_1",
  "subItems": []
}
```

**After (with frame layer):**
```json
{
  "id": "item_1",
  "name": "Power Modules",
  "icon": "item_1",
  "layers": [
    { "texture": "item_1", "depth": 2 },
    { "texture": "nav_frame", "depth": 3 }
  ],
  "subItems": []
}
```

**Backward compatibility:**
- Items without `layers` property still work (uses `icon` field)
- Can migrate gradually, category by category
- Old and new systems coexist

---

## Testing Your Layers

1. **Add layers to items.json** following examples above
2. **Create PNG assets** in `/public/assets/items/`
3. **Launch game** and navigate to radial dial
4. **Check browser console** for missing texture warnings
5. **Adjust depth values** if layers appear in wrong order
6. **Tune alpha/scale** for desired visual effect

---

## Common Issues

**Layers not appearing:**
- Check texture name matches PNG filename exactly (case-sensitive)
- Verify PNG exists in `/public/assets/items/`
- Check browser console for loading errors

**Wrong layering order:**
- Increase depth value for layer that should be on top
- Ensure depth values are different (same depth = unpredictable order)
- Remember: higher depth = rendered on top

**Frame looks wrong:**
- Check if PNG has transparent background
- Verify frame is centered in source image
- Adjust scale property if frame is too large/small

**Performance issues:**
- Reduce number of layers (aim for 2-3 max)
- Compress PNG files
- Reuse frame assets across items
