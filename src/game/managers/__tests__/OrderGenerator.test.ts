import { OrderGenerator } from '../OrderGenerator';
import { Item, SubItem } from '../types/GameTypes';

// Mock GameManager
jest.mock('../GameManager', () => ({
  GameManager: {
    getInstance: jest.fn(() => ({
      getItems: jest.fn(() => createMockItems()),
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
