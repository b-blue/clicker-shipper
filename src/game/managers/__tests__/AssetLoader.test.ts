import { AssetLoader } from '../AssetLoader';
import { Item, SubItem } from '../types/GameTypes';

describe('AssetLoader', () => {
  let mockScene: any;

  beforeEach(() => {
    mockScene = {
      load: {
        image: jest.fn(),
      },
    };
  });

  describe('preloadItemAssets', () => {
    it('should preload all item assets', () => {
      const items: Item[] = [
        {
          id: 'item_1',
          name: 'Category 1',
          icon: 'icon1',
          subItems: [
            { id: 'item_1_1', name: 'Item 1', icon: 'icon1', cost: 10 },
            { id: 'item_1_2', name: 'Item 2', icon: 'icon2', cost: 15 },
          ],
        },
        {
          id: 'item_2',
          name: 'Category 2',
          icon: 'icon3',
          subItems: [
            { id: 'item_2_1', name: 'Item 3', icon: 'icon4', cost: 20 },
          ],
        },
      ];

      AssetLoader.preloadItemAssets(mockScene, items);

      // Should call load.image 5 times (2 categories + 3 sub-items)
      expect(mockScene.load.image).toHaveBeenCalledTimes(5);
      expect(mockScene.load.image).toHaveBeenCalledWith('icon1', 'assets/items/icon1.png');
      expect(mockScene.load.image).toHaveBeenCalledWith('icon1', 'assets/items/icon1.png');
      expect(mockScene.load.image).toHaveBeenCalledWith('icon2', 'assets/items/icon2.png');
      expect(mockScene.load.image).toHaveBeenCalledWith('icon3', 'assets/items/icon3.png');
      expect(mockScene.load.image).toHaveBeenCalledWith('icon4', 'assets/items/icon4.png');
    });

    it('should handle empty items', () => {
      AssetLoader.preloadItemAssets(mockScene, []);
      expect(mockScene.load.image).not.toHaveBeenCalled();
    });

    it('should handle items with no sub-items', () => {
      const items: Item[] = [
        {
          id: 'item_1',
          name: 'Category',
          icon: 'icon',
          subItems: [],
        },
      ];

      AssetLoader.preloadItemAssets(mockScene, items);
      // Category image should still be loaded even with no sub-items
      expect(mockScene.load.image).toHaveBeenCalledTimes(1);
      expect(mockScene.load.image).toHaveBeenCalledWith('icon', 'assets/items/icon.png');
    });

    it('should construct correct asset paths', () => {
      const items: Item[] = [
        {
          id: 'item_5',
          name: 'Category',
          icon: 'icon',
          subItems: [
            { id: 'item_5_3', name: 'Item', icon: 'icon', cost: 10 },
          ],
        },
      ];

      AssetLoader.preloadItemAssets(mockScene, items);
      // Should call load.image 2 times (1 category + 1 sub-item)
      expect(mockScene.load.image).toHaveBeenCalledTimes(2);
      expect(mockScene.load.image).toHaveBeenCalledWith('icon', 'assets/items/icon.png');
      expect(mockScene.load.image).toHaveBeenCalledWith(
        'icon',
        'assets/items/icon.png'
      );
    });

    it('should handle many items', () => {
      const subItems: SubItem[] = Array.from({ length: 36 }, (_, i) => ({
        id: `item_1_${i + 1}`,
        name: `Item ${i + 1}`,
        icon: `icon${i + 1}`,
        cost: 10 + i,
      }));

      const items: Item[] = [
        {
          id: 'item_1',
          name: 'Category',
          icon: 'icon',
          subItems,
        },
      ];

      AssetLoader.preloadItemAssets(mockScene, items);
      // Should call load.image 37 times (1 category + 36 sub-items)
      expect(mockScene.load.image).toHaveBeenCalledTimes(37);
    });
  });
});
