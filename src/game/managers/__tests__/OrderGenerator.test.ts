import { OrderGenerator } from '../OrderGenerator';
import { Item, SubItem } from '../types/GameTypes';
import { GameManager } from '../GameManager';
import { ProgressionManager } from '../ProgressionManager';

// Mock GameManager
jest.mock('../GameManager', () => ({
  GameManager: {
    getInstance: jest.fn(() => ({
      getItems: jest.fn(() => createMockItems()),
    })),
  },
}));

// Mock ProgressionManager — default: everything unlocked at max depth so legacy tests are unaffected
jest.mock('../ProgressionManager', () => ({
  ProgressionManager: {
    getInstance: jest.fn(() => ({
      getUnlockedCategories: jest.fn(() => [
        { categoryId: 'item_1', depth: 7 },
      ]),
      getUnlockedDepth: jest.fn((_id: string) => 7),
    })),
  },
}));

function createMockItems(): Item[] {
  const mockSubItems: SubItem[] = [
    { id: 'item_1_1', name: 'Item 1', icon: 'icon1', cost: 10 },
    { id: 'item_1_2', name: 'Item 2', icon: 'icon2', cost: 15 },
    { id: 'item_1_3', name: 'Item 3', icon: 'icon3', cost: 20 },
    { id: 'item_1_4', name: 'Item 4', icon: 'icon4', cost: 25 },
    { id: 'item_1_5', name: 'Item 5', icon: 'icon5', cost: 30 },
    { id: 'item_1_6', name: 'Item 6', icon: 'icon6', cost: 35 },
  ];

  return [
    {
      id: 'item_1',
      name: 'Category 1',
      icon: 'cat1',
      subItems: mockSubItems,
    },
  ];
}

describe('OrderGenerator', () => {
  let generator: OrderGenerator;

  beforeEach(() => {
    generator = new OrderGenerator();
  });

  describe('generateOrder', () => {
    it('should generate an order', () => {
      const order = generator.generateOrder();
      expect(order).toBeDefined();
      expect(order.id).toBeDefined();
      expect(order.budget).toBeDefined();
      expect(order.requirements).toBeDefined();
    });

    it('should generate budget within range', () => {
      for (let i = 0; i < 50; i++) {
        const order = generator.generateOrder();
        expect(order.budget).toBeGreaterThanOrEqual(30);
        expect(order.budget).toBeLessThanOrEqual(80);
      }
    });

    it('should have 1-5 requirements', () => {
      for (let i = 0; i < 20; i++) {
        const order = generator.generateOrder();
        expect(order.requirements.length).toBeGreaterThanOrEqual(1);
        expect(order.requirements.length).toBeLessThanOrEqual(5);
      }
    });

    it('should have requirements within budget', () => {
      const mockItems = createMockItems();
      const itemMap = new Map<string, number>();
      
      // Build a map of itemId -> cost for quick lookup
      mockItems.forEach(category => {
        category.subItems.forEach(subItem => {
          itemMap.set(subItem.id, subItem.cost);
        });
      });

      for (let i = 0; i < 20; i++) {
        const order = generator.generateOrder();
        const totalCost = order.requirements.reduce(
          (sum, req) => sum + (itemMap.get(req.itemId) || 0) * req.quantity,
          0
        );
        expect(totalCost).toBeLessThanOrEqual(order.budget);
      }
    });

    it('should have unique order IDs', () => {
      const orders = Array.from({ length: 10 }, () => generator.generateOrder());
      const ids = orders.map(o => o.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
    });

    it('should include item names in requirements', () => {
      const order = generator.generateOrder();
      order.requirements.forEach((req) => {
        expect(req.itemName).toBeDefined();
        expect(req.itemName.length).toBeGreaterThan(0);
      });
    });

    it('should have valid quantities', () => {
      for (let i = 0; i < 20; i++) {
        const order = generator.generateOrder();
        order.requirements.forEach((req) => {
          expect(req.quantity).toBeGreaterThanOrEqual(1);
          expect(req.quantity).toBeLessThanOrEqual(5);
        });
      }
    });

    it('should rarely have duplicate items', () => {
      let duplicateCount = 0;
      for (let i = 0; i < 100; i++) {
        const order = generator.generateOrder();
        const itemIds = order.requirements.map(r => r.itemId);
        const uniqueIds = new Set(itemIds);
        if (uniqueIds.size < itemIds.length) {
          duplicateCount++;
        }
      }
      // Should be rare (5% or less)
      expect(duplicateCount).toBeLessThanOrEqual(10);
    });
  });
});

// ── Progression-filtering tests ──────────────────────────────────────────────
// Uses the same jest.mock registrations above, but overrides return values per
// test group via mockReturnValue so we can isolate depth-gating behaviour.

describe('OrderGenerator — progression filtering', () => {
  // Tree-format items (nav_*_root → nav_*_down_N → leaves)
  // alpha: down_1=[leaf_a, leaf_b], down_2=[leaf_c, leaf_d]
  // beta:  down_1=[leaf_e]
  function makeNavItems() {
    return [
      {
        id: 'nav_alpha_root',
        name: 'Alpha',
        icon: 'alpha',
        children: [
          {
            id: 'nav_alpha_down_1',
            name: 'Alpha L1',
            icon: 'alpha_l1',
            children: [
              { id: 'leaf_a', name: 'Leaf A', icon: 'la', cost: 10 },
              { id: 'leaf_b', name: 'Leaf B', icon: 'lb', cost: 12 },
            ],
          },
          {
            id: 'nav_alpha_down_2',
            name: 'Alpha L2',
            icon: 'alpha_l2',
            children: [
              { id: 'leaf_c', name: 'Leaf C', icon: 'lc', cost: 14 },
              { id: 'leaf_d', name: 'Leaf D', icon: 'ld', cost: 16 },
            ],
          },
        ],
      },
      {
        id: 'nav_beta_root',
        name: 'Beta',
        icon: 'beta',
        children: [
          {
            id: 'nav_beta_down_1',
            name: 'Beta L1',
            icon: 'beta_l1',
            children: [
              { id: 'leaf_e', name: 'Leaf E', icon: 'le', cost: 18 },
            ],
          },
        ],
      },
    ];
  }

  function makeGenWith(
    unlocked: Array<{ categoryId: string; depth: number }>,
  ): OrderGenerator {
    (GameManager.getInstance as jest.Mock).mockReturnValue({
      getItems: jest.fn(() => makeNavItems()),
    });
    const depthMap = new Map(unlocked.map(c => [c.categoryId, c.depth]));
    (ProgressionManager.getInstance as jest.Mock).mockReturnValue({
      getUnlockedCategories: jest.fn(() => unlocked),
      getUnlockedDepth: jest.fn((id: string) => depthMap.get(id) ?? 0),
    });
    return new OrderGenerator();
  }

  it('excludes items from locked categories', () => {
    const gen = makeGenWith([{ categoryId: 'nav_alpha_root', depth: 2 }]);
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      gen.generateOrder().requirements.forEach(r => ids.add(r.itemId));
    }
    expect(ids.has('leaf_e')).toBe(false);
  });

  it('depth 1 exposes no nav-tree leaf items (no down_N qualifies)', () => {
    const gen = makeGenWith([{ categoryId: 'nav_alpha_root', depth: 1 }]);
    const pool = (gen as any).getAllSubItems();
    expect(pool.length).toBe(0);
  });

  it('depth 2 includes level-1 leaves, excludes level-2 leaves', () => {
    const gen = makeGenWith([{ categoryId: 'nav_alpha_root', depth: 2 }]);
    const ids = (gen as any).getAllSubItems().map((i: any) => i.id);
    expect(ids).toContain('leaf_a');
    expect(ids).toContain('leaf_b');
    expect(ids).not.toContain('leaf_c');
    expect(ids).not.toContain('leaf_d');
  });

  it('depth 3 includes both level-1 and level-2 leaves', () => {
    const gen = makeGenWith([{ categoryId: 'nav_alpha_root', depth: 3 }]);
    const ids = (gen as any).getAllSubItems().map((i: any) => i.id);
    expect(ids).toContain('leaf_a');
    expect(ids).toContain('leaf_b');
    expect(ids).toContain('leaf_c');
    expect(ids).toContain('leaf_d');
  });

  it('two unlocked categories → leaves from both appear in pool', () => {
    const gen = makeGenWith([
      { categoryId: 'nav_alpha_root', depth: 2 },
      { categoryId: 'nav_beta_root', depth: 2 },
    ]);
    const ids = (gen as any).getAllSubItems().map((i: any) => i.id);
    expect(ids).toContain('leaf_a');
    expect(ids).toContain('leaf_e');
  });

  it('pool is empty when no categories are unlocked', () => {
    const gen = makeGenWith([]);
    const pool = (gen as any).getAllSubItems();
    expect(pool.length).toBe(0);
  });
});
