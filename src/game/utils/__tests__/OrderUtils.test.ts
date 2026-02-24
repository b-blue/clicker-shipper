import { getShippableItems, generateOrder, getRandomQuantity, getCatalogRows } from '../OrderUtils';
import { MenuItem } from '../../types/GameTypes';

// Mock ProgressionManager so OrderUtils can import it without touching real localStorage.
// Default: returns isUnlocked=false, getUnlockedDepth=1 for everything.
// Existing tests are unaffected because they use `cat_*` IDs which bypass
// progression filtering entirely in getCatalogRows (nav_*_root check).
jest.mock('../../managers/ProgressionManager', () => ({
  ProgressionManager: {
    getInstance: jest.fn(() => ({
      isUnlocked: jest.fn((_id: string) => false),
      getUnlockedDepth: jest.fn((_id: string) => 1),
    })),
  },
}));

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

  describe('progression-category filtering', () => {
    const { ProgressionManager } = jest.requireMock('../../managers/ProgressionManager') as {
      ProgressionManager: { getInstance: jest.Mock };
    };

    /** Two nav_*_root categories; only alpha unlocked. */
    function makeNavRootTree(): MenuItem[] {
      return [
        {
          id: 'nav_alpha_root',
          name: 'Alpha',
          icon: 'alpha',
          children: [
            { id: 'alpha_item_1', name: 'Alpha 1', icon: 'a1', cost: 10 },
            { id: 'alpha_item_2', name: 'Alpha 2', icon: 'a2', cost: 20 },
          ],
        },
        {
          id: 'nav_beta_root',
          name: 'Beta',
          icon: 'beta',
          children: [
            { id: 'beta_item_1', name: 'Beta 1', icon: 'b1', cost: 30 },
          ],
        },
      ];
    }

    it('excludes items from locked nav_*_root categories', () => {
      ProgressionManager.getInstance.mockReturnValue({
        isUnlocked: jest.fn((id: string) => id === 'nav_alpha_root'),
        getUnlockedDepth: jest.fn(() => 1),
      });
      const result = getShippableItems(makeNavRootTree());
      const ids = result.map(i => i.id);
      expect(ids).toContain('alpha_item_1');
      expect(ids).toContain('alpha_item_2');
      expect(ids).not.toContain('beta_item_1');
    });

    it('returns an empty array when all nav_*_root categories are locked', () => {
      ProgressionManager.getInstance.mockReturnValue({
        isUnlocked: jest.fn(() => false),
        getUnlockedDepth: jest.fn(() => 0),
      });
      expect(getShippableItems(makeNavRootTree())).toHaveLength(0);
    });

    it('includes items from all unlocked categories', () => {
      ProgressionManager.getInstance.mockReturnValue({
        isUnlocked: jest.fn(() => true),
        getUnlockedDepth: jest.fn(() => 1),
      });
      const result = getShippableItems(makeNavRootTree());
      expect(result.map(i => i.id)).toEqual(['alpha_item_1', 'alpha_item_2', 'beta_item_1']);
    });

    it('non-progression cat_* IDs are always included regardless of ProgressionManager', () => {
      ProgressionManager.getInstance.mockReturnValue({
        isUnlocked: jest.fn(() => false),
        getUnlockedDepth: jest.fn(() => 0),
      });
      // makeSimpleTree uses 'cat_resources' — not a progression category
      const result = getShippableItems(makeSimpleTree());
      expect(result.map(i => i.id)).toEqual(['iron_ore', 'coal']);
    });
  });

  describe('depth-aware inclusion of nav_*_down_N items', () => {
    const { ProgressionManager } = jest.requireMock('../../managers/ProgressionManager') as {
      ProgressionManager: { getInstance: jest.Mock };
    };

    /** Progression category tree with a nav_*_down_1 sub-tree containing deeper items. */
    function makeDeepNavRootTree(): MenuItem[] {
      return [
        {
          id: 'nav_resources_root',
          name: 'Resources',
          icon: 'skill-diagram',
          children: [
            { id: 'iron_ore', name: 'Iron Ore', icon: 'iron-ore', cost: 10 },
            { id: 'coal',     name: 'Coal',     icon: 'coal',     cost: 15 },
            {
              id: 'nav_resources_down_1',
              name: 'Advanced…',
              icon: 'skill-down',
              children: [
                { id: 'titanium', name: 'Titanium', icon: 'titanium', cost: 80 },
                { id: 'platinum', name: 'Platinum', icon: 'platinum', cost: 120 },
                {
                  id: 'nav_resources_down_2',
                  name: 'Rare…',
                  icon: 'skill-down',
                  children: [
                    { id: 'dark_matter', name: 'Dark Matter', icon: 'dark-matter', cost: 500 },
                  ],
                },
              ],
            },
          ],
        },
      ];
    }

    it('at depth 1: excludes items inside nav_*_down_1 (levelN=1 is NOT < 1)', () => {
      ProgressionManager.getInstance.mockReturnValue({
        isUnlocked: jest.fn(() => true),
        getUnlockedDepth: jest.fn(() => 1),
      });
      const ids = getShippableItems(makeDeepNavRootTree()).map(i => i.id);
      expect(ids).toEqual(['iron_ore', 'coal']);
      expect(ids).not.toContain('titanium');
      expect(ids).not.toContain('platinum');
      expect(ids).not.toContain('dark_matter');
    });

    it('at depth 2: includes items inside nav_*_down_1 but not nav_*_down_2', () => {
      ProgressionManager.getInstance.mockReturnValue({
        isUnlocked: jest.fn(() => true),
        getUnlockedDepth: jest.fn(() => 2),
      });
      const ids = getShippableItems(makeDeepNavRootTree()).map(i => i.id);
      expect(ids).toContain('iron_ore');
      expect(ids).toContain('coal');
      expect(ids).toContain('titanium');
      expect(ids).toContain('platinum');
      expect(ids).not.toContain('dark_matter');
    });

    it('at depth 3: includes items from both nav_*_down_1 and nav_*_down_2', () => {
      ProgressionManager.getInstance.mockReturnValue({
        isUnlocked: jest.fn(() => true),
        getUnlockedDepth: jest.fn(() => 3),
      });
      const ids = getShippableItems(makeDeepNavRootTree()).map(i => i.id);
      expect(ids).toContain('titanium');
      expect(ids).toContain('platinum');
      expect(ids).toContain('dark_matter');
    });

    it('deeper items are immediately available after deepenCategory is purchased (same shift)', () => {
      // Simulate: player was at depth 1, just purchased deepen → depth is now 2
      ProgressionManager.getInstance.mockReturnValue({
        isUnlocked: jest.fn(() => true),
        getUnlockedDepth: jest.fn(() => 2),
      });
      const ids = getShippableItems(makeDeepNavRootTree()).map(i => i.id);
      // Titanium and Platinum should appear in the order pool right away
      expect(ids).toContain('titanium');
      expect(ids).toContain('platinum');
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

// ── getCatalogRows — counter-clockwise ordering ─────────────────────────────────────
// These use `cat_*` IDs to bypass progression filtering, keeping the tests
// focused purely on dial ordering.

describe('getCatalogRows — counter-clockwise ordering', () => {
  /** 5 items in clockwise array order: a=pos1, b=pos3, c=pos4, d=pos5, e=pos6 */
  function make5ItemTree(): MenuItem[] {
    return [{
      id: 'cat_dial',
      name: 'Dial',
      icon: 'icon',
      children: [
        { id: 'a', name: 'A', icon: 'a', cost: 10 },
        { id: 'b', name: 'B', icon: 'b', cost: 20 },
        { id: 'c', name: 'C', icon: 'c', cost: 30 },
        { id: 'd', name: 'D', icon: 'd', cost: 40 },
        { id: 'e', name: 'E', icon: 'e', cost: 50 },
      ],
    }];
  }

  it('first item stays in first position', () => {
    const rows = getCatalogRows(make5ItemTree());
    expect(rows[0].items[0].id).toBe('a');
  });

  it('reverses items 2–5 so the catalog reads counter-clockwise', () => {
    const rows = getCatalogRows(make5ItemTree());
    // CCW from pos1: a, e, d, c, b
    expect(rows[0].items.map(i => i.id)).toEqual(['a', 'e', 'd', 'c', 'b']);
  });

  it('a single-item page is returned as-is', () => {
    const tree: MenuItem[] = [{
      id: 'cat_single',
      name: 'Single',
      icon: 'icon',
      children: [{ id: 'only', name: 'Only', icon: 'only', cost: 5 }],
    }];
    const rows = getCatalogRows(tree);
    expect(rows[0].items.map(i => i.id)).toEqual(['only']);
  });

  it('a two-item page is returned as-is (CCW of 2 = same order)', () => {
    const rows = getCatalogRows([{
      id: 'cat_two',
      name: 'Two',
      icon: 'icon',
      children: [
        { id: 'first', name: 'First', icon: 'f', cost: 1 },
        { id: 'second', name: 'Second', icon: 's', cost: 2 },
      ],
    }]);
    expect(rows[0].items.map(i => i.id)).toEqual(['first', 'second']);
  });

  it('nav-down items are not themselves included in CCW output', () => {
    const tree: MenuItem[] = [{
      id: 'cat_mixed',
      name: 'Mixed',
      icon: 'icon',
      children: [
        { id: 'item_1',             name: 'I1',   icon: 'i1', cost: 10 },
        { id: 'nav_mixed_down_1',   name: 'More', icon: 'skill-down', children: [] },
        { id: 'item_2',             name: 'I2',   icon: 'i2', cost: 20 },
        { id: 'item_3',             name: 'I3',   icon: 'i3', cost: 30 },
      ],
    }];
    const rows = getCatalogRows(tree);
    const ids = rows[0].items.map(i => i.id);
    expect(ids).not.toContain('nav_mixed_down_1');
    // CCW of [item_1, item_2, item_3]: [item_1, item_3, item_2]
    expect(ids).toEqual(['item_1', 'item_3', 'item_2']);
  });
});

// ── getCatalogRows — progression filtering ──────────────────────────────────────
// These use `nav_*_root` IDs to exercise the actual progression gate.
// The ProgressionManager is mocked per-test via jest.requireMock.

describe('getCatalogRows — progression filtering', () => {
  const { ProgressionManager } = jest.requireMock('../../managers/ProgressionManager') as {
    ProgressionManager: { getInstance: jest.Mock };
  };

  /** A tree with two progression-managed categories. */
  function makeNavTree(): MenuItem[] {
    return [
      {
        id: 'nav_alpha_root',
        name: 'Alpha',
        icon: 'alpha',
        children: [
          { id: 'item_a1', name: 'A1', icon: 'a1', cost: 10 },
          { id: 'item_a2', name: 'A2', icon: 'a2', cost: 20 },
          {
            id: 'nav_alpha_down_1',
            name: 'Alpha Deep',
            icon: 'skill-down',
            children: [
              { id: 'item_a3', name: 'A3', icon: 'a3', cost: 30 },
              { id: 'item_a4', name: 'A4', icon: 'a4', cost: 40 },
            ],
          },
        ],
      },
      {
        id: 'nav_beta_root',
        name: 'Beta',
        icon: 'beta',
        children: [
          { id: 'item_b1', name: 'B1', icon: 'b1', cost: 50 },
        ],
      },
    ];
  }

  it('shows only unlocked categories', () => {
    ProgressionManager.getInstance.mockReturnValue({
      isUnlocked: jest.fn((id: string) => id === 'nav_alpha_root'),
      getUnlockedDepth: jest.fn((id: string) => id === 'nav_alpha_root' ? 1 : 0),
    });
    const rows = getCatalogRows(makeNavTree());
    expect(rows).toHaveLength(1);
    expect(rows[0].category.id).toBe('nav_alpha_root');
  });

  it('shows both categories when both are unlocked', () => {
    ProgressionManager.getInstance.mockReturnValue({
      isUnlocked: jest.fn(() => true),
      getUnlockedDepth: jest.fn(() => 1),
    });
    const rows = getCatalogRows(makeNavTree());
    expect(rows).toHaveLength(2);
  });

  it('hides all categories when none are unlocked', () => {
    ProgressionManager.getInstance.mockReturnValue({
      isUnlocked: jest.fn(() => false),
      getUnlockedDepth: jest.fn(() => 0),
    });
    expect(getCatalogRows(makeNavTree())).toHaveLength(0);
  });

  it('at depth 1: shows only B-level items (no deeper items)', () => {
    ProgressionManager.getInstance.mockReturnValue({
      isUnlocked: jest.fn(() => true),
      getUnlockedDepth: jest.fn(() => 1),
    });
    const rows = getCatalogRows(makeNavTree());
    const alphaIds = rows.find(r => r.category.id === 'nav_alpha_root')!.items.map(i => i.id);
    expect(alphaIds).not.toContain('item_a3');
    expect(alphaIds).not.toContain('item_a4');
  });

  it('at depth 2: includes items from nav_*_down_1', () => {
    ProgressionManager.getInstance.mockReturnValue({
      isUnlocked: jest.fn(() => true),
      getUnlockedDepth: jest.fn((id: string) => id === 'nav_alpha_root' ? 2 : 1),
    });
    const rows = getCatalogRows(makeNavTree());
    const alphaIds = rows.find(r => r.category.id === 'nav_alpha_root')!.items.map(i => i.id);
    expect(alphaIds).toContain('item_a3');
    expect(alphaIds).toContain('item_a4');
  });

  it('B-level items at depth 2 are still CCW ordered', () => {
    ProgressionManager.getInstance.mockReturnValue({
      isUnlocked: jest.fn(() => true),
      getUnlockedDepth: jest.fn(() => 2),
    });
    const rows = getCatalogRows(makeNavTree());
    const alphaItems = rows.find(r => r.category.id === 'nav_alpha_root')!.items;
    // B-level CCW: [item_a1, item_a2] → [item_a1, item_a2] (2-item page, no change)
    // Then deeper page: [item_a3, item_a4] → [item_a3, item_a4] (2-item page)
    expect(alphaItems.map(i => i.id)).toEqual(['item_a1', 'item_a2', 'item_a3', 'item_a4']);
  });
});
