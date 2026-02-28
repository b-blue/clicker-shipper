import {
  SubItem,
  Item,
  ItemsData,
  GameConfig,
  OrderRequirement,
  Order,
} from '../GameTypes';

describe('GameTypes', () => {
  describe('SubItem', () => {
    it('should create valid SubItem', () => {
      const subItem: SubItem = {
        id: 'item_1_1',
        name: 'Test Item',
        icon: 'test_icon',
        cost: 10,
      };
      expect(subItem.id).toBe('item_1_1');
      expect(subItem.name).toBe('Test Item');
      expect(subItem.cost).toBe(10);
    });
  });

  describe('Item', () => {
    it('should create valid Item with subItems', () => {
      const item: Item = {
        id: 'item_1',
        name: 'Category',
        icon: 'cat_icon',
        subItems: [
          { id: 'item_1_1', name: 'Sub 1', icon: 'icon1', cost: 10 },
          { id: 'item_1_2', name: 'Sub 2', icon: 'icon2', cost: 20 },
        ],
      };
      expect(item.subItems.length).toBe(2);
      expect(item.subItems[0].cost).toBe(10);
    });
  });

  describe('GameConfig', () => {
    it('should create valid GameConfig', () => {
      const config: GameConfig = {
        shiftDuration: 180000,
        dialLevels: 2,
        itemsPerLevel: 6,
        quantaPerRepair: 10,
        deliveryCosts: [2, 5, 10],
        deliveryDurations: [8000, 4000, 1500],
        rootDialIconPath: 'assets/dial.png',
      };
      expect(config.shiftDuration).toBe(180000);
      expect(config.rootDialIconPath).toBe('assets/dial.png');
    });

    it('should support optional rootDialIconPath', () => {
      const config: GameConfig = {
        shiftDuration: 180000,
        dialLevels: 2,
        itemsPerLevel: 6,
        quantaPerRepair: 10,
        deliveryCosts: [2, 5, 10],
        deliveryDurations: [8000, 4000, 1500],
      };
      expect(config.rootDialIconPath).toBeUndefined();
    });
  });

  describe('OrderRequirement', () => {
    it('should create valid OrderRequirement', () => {
      const req: OrderRequirement = {
        itemId: 'item_1_1',
        itemName: 'Test Item',
        iconKey: 'icon-1',
        quantity: 2,
        fulfilled: 0,
        cost: 10,
      };
      expect(req.itemId).toBe('item_1_1');
      expect(req.quantity).toBe(2);
    });
  });

  describe('Order', () => {
    it('should create valid Order', () => {
      const order: Order = {
        id: 'order_1',
        budget: 100,
        requirements: [
          { itemId: 'item_1_1', itemName: 'Item 1', iconKey: 'icon-1', quantity: 1, fulfilled: 0, cost: 5 },
          { itemId: 'item_1_2', itemName: 'Item 2', iconKey: 'icon-2', quantity: 2, fulfilled: 0, cost: 8 },
        ],
      };
      expect(order.requirements.length).toBe(2);
      expect(order.budget).toBe(100);
    });
  });

  describe('ItemsData', () => {
    it('should create valid ItemsData', () => {
      const itemsData: ItemsData = {
        items: [
          {
            id: 'item_1',
            name: 'Category',
            icon: 'icon',
            subItems: [
              { id: 'item_1_1', name: 'Item', icon: 'icon1', cost: 10 },
            ],
          },
        ],
      };
      expect(itemsData.items.length).toBe(1);
      expect(itemsData.items[0].subItems.length).toBe(1);
    });
  });
});
