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

      // Should call load.image 3 times (once for each sub-item)
      expect(mockScene.load.image).toHaveBeenCalledTimes(3);
      expect(mockScene.load.image).toHaveBeenCalledWith('item_1_1', 'assets/items/item_1_1.png');
      expect(mockScene.load.image).toHaveBeenCalledWith('item_1_2', 'assets/items/item_1_2.png');
      expect(mockScene.load.image).toHaveBeenCalledWith('item_2_1', 'assets/items/item_2_1.png');
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
      expect(mockScene.load.image).not.toHaveBeenCalled();
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
      expect(mockScene.load.image).toHaveBeenCalledWith(
        'item_5_3',
        'assets/items/item_5_3.png'
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
      expect(mockScene.load.image).toHaveBeenCalledTimes(36);
    });
  });
});
