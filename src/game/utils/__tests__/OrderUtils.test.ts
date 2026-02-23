import { getShippableItems, generateOrder, getRandomQuantity, getCatalogRows } from '../OrderUtils';
import { MenuItem } from '../../types/GameTypes';

// ─── Test fixtures ────────────────────────────────────────────────────────────

/** Minimal A-level root with two plain B-level shippable items. */
function makeSimpleTree(): MenuItem[] {
  return [
    {
      id: 'cat_resources',
      name: 'Resources',
      icon: 'skill-diagram',
      children: [
        { id: 'iron_ore',  name: 'Iron Ore',  icon: 'iron-ore',  cost: 10 },
        { id: 'coal',      name: 'Coal',      icon: 'coal',      cost: 15 },
      ],
    },
  ];
}

/** Tree that contains nav-down items alongside shippable B-level items. */
function makeTreeWithNavDown(): MenuItem[] {
  return [
    {
      id: 'cat_armaments',
      name: 'Armaments',
      icon: 'skill-diagram',
      children: [
        { id: 'pistol',            name: 'Pistol',         icon: 'pistol',     cost: 50 },
        // nav-down via icon
        { id: 'nav_armaments_down_1', name: 'More…',      icon: 'skill-down', children: [
            { id: 'rifle', name: 'Rifle', icon: 'rifle', cost: 80 },
          ],
        },
        // nav-down via id pattern
        { id: 'armaments_down_heavy', name: 'Heavy…',     icon: 'crate',      children: [
            { id: 'cannon', name: 'Cannon', icon: 'cannon', cost: 200 },
          ],
        },
      ],
    },
  ];
}

/** Tree where B-level items have no cost (metadata nodes). */
function makeTreeNoCostAtB(): MenuItem[] {
  return [
    {
      id: 'cat_nav',
      name: 'Navigation',
      icon: 'skill-diagram',
      children: [
        { id: 'nav_help', name: 'Help', icon: 'skill-diagram' }, // no cost
        { id: 'nav_info', name: 'Info', icon: 'skill-diagram' }, // no cost
      ],
    },
  ];
}

/** Tree with items at C-level that have cost but should NOT appear. */
function makeDeepTree(): MenuItem[] {
  return [
    {
      id: 'cat_mining',
      name: 'Mining',
      icon: 'skill-diagram',
      children: [
        // B-level shippable
        { id: 'pickaxe', name: 'Pickaxe', icon: 'pickaxe', cost: 30 },
        // B-level nav-down (locked) with shippable C-level children
        {
          id: 'nav_mining_down_tools',
          name: 'Tools…',
          icon: 'skill-down',
          children: [
            { id: 'drill',   name: 'Drill',   icon: 'drill',   cost: 120 },
            { id: 'blaster', name: 'Blaster', icon: 'blaster', cost: 250 },
          ],
        },
      ],
    },
  ];
}

/** Two A-level categories, each with B-level shippable items. */
function makeMultiCategoryTree(): MenuItem[] {
  return [
    {
      id: 'cat_food',
      name: 'Food',
      icon: 'skill-diagram',
      children: [
        { id: 'bread', name: 'Bread', icon: 'bread', cost: 5 },
        { id: 'fish',  name: 'Fish',  icon: 'fish',  cost: 8 },
      ],
    },
    {
      id: 'cat_tools',
      name: 'Tools',
      icon: 'skill-diagram',
      children: [
        { id: 'hammer', name: 'Hammer', icon: 'hammer', cost: 20 },
        { id: 'wrench', name: 'Wrench', icon: 'wrench', cost: 18 },
      ],
    },
  ];
}

// ─── getShippableItems ────────────────────────────────────────────────────────

describe('getShippableItems', () => {
  describe('basic B-level selection', () => {
    it('returns direct children of A-level roots that have a cost', () => {
      const result = getShippableItems(makeSimpleTree());
      expect(result.map(i => i.id)).toEqual(['iron_ore', 'coal']);
    });

    it('collects shippable items from all A-level categories', () => {
      const result = getShippableItems(makeMultiCategoryTree());
      expect(result.map(i => i.id)).toEqual(['bread', 'fish', 'hammer', 'wrench']);
    });

    it('returns an empty array when the input is empty', () => {
      expect(getShippableItems([])).toEqual([]);
    });

    it('returns an empty array when no B-level items have a cost', () => {
      expect(getShippableItems(makeTreeNoCostAtB())).toEqual([]);
    });

    it('returns an empty array when the root has no children', () => {
      const rootOnly: MenuItem[] = [{ id: 'lone', name: 'Lone', icon: 'icon', children: [] }];
      expect(getShippableItems(rootOnly)).toEqual([]);
    });
  });

  describe('nav-down item exclusion — mirrors RadialDial lock logic', () => {
    it('excludes items whose icon is "skill-down"', () => {
      const result = getShippableItems(makeTreeWithNavDown());
      expect(result.map(i => i.id)).toEqual(['pistol']);
    });

    it('excludes items whose id contains "_down_"', () => {
      const result = getShippableItems(makeTreeWithNavDown());
      const ids = result.map(i => i.id);
      expect(ids).not.toContain('nav_armaments_down_1');
      expect(ids).not.toContain('armaments_down_heavy');
    });

    it('does NOT include C-level items even when they have a cost', () => {
      const result = getShippableItems(makeTreeWithNavDown());
      const ids = result.map(i => i.id);
      expect(ids).not.toContain('rifle');
      expect(ids).not.toContain('cannon');
    });

    it('excludes locked nav-down nodes while retaining sibling shippable items', () => {
      const result = getShippableItems(makeDeepTree());
      expect(result.map(i => i.id)).toEqual(['pickaxe']);
    });

    it('does NOT include C-level children of locked nav-down nodes', () => {
      const result = getShippableItems(makeDeepTree());
      const ids = result.map(i => i.id);
      expect(ids).not.toContain('drill');
      expect(ids).not.toContain('blaster');
    });
  });

  describe('item shape', () => {
    it('preserves the full MenuItem shape of returned items', () => {
      const result = getShippableItems(makeSimpleTree());
      expect(result[0]).toMatchObject({
        id: 'iron_ore',
        name: 'Iron Ore',
        icon: 'iron-ore',
        cost: 10,
      });
    });
  });
});

// ─── generateOrder ────────────────────────────────────────────────────────────

describe('generateOrder', () => {
  /** Deterministic rng that cycles through a sequence of values 0..n */
  const makeSeqRng = (...values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length];
  };

  it('returns an order with id, budget, and requirements', () => {
    const order = generateOrder(makeSimpleTree());
    expect(order.id).toBeTruthy();
    expect(order.budget).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(order.requirements)).toBe(true);
  });

  it('returns an empty order when no shippable items exist', () => {
    const order = generateOrder(makeTreeNoCostAtB());
    expect(order.requirements).toHaveLength(0);
    expect(order.budget).toBe(0);
  });

  it('requirements only contain items that are in getShippableItems', () => {
    const items = makeTreeWithNavDown();
    const shippableIds = getShippableItems(items).map(i => i.id);

    for (let run = 0; run < 30; run++) {
      const order = generateOrder(items);
      order.requirements.forEach(req => {
        expect(shippableIds).toContain(req.itemId);
      });
    }
  });

  it('requirements NEVER contain nav-down items or their children', () => {
    const items = makeDeepTree();
    const forbidden = ['nav_mining_down_tools', 'drill', 'blaster'];

    for (let run = 0; run < 30; run++) {
      const order = generateOrder(items);
      order.requirements.forEach(req => {
        expect(forbidden).not.toContain(req.itemId);
      });
    }
  });

  it('budget equals sum of (cost × quantity) across all requirements', () => {
    for (let run = 0; run < 20; run++) {
      const order = generateOrder(makeMultiCategoryTree());
      const computed = order.requirements.reduce(
        (sum, req) => sum + req.cost * req.quantity, 0,
      );
      expect(order.budget).toBe(computed);
    }
  });

  it('each requirement has a defined iconKey matching the item icon', () => {
    const items = makeSimpleTree();
    const iconMap = new Map(getShippableItems(items).map(i => [i.id, i.icon]));

    for (let run = 0; run < 10; run++) {
      const order = generateOrder(items);
      order.requirements.forEach(req => {
        expect(req.iconKey).toBe(iconMap.get(req.itemId));
      });
    }
  });

  it('selects at most the number of available shippable items', () => {
    // Simple tree has exactly 2 shippable items - order can never have more
    for (let run = 0; run < 20; run++) {
      const order = generateOrder(makeSimpleTree());
      expect(order.requirements.length).toBeLessThanOrEqual(2);
    }
  });

  it('does not duplicate items within a single order', () => {
    for (let run = 0; run < 30; run++) {
      const order = generateOrder(makeMultiCategoryTree());
      const ids = order.requirements.map(r => r.itemId);
      expect(ids.length).toBe(new Set(ids).size);
    }
  });

  it('uses the injected rng and qty functions for deterministic output', () => {
    // rng always returns 0 → selects 1 item (numItems=1), picks index 0
    const rng = makeSeqRng(0);
    const qtyFn = () => 3;
    const items = makeSimpleTree();
    const order = generateOrder(items, rng, qtyFn);

    expect(order.requirements).toHaveLength(1);
    expect(order.requirements[0].itemId).toBe('iron_ore');
    expect(order.requirements[0].quantity).toBe(3);
    expect(order.budget).toBe(10 * 3);
  });
});

// ─── getRandomQuantity ────────────────────────────────────────────────────────

describe('getRandomQuantity', () => {
  it('always returns a value between 1 and 5', () => {
    for (let i = 0; i < 500; i++) {
      const qty = getRandomQuantity();
      expect(qty).toBeGreaterThanOrEqual(1);
      expect(qty).toBeLessThanOrEqual(5);
    }
  });

  it('returns only integer values', () => {
    for (let i = 0; i < 100; i++) {
      expect(Number.isInteger(getRandomQuantity())).toBe(true);
    }
  });
});

// ─── getCatalogRows ───────────────────────────────────────────────────────────

describe('getCatalogRows', () => {
  describe('same source of truth as getShippableItems', () => {
    it('the flat list of all catalog items equals getShippableItems', () => {
      const items = makeMultiCategoryTree();
      const catalogItems = getCatalogRows(items).flatMap(r => r.items);
      const shippable = getShippableItems(items);
      expect(catalogItems.map(i => i.id)).toEqual(shippable.map(i => i.id));
    });

    it('catalog items match getShippableItems for a tree with nav-down nodes', () => {
      const items = makeTreeWithNavDown();
      const catalogItems = getCatalogRows(items).flatMap(r => r.items);
      const shippable = getShippableItems(items);
      expect(catalogItems.map(i => i.id)).toEqual(shippable.map(i => i.id));
    });

    it('catalog items match getShippableItems for a deep-locked tree', () => {
      const items = makeDeepTree();
      const catalogItems = getCatalogRows(items).flatMap(r => r.items);
      const shippable = getShippableItems(items);
      expect(catalogItems.map(i => i.id)).toEqual(shippable.map(i => i.id));
    });
  });

  describe('grouping', () => {
    it('groups items under the correct A-level category', () => {
      const rows = getCatalogRows(makeMultiCategoryTree());
      expect(rows).toHaveLength(2);
      expect(rows[0].category.id).toBe('cat_food');
      expect(rows[0].items.map(i => i.id)).toEqual(['bread', 'fish']);
      expect(rows[1].category.id).toBe('cat_tools');
      expect(rows[1].items.map(i => i.id)).toEqual(['hammer', 'wrench']);
    });

    it('does not include the category header in its own items array', () => {
      const rows = getCatalogRows(makeMultiCategoryTree());
      rows.forEach(row => {
        expect(row.items.map(i => i.id)).not.toContain(row.category.id);
      });
    });

    it('each item object is the original MenuItem (same reference)', () => {
      const items = makeSimpleTree();
      const shippable = getShippableItems(items);
      const catalogItems = getCatalogRows(items).flatMap(r => r.items);
      catalogItems.forEach((catItem, i) => {
        expect(catItem).toBe(shippable[i]);
      });
    });
  });

  describe('exclusions', () => {
    it('never includes nav-down items in any category\'s items array', () => {
      const rows = getCatalogRows(makeTreeWithNavDown());
      rows.forEach(row => {
        row.items.forEach(item => {
          expect(item.icon).not.toBe('skill-down');
          expect(item.id).not.toMatch(/_down_/);
        });
      });
    });

    it('never includes C-level children of locked nodes', () => {
      const rows = getCatalogRows(makeDeepTree());
      const allItemIds = rows.flatMap(r => r.items).map(i => i.id);
      expect(allItemIds).not.toContain('drill');
      expect(allItemIds).not.toContain('blaster');
    });

    it('excludes categories where all B-level children are nav-down', () => {
      // A root whose only child is a nav-down node — should produce no catalog row
      const navOnlyTree: MenuItem[] = [
        {
          id: 'cat_locked',
          name: 'Locked Cat',
          icon: 'skill-diagram',
          children: [
            { id: 'nav_locked_down_1', name: 'Deep…', icon: 'skill-down', children: [
                { id: 'deep_item', name: 'Deep Item', icon: 'deep', cost: 99 },
              ],
            },
          ],
        },
      ];
      expect(getCatalogRows(navOnlyTree)).toHaveLength(0);
    });

    it('excludes categories where B-level items have no cost', () => {
      const rows = getCatalogRows(makeTreeNoCostAtB());
      expect(rows).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('returns an empty array for empty input', () => {
      expect(getCatalogRows([])).toEqual([]);
    });

    it('returns an empty array when roots have no children', () => {
      const rootOnly: MenuItem[] = [{ id: 'lone', name: 'Lone', icon: 'icon', children: [] }];
      expect(getCatalogRows(rootOnly)).toEqual([]);
    });
  });
});
