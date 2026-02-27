import { NavigationController } from '../NavigationController';
import { MenuItem } from '../../types/GameTypes';

describe('NavigationController', () => {
  let rootItems: MenuItem[];
  let controller: NavigationController;

  beforeEach(() => {
    // Create a test hierarchy
    rootItems = [
      {
        id: 'item_1',
        name: 'Category 1',
        icon: 'item_1',
        children: [
          {
            id: 'item_1_1',
            name: 'Sub-Category 1.1',
            icon: 'item_1_1',
            children: [
              {
                id: 'item_1_1_1',
                name: 'Leaf Item 1.1.1',
                icon: 'item_1_1_1',
                cost: 10
              },
              {
                id: 'item_1_1_2',
                name: 'Leaf Item 1.1.2',
                icon: 'item_1_1_2',
                cost: 15
              }
            ]
          },
          {
            id: 'item_1_2',
            name: 'Sub-Category 1.2',
            icon: 'item_1_2',
            children: [
              {
                id: 'item_1_2_1',
                name: 'Leaf Item 1.2.1',
                icon: 'item_1_2_1',
                cost: 20
              }
            ]
          }
        ]
      },
      {
        id: 'item_2',
        name: 'Category 2',
        icon: 'item_2',
        children: [
          {
            id: 'item_2_1',
            name: 'Sub-Category 2.1',
            icon: 'item_2_1'
          }
        ]
      },
      {
        id: 'item_3',
        name: 'Leaf Category',
        icon: 'item_3',
        cost: 50
      }
    ];

    controller = new NavigationController(rootItems);
  });

  describe('constructor', () => {
    it('should initialize with root items', () => {
      expect(controller.getCurrentItems()).toEqual(rootItems);
    });

    it('should start at depth 0', () => {
      expect(controller.getDepth()).toBe(0);
    });

    it('should have canGoBack false at root', () => {
      expect(controller.canGoBack()).toBe(false);
    });
  });

  describe('getCurrentItems', () => {
    it('should return root items initially', () => {
      expect(controller.getCurrentItems()).toEqual(rootItems);
    });

    it('should return current level items after drilling down', () => {
      const firstItem = rootItems[0];
      controller.drillDown(firstItem);
      expect(controller.getCurrentItems()).toEqual(firstItem.children);
    });

    it('should return updated items after each drill down', () => {
      const item1 = rootItems[0];
      const item1_1 = item1.children![0];

      controller.drillDown(item1);
      expect(controller.getCurrentItems()).toHaveLength(2);

      controller.drillDown(item1_1);
      expect(controller.getCurrentItems()).toHaveLength(2);
      expect(controller.getCurrentItems()[0].id).toBe('item_1_1_1');
    });
  });

  describe('isNavigable', () => {
    it('should return true for items with children', () => {
      const navItem = rootItems[0];
      expect(controller.isNavigable(navItem)).toBe(true);
    });

    it('should return false for leaf items (no children)', () => {
      const leafItem = rootItems[2];
      expect(controller.isNavigable(leafItem)).toBe(false);
    });

    it('should return false for items with empty children array', () => {
      const itemWithEmptyChildren: MenuItem = {
        id: 'test',
        name: 'Test',
        icon: 'test',
        children: []
      };
      expect(controller.isNavigable(itemWithEmptyChildren)).toBe(false);
    });

    it('should correctly identify navigability at any depth', () => {
      const item1 = rootItems[0];
      const item1_1 = item1.children![0];

      controller.drillDown(item1);
      expect(controller.isNavigable(item1_1)).toBe(true);

      // Drill deeper
      controller.drillDown(item1_1);
      const leaf = item1_1.children![0];
      expect(controller.isNavigable(leaf)).toBe(false);
    });
  });

  describe('drillDown', () => {
    it('should drill into items with children', () => {
      const item1 = rootItems[0];
      const result = controller.drillDown(item1);

      expect(result).toEqual(item1.children);
      expect(controller.getCurrentItems()).toEqual(item1.children);
      expect(controller.getDepth()).toBe(1);
    });

    it('should return empty array for leaf items', () => {
      const leafItem = rootItems[2];
      const result = controller.drillDown(leafItem);

      expect(result).toEqual([]);
      expect(controller.getDepth()).toBe(0);
    });

    it('should allow drilling multiple levels deep', () => {
      const item1 = rootItems[0];
      const item1_1 = item1.children![0];

      controller.drillDown(item1);
      expect(controller.getDepth()).toBe(1);

      controller.drillDown(item1_1);
      expect(controller.getDepth()).toBe(2);
    });

    it('should handle arbitrary depth', () => {
      const item1 = rootItems[0];
      const item1_1 = item1.children![0];

      controller.drillDown(item1);
      controller.drillDown(item1_1);

      expect(controller.getDepth()).toBe(2);
      expect(controller.canGoBack()).toBe(true);
    });
  });

  describe('goBack', () => {
    it('should return null when at root', () => {
      const result = controller.goBack();
      expect(result).toBeNull();
    });

    it('should go back to parent level', () => {
      const item1 = rootItems[0];
      controller.drillDown(item1);
      expect(controller.getDepth()).toBe(1);

      const result = controller.goBack();
      expect(result).toEqual(rootItems);
      expect(controller.getDepth()).toBe(0);
    });

    it('should return the parent items on goBack', () => {
      const item1 = rootItems[0];
      const item1_1 = item1.children![0];

      controller.drillDown(item1);
      controller.drillDown(item1_1);

      const result = controller.goBack();
      expect(result).toEqual(item1.children);
      expect(controller.getDepth()).toBe(1);
    });

    it('should allow multiple goBack calls', () => {
      const item1 = rootItems[0];
      const item1_1 = item1.children![0];

      controller.drillDown(item1);
      controller.drillDown(item1_1);
      expect(controller.getDepth()).toBe(2);

      controller.goBack();
      expect(controller.getDepth()).toBe(1);

      controller.goBack();
      expect(controller.getDepth()).toBe(0);

      const result = controller.goBack();
      expect(result).toBeNull();
      expect(controller.getDepth()).toBe(0);
    });
  });

  describe('getDepth', () => {
    it('should return 0 at root', () => {
      expect(controller.getDepth()).toBe(0);
    });

    it('should increment with each drill down', () => {
      const item1 = rootItems[0];
      const item1_1 = item1.children![0];

      controller.drillDown(item1);
      expect(controller.getDepth()).toBe(1);

      controller.drillDown(item1_1);
      expect(controller.getDepth()).toBe(2);
    });

    it('should decrement with each goBack', () => {
      const item1 = rootItems[0];
      const item1_1 = item1.children![0];

      controller.drillDown(item1);
      controller.drillDown(item1_1);
      expect(controller.getDepth()).toBe(2);

      controller.goBack();
      expect(controller.getDepth()).toBe(1);

      controller.goBack();
      expect(controller.getDepth()).toBe(0);
    });
  });

  describe('canGoBack', () => {
    it('should return false at root', () => {
      expect(controller.canGoBack()).toBe(false);
    });

    it('should return true when not at root', () => {
      const item1 = rootItems[0];
      controller.drillDown(item1);

      expect(controller.canGoBack()).toBe(true);
    });

    it('should return false after going back to root', () => {
      const item1 = rootItems[0];
      controller.drillDown(item1);
      controller.goBack();

      expect(controller.canGoBack()).toBe(false);
    });
  });

  describe('reset', () => {
    it('should return to root level', () => {
      const item1 = rootItems[0];
      const item1_1 = item1.children![0];

      controller.drillDown(item1);
      controller.drillDown(item1_1);
      expect(controller.getDepth()).toBe(2);

      const result = controller.reset();
      expect(result).toEqual(rootItems);
      expect(controller.getDepth()).toBe(0);
    });

    it('should return root items', () => {
      const item1 = rootItems[0];
      controller.drillDown(item1);

      const result = controller.reset();
      expect(result).toEqual(rootItems);
    });

    it('should allow navigation after reset', () => {
      const item1 = rootItems[0];
      controller.drillDown(item1);
      controller.reset();

      const item2 = rootItems[1];
      controller.drillDown(item2);
      expect(controller.getDepth()).toBe(1);
    });
  });

  describe('getPath', () => {
    it('should return empty array at root', () => {
      expect(controller.getPath()).toEqual([]);
    });

    it('should return parent id after drilling down one level', () => {
      const item1 = rootItems[0];
      controller.drillDown(item1);

      expect(controller.getPath()).toEqual(['item_1']);
    });

    it('should return full path for deep navigation', () => {
      const item1 = rootItems[0];
      const item1_1 = item1.children![0];

      controller.drillDown(item1);
      controller.drillDown(item1_1);

      expect(controller.getPath()).toEqual(['item_1', 'item_1_1']);
    });

    it('should update path after goBack', () => {
      const item1 = rootItems[0];
      const item1_1 = item1.children![0];

      controller.drillDown(item1);
      controller.drillDown(item1_1);
      expect(controller.getPath()).toEqual(['item_1', 'item_1_1']);

      controller.goBack();
      expect(controller.getPath()).toEqual(['item_1']);
    });

    it('should work after reset', () => {
      const item1 = rootItems[0];
      controller.drillDown(item1);
      controller.reset();

      expect(controller.getPath()).toEqual([]);

      const item2 = rootItems[1];
      controller.drillDown(item2);
      expect(controller.getPath()).toEqual(['item_2']);
    });
  });

  describe('getScaleForDepth', () => {
    it('should return 2.1 at depth 0', () => {
      expect(controller.getScaleForDepth()).toBe(2.1);
    });

    it('should return 2.1 at depth 1', () => {
      const item1 = rootItems[0];
      controller.drillDown(item1);

      expect(controller.getScaleForDepth()).toBe(2.1);
    });

    it('should return 2.1 at depth 2', () => {
      const item1 = rootItems[0];
      const item1_1 = item1.children![0];

      controller.drillDown(item1);
      controller.drillDown(item1_1);

      expect(controller.getScaleForDepth()).toBe(2.1);
    });

    it('should remain constant for each depth level', () => {
      const item1 = rootItems[0];
      const item1_1 = item1.children![0];

      expect(controller.getScaleForDepth()).toBe(2.1);

      controller.drillDown(item1);
      expect(controller.getScaleForDepth()).toBe(2.1);

      controller.drillDown(item1_1);
      expect(controller.getScaleForDepth()).toBe(2.1);
    });

    it('should not go below 0.6', () => {
      // Create a deeply nested structure
      let current: MenuItem = {
        id: 'deep_0',
        name: 'Level 0',
        icon: 'deep_0',
        children: []
      };

      for (let i = 1; i <= 10; i++) {
        current = {
          id: `deep_${i}`,
          name: `Level ${i}`,
          icon: `deep_${i}`,
          children: [current]
        };
      }

      const deepController = new NavigationController([current]);

      // Drill down 10 levels
      let item = current;
      for (let i = 0; i < 10; i++) {
        deepController.drillDown(item);
        if (item.children?.length) {
          item = item.children[0];
        }
      }

      const scale = deepController.getScaleForDepth();
      expect(scale).toBe(2.1);
    });
  });

  describe('edge cases', () => {
    it('should handle items with no children property', () => {
      const itemWithoutChildren: MenuItem = {
        id: 'test',
        name: 'Test Item',
        icon: 'test'
        // No children property
      };

      expect(controller.isNavigable(itemWithoutChildren)).toBe(false);
    });

    it('should handle drilling into sibling items at same level', () => {
      const item1 = rootItems[0];
      const item2 = rootItems[1];

      controller.drillDown(item1);
      expect(controller.getPath()).toEqual(['item_1']);

      controller.goBack();
      controller.drillDown(item2);
      expect(controller.getPath()).toEqual(['item_2']);
    });

    it('should maintain state correctly through complex navigation', () => {
      const item1 = rootItems[0];
      const item1_1 = item1.children![0];
      const item1_2 = item1.children![1];

      // Drill into item_1_1
      controller.drillDown(item1);
      controller.drillDown(item1_1);
      expect(controller.getPath()).toEqual(['item_1', 'item_1_1']);

      // Go back and drill into item_1_2
      controller.goBack();
      controller.drillDown(item1_2);
      expect(controller.getPath()).toEqual(['item_1', 'item_1_2']);
    });
  });
});
