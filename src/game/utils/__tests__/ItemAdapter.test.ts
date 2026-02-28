import {
  adaptLegacyItems,
  isMenuItemFormat,
  normalizeItems,
  paginateItems,
} from '../ItemAdapter';
import { Item, MenuItem } from '../../types/GameTypes';

describe('ItemAdapter', () => {
  describe('adaptLegacyItems', () => {
    it('should convert Item with SubItems to MenuItem with children', () => {
      const legacyItems: Item[] = [
        {
          id: 'item_1',
          name: 'Category 1',
          icon: 'item_1',
          description: 'Test category',
          subItems: [
            {
              id: 'item_1_1',
              name: 'Sub Item 1',
              icon: 'item_1_1',
              cost: 10,
              description: 'Test sub item'
            }
          ]
        }
      ];

      const result = adaptLegacyItems(legacyItems);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('item_1');
      expect(result[0].name).toBe('Category 1');
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children![0].id).toBe('item_1_1');
    });

    it('should preserve all properties during conversion', () => {
      const legacyItems: Item[] = [
        {
          id: 'item_1',
          name: 'Category 1',
          icon: 'item_1',
          description: 'Category description',
          layers: [
            { texture: 'item_1', depth: 2 },
            { texture: 'nav_frame', depth: 3 }
          ],
          subItems: [
            {
              id: 'item_1_1',
              name: 'Sub Item 1',
              icon: 'item_1_1',
              cost: 10,
              description: 'Sub item description',
              layers: [{ texture: 'item_1_1', depth: 2 }]
            }
          ]
        }
      ];

      const result = adaptLegacyItems(legacyItems);
      const parent = result[0];
      const child = parent.children![0];

      // Parent properties
      expect(parent.id).toBe('item_1');
      expect(parent.name).toBe('Category 1');
      expect(parent.icon).toBe('item_1');
      expect(parent.description).toBe('Category description');
      expect(parent.layers).toEqual([
        { texture: 'item_1', depth: 2 },
        { texture: 'nav_frame', depth: 3 }
      ]);

      // Child properties
      expect(child.id).toBe('item_1_1');
      expect(child.name).toBe('Sub Item 1');
      expect(child.icon).toBe('item_1_1');
      expect(child.cost).toBe(10);
      expect(child.description).toBe('Sub item description');
      expect(child.layers).toEqual([{ texture: 'item_1_1', depth: 2 }]);
    });

    it('should convert multiple items', () => {
      const legacyItems: Item[] = [
        {
          id: 'item_1',
          name: 'Category 1',
          icon: 'item_1',
          subItems: [
            { id: 'item_1_1', name: 'Sub 1', icon: 'item_1_1', cost: 10 }
          ]
        },
        {
          id: 'item_2',
          name: 'Category 2',
          icon: 'item_2',
          subItems: [
            { id: 'item_2_1', name: 'Sub 2', icon: 'item_2_1', cost: 20 }
          ]
        }
      ];

      const result = adaptLegacyItems(legacyItems);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('item_1');
      expect(result[1].id).toBe('item_2');
    });

    it('should handle items with multiple sub-items', () => {
      const legacyItems: Item[] = [
        {
          id: 'item_1',
          name: 'Category 1',
          icon: 'item_1',
          subItems: [
            { id: 'item_1_1', name: 'Sub 1', icon: 'item_1_1', cost: 10 },
            { id: 'item_1_2', name: 'Sub 2', icon: 'item_1_2', cost: 15 },
            { id: 'item_1_3', name: 'Sub 3', icon: 'item_1_3', cost: 20 }
          ]
        }
      ];

      const result = adaptLegacyItems(legacyItems);
      const children = result[0].children!;

      expect(children).toHaveLength(3);
      expect(children[0].id).toBe('item_1_1');
      expect(children[1].id).toBe('item_1_2');
      expect(children[2].id).toBe('item_1_3');
    });

    it('should not include children in converted sub-items (they are leafs)', () => {
      const legacyItems: Item[] = [
        {
          id: 'item_1',
          name: 'Category 1',
          icon: 'item_1',
          subItems: [
            { id: 'item_1_1', name: 'Sub 1', icon: 'item_1_1', cost: 10 }
          ]
        }
      ];

      const result = adaptLegacyItems(legacyItems);
      const child = result[0].children![0];

      expect(child.children).toBeUndefined();
    });
  });

  describe('isMenuItemFormat', () => {
    it('should return true for MenuItem[] format', () => {
      const menuItems: MenuItem[] = [
        {
          id: 'item_1',
          name: 'Item 1',
          icon: 'item_1',
          children: []
        }
      ];

      expect(isMenuItemFormat(menuItems)).toBe(true);
    });

    it('should return false for Item[] (legacy) format', () => {
      const legacyItems: Item[] = [
        {
          id: 'item_1',
          name: 'Item 1',
          icon: 'item_1',
          subItems: []
        }
      ];

      expect(isMenuItemFormat(legacyItems as any)).toBe(false);
    });

    it('should return true for empty array', () => {
      expect(isMenuItemFormat([])).toBe(true);
    });

    it('should detect children property', () => {
      const mixedItems: any[] = [
        {
          id: 'item_1',
          name: 'Item 1',
          icon: 'item_1',
          children: [
            { id: 'item_1_1', name: 'Sub 1', icon: 'item_1_1' }
          ]
        }
      ];

      expect(isMenuItemFormat(mixedItems)).toBe(true);
    });

    it('should detect absence of subItems in MenuItem format', () => {
      const menuItems: MenuItem[] = [
        {
          id: 'item_1',
          name: 'Item 1',
          icon: 'item_1',
          children: []
        }
      ];

      expect(isMenuItemFormat(menuItems)).toBe(true);
    });
  });

  describe('normalizeItems', () => {
    it('should pass through MenuItem[] format unchanged', () => {
      const menuItems: MenuItem[] = [
        {
          id: 'item_1',
          name: 'Item 1',
          icon: 'item_1',
          children: []
        }
      ];

      const result = normalizeItems(menuItems);

      expect(result).toEqual(menuItems);
      expect(result).toBe(menuItems); // Same reference
    });

    it('should convert Item[] (legacy) format to MenuItem[]', () => {
      const legacyItems: Item[] = [
        {
          id: 'item_1',
          name: 'Category 1',
          icon: 'item_1',
          subItems: [
            { id: 'item_1_1', name: 'Sub 1', icon: 'item_1_1', cost: 10 }
          ]
        }
      ];

      const result = normalizeItems(legacyItems);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('item_1');
      expect(result[0].children).toHaveLength(1);
    });

    it('should detect format automatically', () => {
      const legacyItems: Item[] = [
        {
          id: 'item_1',
          name: 'Category 1',
          icon: 'item_1',
          subItems: []
        }
      ];

      const result = normalizeItems(legacyItems);

      // Should have converted from legacy format
      expect((result[0] as any).subItems).toBeUndefined();
      expect((result[0] as any).children).toBeDefined();
    });

    it('should handle mixed-looking data by format preference', () => {
      // If first item has 'children', treat as MenuItem format
      const menuItem: MenuItem[] = [
        {
          id: 'item_1',
          name: 'Item 1',
          icon: 'item_1',
          children: [
            { id: 'item_1_1', name: 'Sub', icon: 'item_1_1', cost: 10 }
          ]
        }
      ];

      const result = normalizeItems(menuItem);
      expect(result[0].children).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle items without optional properties', () => {
      const legacyItems: Item[] = [
        {
          id: 'item_1',
          name: 'Category 1',
          icon: 'item_1',
          subItems: [
            { id: 'item_1_1', name: 'Sub 1', icon: 'item_1_1', cost: 10 }
          ]
        }
      ];

      const result = adaptLegacyItems(legacyItems);

      expect(result[0].description).toBeUndefined();
      expect(result[0].layers).toBeUndefined();
      expect(result[0].children![0].description).toBeUndefined();
      expect(result[0].children![0].layers).toBeUndefined();
    });

    it('should handle empty subItems', () => {
      const legacyItems: Item[] = [
        {
          id: 'item_1',
          name: 'Category 1',
          icon: 'item_1',
          subItems: []
        }
      ];

      const result = adaptLegacyItems(legacyItems);

      expect(result[0].children).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// paginateItems — builds a paginated nav tree from a flat leaf list
// ---------------------------------------------------------------------------
describe('paginateItems', () => {
  const makeLeaf = (n: number): MenuItem => ({ id: `item_${n}`, name: `Item ${n}`, icon: `icon${n}` });

  it('returns the items unchanged when count ≤ pageSize', () => {
    const result = paginateItems([makeLeaf(1), makeLeaf(2)], 5);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('item_1');
    expect(result.some(n => n.id.startsWith('nav_page'))).toBe(false);
  });

  it('appends a nav_page_down_0 node when items overflow the first page', () => {
    // 3 items + pageSize=2 → page=[A,B] + navDown→[C]
    const result = paginateItems([makeLeaf(1), makeLeaf(2), makeLeaf(3)], 2);
    expect(result).toHaveLength(3); // A, B, navDown
    const navDown = result.find(n => n.id === 'nav_page_down_0')!;
    expect(navDown).toBeDefined();
    expect(navDown.icon).toBe('skill-down');
    expect(navDown.children).toHaveLength(1);
    expect(navDown.children![0].id).toBe('item_3');
  });

  it('nests multiple pages recursively', () => {
    // 5 items + pageSize=2 → [1,2,navDown→[3,4,navDown→[5]]]
    const items = [1, 2, 3, 4, 5].map(makeLeaf);
    const result = paginateItems(items, 2);

    expect(result).toHaveLength(3); // 1, 2, navDown0
    const navDown0 = result.find(n => n.id === 'nav_page_down_0')!;
    const navDown1 = navDown0.children!.find(n => n.id === 'nav_page_down_1')!;
    expect(navDown1).toBeDefined();
    expect(navDown1.children).toHaveLength(1);
    expect(navDown1.children![0].id).toBe('item_5');
  });

  it('returns empty array for empty input', () => {
    expect(paginateItems([], 5)).toHaveLength(0);
  });

  it('nav-down node includes skill-down layers for StandardNavFace rendering', () => {
    const result = paginateItems([makeLeaf(1), makeLeaf(2), makeLeaf(3)], 2);
    const navDown = result.find(n => n.id.startsWith('nav_page_down'))!;
    const textures = navDown.layers!.map(l => l.texture);
    expect(textures).toContain('skill-down');
    expect(textures).toContain('frame');
  });

  it('defaults to pageSize 5 when not specified', () => {
    const items = [1, 2, 3, 4, 5, 6].map(makeLeaf);
    const result = paginateItems(items);
    // 5 items on page 1, navDown with 1 item
    expect(result).toHaveLength(6);
    const navDown = result.find(n => n.id.startsWith('nav_page_down'));
    expect(navDown).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// paginateItems — builds a paginated nav tree from a flat leaf list
// ---------------------------------------------------------------------------
describe('paginateItems', () => {
  const makeLeaf = (n: number): MenuItem => ({ id: `item_${n}`, name: `Item ${n}`, icon: `icon${n}` });

  it('returns the items unchanged when count ≤ pageSize', () => {
    const result = paginateItems([makeLeaf(1), makeLeaf(2)], 5);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('item_1');
    expect(result.some(n => n.id.startsWith('nav_page'))).toBe(false);
  });

  it('appends a nav_page_down_0 node when items overflow the first page', () => {
    // 3 items + pageSize=2 → page=[A,B] + navDown→[C]
    const result = paginateItems([makeLeaf(1), makeLeaf(2), makeLeaf(3)], 2);
    expect(result).toHaveLength(3); // A, B, navDown
    const navDown = result.find(n => n.id === 'nav_page_down_0')!;
    expect(navDown).toBeDefined();
    expect(navDown.icon).toBe('skill-down');
    expect(navDown.children).toHaveLength(1);
    expect(navDown.children![0].id).toBe('item_3');
  });

  it('nests multiple pages recursively', () => {
    // 5 items + pageSize=2 → [1,2,navDown→[3,4,navDown→[5]]]
    const items = [1,2,3,4,5].map(makeLeaf);
    const result = paginateItems(items, 2);

    expect(result).toHaveLength(3); // 1, 2, navDown0
    const navDown0 = result.find(n => n.id === 'nav_page_down_0')!;
    const navDown1 = navDown0.children!.find(n => n.id === 'nav_page_down_1')!;
    expect(navDown1).toBeDefined();
    expect(navDown1.children).toHaveLength(1);
    expect(navDown1.children![0].id).toBe('item_5');
  });

  it('returns empty array for empty input', () => {
    expect(paginateItems([], 5)).toHaveLength(0);
  });

  it('nav-down node includes skill-down layers for StandardNavFace rendering', () => {
    const result = paginateItems([makeLeaf(1), makeLeaf(2), makeLeaf(3)], 2);
    const navDown = result.find(n => n.id.startsWith('nav_page_down'))!;
    const textures = navDown.layers!.map(l => l.texture);
    expect(textures).toContain('skill-down');
    expect(textures).toContain('frame');
  });

  it('defaults to pageSize 5 when not specified', () => {
    const items = [1,2,3,4,5,6].map(makeLeaf);
    const result = paginateItems(items);
    // 5 items on page 1, navDown with 1 item
    expect(result).toHaveLength(6);
    const navDown = result.find(n => n.id.startsWith('nav_page_down'));
    expect(navDown).toBeDefined();
  });
});
