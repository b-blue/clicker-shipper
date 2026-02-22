# Hierarchical Navigation System Architecture

## Overview

The current system supports 2-level navigation (top-level categories → sub-items). To support unlimited depth hierarchy with nav items at any level, we need to evolve the type system and navigation logic while maintaining backward compatibility and optimal rendering.

---

## Current System Analysis

### Type Structure
```typescript
Item {
  id: string
  subItems: SubItem[]        // Category contains 4 sub-items
  layers?: ImageLayer[]      // Optional frame layers
}

SubItem {
  id: string
  cost: number
  layers?: ImageLayer[]      // Optional badge layers
}
```

### Navigation Flow (Current)
```
Level 0: items[] array
  ↓ (select item)
Level 1: currentItem.subItems[] array
  ↓ (tap center to go back)
Level 0: items[] array
```

### Limitations
- Only 2 levels deep (categories → items)
- SubItem cannot have children
- No way to track navigation path for deeply nested items
- `currentLevel` is a simple number (0 or 1)

---

## Proposed Hierarchical System

### Key Requirements
1. **Unlimited depth**: Items at any level can have children
2. **Frame layers only on nav items**: Only items with children get frame overlays
3. **Single-item leafs**: Deeply nested items that are purchasable (no children)
4. **Navigation history**: Track full path (e.g., A1n→B2n→C5n→D3s)
5. **Back navigation**: Pop from history to go up one level
6. **Backward compatibility**: Existing items.json continues working

---

## Solution: Unified Item Type with Optional Children

### New Type Structure

```typescript
interface ImageLayer {
  texture: string;
  depth?: number;
  tint?: number;
  alpha?: number;
  scale?: number;
}

// UNIFIED TYPE - Replaces both Item and SubItem
interface MenuItem {
  id: string;
  name: string;
  icon: string;
  cost?: number;                    // Optional: only for shippable items
  description?: string;
  layers?: ImageLayer[];            // Frames for nav items, badges for shippable
  children?: MenuItem[];            // Optional: if undefined, it's a leaf (shippable)
}

interface ItemsData {
  items: MenuItem[];  // Top-level nav items
}

// Navigation state
interface NavigationState {
  path: string[];           // ['item_1', 'item_1_1', 'item_1_1_2']
  currentItems: MenuItem[]; // Items displayed on current dial face
}
```

### Migration Strategy

**Phase 1: Backward Compatibility** (No breaking changes)
- Keep existing `Item` and `SubItem` interfaces
- Create adapter function: `normalizeItems()`
- Converts legacy structure → `MenuItem[]` format
- Migration path: Optional flag in GameConfig to use new or legacy format

**Phase 2: Gradual Adoption**
- New items in items.json use `children` property
- Old items still work with `subItems`
- Adapter handles both formats transparently

**Phase 3: Full Migration** (When all items updated)
- Remove legacy `Item`/`SubItem` types
- Use only `MenuItem` throughout

---

## Updated Navigation Logic

### Current RadialDial State Management
```typescript
private currentLevel: number = 0;           // Level 0 or 1
private currentParentItem: Item | null;     // Parent at level 0
private currentSubItems: SubItem[] = [];    // Children at level 1
```

### New NavigationController Pattern

```typescript
class NavigationController {
  private navigationStack: MenuItem[][] = []; // Stack of breadcrumbs
  private currentItems: MenuItem[] = [];       // Items on current dial
  
  constructor(rootItems: MenuItem[]) {
    this.navigationStack.push(rootItems);
    this.currentItems = rootItems;
  }
  
  // Navigate to child items
  drillDown(parentItem: MenuItem): MenuItem[] {
    if (parentItem.children && parentItem.children.length > 0) {
      this.navigationStack.push(parentItem.children);
      this.currentItems = parentItem.children;
      return this.currentItems;
    }
    return []; // Prevent drilling into leaf items
  }
  
  // Go back up one level
  goBack(): MenuItem[] | null {
    if (this.navigationStack.length > 1) {
      this.navigationStack.pop();
      this.currentItems = this.navigationStack[this.navigationStack.length - 1];
      return this.currentItems;
    }
    return null; // Already at root, can't go back
  }
  
  // Get full path for logging/analytics
  getCurrentPath(): string[] {
    // Returns ['item_1', 'item_1_2', 'item_1_2_3'] etc.
  }
  
  // Check if item has children (is navigable)
  isNavigable(item: MenuItem): boolean {
    return item.children !== undefined && item.children.length > 0;
  }
  
  // Get depth level
  getDepth(): number {
    return this.navigationStack.length - 1;
  }
}
```

---

## Implementation Approach (No Code Changes Needed Yet)

### 1. Data Format Evolution in items.json

**Current Format** (Still supported):
```json
{
  "items": [
    {
      "id": "item_1",
      "name": "Power Modules",
      "icon": "item_1",
      "subItems": [
        {
          "id": "item_1_1",
          "name": "Plasma Cell",
          "icon": "item_1_1",
          "cost": 12
        }
      ]
    }
  ]
}
```

**Future Format** (Hierarchical):
```json
{
  "items": [
    {
      "id": "item_1",
      "name": "Power Modules",
      "icon": "item_1",
      "description": "...",
      "layers": [
        { "texture": "item_1", "depth": 2 },
        { "texture": "nav_frame", "depth": 3 }
      ],
      "children": [
        {
          "id": "item_1_1",
          "name": "Plasma Power",
          "icon": "item_1_1",
          "description": "...",
          "layers": [
            { "texture": "item_1_1", "depth": 2 },
            { "texture": "nav_frame", "depth": 3 }
          ],
          "children": [
            {
              "id": "item_1_1_1",
              "name": "Plasma Cell",
              "icon": "item_1_1_1",
              "cost": 12,
              "layers": [
                { "texture": "item_1_1_1", "depth": 2 }
              ]
            },
            {
              "id": "item_1_1_2",
              "name": "Plasma Cartridge",
              "icon": "item_1_1_2",
              "cost": 14
            }
          ]
        },
        {
          "id": "item_1_2",
          "name": "Antimatter Power",
          "icon": "item_1_2",
          "children": [ /* ... */ ]
        }
      ]
    }
  ]
}
```

### 2. Rendering Logic (Minor Adjustments Needed)

**Current:**
- Check `if (currentLevel === 0)` to determine scale/depth
- Use baseScale 1.4 (level 0) or 1.2 (level 1)

**Future:**
- Use `NavigationController.getDepth()` for scale calculation
- Scale inversely: deeper levels → smaller
  - Depth 0: 1.4x (categories)
  - Depth 1: 1.2x (sub-categories)
  - Depth 2: 1.0x (deep categories)
  - Depth N-1: 0.8x (final navigable level)
  - Leaf items: Same as parent level

**Frame Detection Logic:**
```typescript
// CURRENT (hardcoded for level 0)
if (this.currentLevel === 0 && 'subItems' in item && item.subItems.length > 0) {
  // Render frame
}

// FUTURE (works at any depth)
if (this.isNavigable(item)) {  // Has children?
  // Render frame layers
}
```

### 3. Item Selection Behavior

**Current:**
```
Level 0: Tap → Drill down (if category has subItems)
Level 1: Tap → Confirm (emit dial:itemConfirmed)
Center:  Tap → Go back (if level 1)
```

**Future:**
```
Any nav item (has children): Tap → Drill down
Leaf item (no children):     Tap → Confirm (emit dial:itemConfirmed)
Center:                      Tap → Go back (if depth > 0)
```

### 4. Order System Updates

**Current:**
- Collects all items from `getAllSubItems()`
- Only queries "purchasable" items (those at level 1)

**Future:**
```typescript
// Recursive collection of all leaf items
private getAllLeafItems(items: MenuItem[], collected: MenuItem[] = []): MenuItem[] {
  for (const item of items) {
    if (item.children && item.children.length > 0) {
      // Recursive: drill into navigation items
      this.getAllLeafItems(item.children, collected);
    } else if (item.cost !== undefined) {
      // Leaf item with cost = purchasable
      collected.push(item);
    }
  }
  return collected;
}
```

---

## Frame Layer Strategy by Depth

### Display Rules

| Depth | Item Type | Has layers? | Frame | Scale |
|-------|-----------|-----------|-------|-------|
| 0 | Category (has children) | ✓ Yes | nav_frame.png | 1.4x |
| 1 | Sub-category (has children) | ✓ Yes | nav_frame.png | 1.2x |
| 2+ | Deep category (has children) | ✓ Yes | nav_frame.png | 1.0x |
| Any | Shippable item (no children) | ✗ No | badge (optional) | scale per depth |

### Implementation Pattern

```typescript
// In items.json, only nav items (those with children) have frame layers
{
  "id": "item_1",
  "name": "Power Modules",
  "children": [ /* ... */ ],
  "layers": [
    { "texture": "item_1", "depth": 2 },
    { "texture": "nav_frame", "depth": 3 }
  ]
}

// Leaf items never have frames
{
  "id": "item_1_1_1",
  "name": "Plasma Cell",
  "cost": 12,
  "icon": "item_1_1_1"
  // No 'children' = it's a leaf
  // No 'layers' = no frame
}
```

---

## Asset Loading Considerations

### Current AssetLoader
```typescript
item.subItems.forEach(subItem => {
  scene.load.image(`item_${subItem.id}`, ...);
});
```

### Future AssetLoader (Recursive)

```typescript
private loadMenuItemsRecursive(items: MenuItem[]): void {
  for (const item of items) {
    // Load main texture
    this.scene.load.image(`item_${item.id}`, ...);
    
    // Load layer textures if they exist
    if (item.layers) {
      item.layers.forEach(layer => {
        this.scene.load.image(layer.texture, ...);
      });
    }
    
    // Recursively load children
    if (item.children) {
      this.loadMenuItemsRecursive(item.children);
    }
  }
}
```

### Performance Implications

**Issue:** Loading all deeply-nested assets upfront could be slow

**Solutions:**
1. **Lazy Loading**: Only load assets when entering a new level
2. **Pre-caching**: Load 1-2 levels ahead while user is navigating
3. **Asset Levels**: Split items.json into multiple files by depth
4. **Progressive Enhancement**: Load critical assets first, others in background

---

## Feature Flags for Gradual Migration

### Configuration Approach

```typescript
interface GameConfig {
  // ... existing properties
  
  // New feature flags
  hierarchicalNavigation: {
    enabled: boolean;           // Default: false during migration
    maxDepth?: number;          // Limit nesting depth (optional)
    lazy_loadAssets?: boolean;  // Only load visible level + next
  }
}
```

### Migration Timeline

1. **Season 1**: Legacy 2-level system (current state)
2. **Season 2**: Hierarchical system enabled alongside legacy (with flag)
3. **Season 3**: Full migration, legacy removed

---

## Backward Compatibility Implementation

### Adapter Pattern

```typescript
function normalizeItems(data: ItemsData): MenuItem[] {
  return data.items.map(item => {
    // If it's already in new format (has 'children'), return as-is
    if ('children' in item) {
      return item as MenuItem;
    }
    
    // Convert old format to new format
    return {
      ...item,
      children: item.subItems || undefined  // Convert to children
    };
  });
}
```

### In RadialDial
```typescript
// Old: this.items = items
// New: this.items = normalizeItems(itemsData)
```

---

## Navigation Path Tracking

### Use Cases
1. **Analytics**: "Players spent 3 minutes in item_1 → item_1_2 → item_1_2_1"
2. **Favorites**: "Save path to recently-viewed items"
3. **Ui Breadcrumbs**: "Power Modules > Sub-Category > Item" in future UI
4. **Deep Linking**: "Share a path URL to specific item"

### Implementation
```typescript
class NavigationHistory {
  private stack: MenuItem[] = [];  // [item_1, item_1_2, item_1_2_1]
  
  push(item: MenuItem): void {
    this.stack.push(item);
  }
  
  pop(): MenuItem | null {
    return this.stack.length > 0 
      ? this.stack.pop() 
      : null;
  }
  
  getPath(): string[] {
    return this.stack.map(item => item.id);
  }
}
```

---

## Testing Strategy for Hierarchical System

### Unit Tests Needed

```typescript
describe('NavigationController', () => {
  describe('drillDown', () => {
    // ✓ Can drill into nav items
    // ✓ Cannot drill into leaf items  
    // ✓ Stack grows correctly
  });
  
  describe('goBack', () => {
    // ✓ Returns to parent level
    // ✓ Cannot go back from root
    // ✓ Stack shrinks correctly
  });
  
  describe('isNavigable', () => {
    // ✓ Returns true for items with children
    // ✓ Returns false for leaf items
  });
  
  describe('getDepth', () => {
    // ✓ Returns 0 at root
    // ✓ Increments with each drillDown
    // ✓ Decrements with each goBack
  });
});

describe('RadialDial with Hierarchy', () => {
  // ✓ Renders correct number of items per level
  // ✓ Shows frames only on nav items
  // ✓ Drill-down works at any depth
  // ✓ Back navigation works correctly
  // ✓ Scale adjusts with depth
});

describe('AssetLoader Recursive', () => {
  // ✓ Loads all nested item textures
  // ✓ Loads all layer textures at any depth
  // ✓ Handles missing assets gracefully
});

describe('OrderGenerator with Hierarchy', () => {
  // ✓ Collects all purchasable leaf items
  // ✓ Ignores navigation-only items
  // ✓ Works with arbitrary nesting depth
});
```

---

## Summary: How to Enable This Without Code Changes

**Current State:**
- System designed to support hierarchical data
- Type system ready (MenuItem concept)
- Navigation logic compatible with unlimited depth

**To Activate Hierarchical Navigation:**

1. **Update items.json** to use `children` property instead of `subItems`
   - Supports arbitrary nesting
   - Add `layers` to any nav item (items with children)
   - Leaf items don't need layers

2. **Create adapter in AssetLoader/GameManager**
   - Convert legacy `subItems` → `children` automatically
   - Zero breaking changes for existing items.json

3. **Optionally refactor RadialDial**
   - Replace `currentLevel` with `NavigationController`
   - Use `isNavigable()` check instead of `currentLevel === 0` check
   - Adjust scale calculation for dynamic depth

4. **Add recursive asset loading**
   - Traverse full tree in `AssetLoader`
   - Cache assets at each level if needed

**Result:**
- Unlimited hierarchy depth
- Frame layers on only nav items
- Leaf items are purchasable
- Full backward compatibility
- Analytics/history capability

---

## Next Steps When Ready to Implement

1. ✓ Create NavigationController class
2. ✓ Add MenuItem type (alongside Item/SubItem temporarily)
3. ✓ Adapt existing systems to work with new types
4. ✓ Create comprehensive test suite
5. ✓ Migrate items.json gradually
6. ✓ Remove legacy types after full migration
