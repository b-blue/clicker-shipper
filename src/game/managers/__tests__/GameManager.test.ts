import { GameManager } from '../GameManager';
import { GameConfig, ItemsData } from '../types/GameTypes';

describe('GameManager', () => {
  let gameManager: GameManager;

  beforeEach(() => {
    // Reset the singleton instance for each test
    (GameManager as any).instance = undefined;
    gameManager = GameManager.getInstance();
  });

  /** Build a minimal scene mock whose JSON cache returns the given fixtures. */
  const makeScene = (config: GameConfig, itemsData: ItemsData): any => ({
    cache: {
      json: {
        get: jest.fn((key: string) => {
          if (key === 'config') return config;
          if (key === 'items')  return itemsData;
          return null;
        }),
      },
    },
  });

  describe('getInstance', () => {
    it('should return the same instance on multiple calls', () => {
      const manager1 = GameManager.getInstance();
      const manager2 = GameManager.getInstance();
      expect(manager1).toBe(manager2);
    });

    it('should be a singleton', () => {
      const instance = GameManager.getInstance();
      expect(instance).toBeDefined();
      expect(GameManager.getInstance()).toBe(instance);
    });
  });

  describe('initialize', () => {
    it('reads config and items from the Phaser JSON cache (no re-fetch)', async () => {
      const mockConfig: GameConfig = {
        shiftDuration: 180000,
        dialLevels: 2,
        itemsPerLevel: 6,
      };

      const mockItemsData: ItemsData = {
        items: [
          {
            id: 'cat1',
            name: 'Category 1',
            icon: 'icon1',
            subItems: [
              { id: 'item1', name: 'Item 1', icon: 'icon1', cost: 10 },
            ],
          },
        ],
      };

      const mockScene = makeScene(mockConfig, mockItemsData);

      await gameManager.initialize(mockScene, 'data/config.json', 'data/items.json');

      // Resolves cache keys from path: 'data/config.json' → 'config', etc.
      expect(mockScene.cache.json.get).toHaveBeenCalledWith('config');
      expect(mockScene.cache.json.get).toHaveBeenCalledWith('items');
      expect(gameManager.getConfig()).toEqual(mockConfig);
      expect(gameManager.getItems()).toHaveLength(1);
    });
  });

  describe('getConfig', () => {
    it('should throw error if not initialized', () => {
      expect(() => {
        gameManager.getConfig();
      }).toThrow('not initialized');
    });

    it('should return config after initialization', async () => {
      const mockConfig: GameConfig = {
        shiftDuration: 180000,
        dialLevels: 2,
        itemsPerLevel: 6,
      };

      const mockScene = makeScene(mockConfig, { items: [] });

      await gameManager.initialize(mockScene, 'data/config.json', 'data/items.json');
      const config = gameManager.getConfig();

      expect(config.shiftDuration).toBe(180000);
      expect(config.dialLevels).toBe(2);
    });
  });

  describe('getItems', () => {
    it('should return empty array if not initialized', () => {
      const items = gameManager.getItems();
      expect(Array.isArray(items)).toBe(true);
      expect(items).toHaveLength(0);
    });

    it('should return items after initialization', async () => {
      const mockConfig: GameConfig = {
        shiftDuration: 180000,
        dialLevels: 2,
        itemsPerLevel: 6,
      };

      const mockItemsData: ItemsData = {
        items: [
          {
            id: 'cat1',
            name: 'Category 1',
            icon: 'icon1',
            subItems: [
              { id: 'item1', name: 'Item 1', icon: 'icon1', cost: 10 },
              { id: 'item2', name: 'Item 2', icon: 'icon2', cost: 20 },
            ],
          },
        ],
      };

      const mockScene = makeScene(mockConfig, mockItemsData);

      await gameManager.initialize(mockScene, 'data/config.json', 'data/items.json');
      const items = gameManager.getItems();

      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('cat1');
      expect(items[0].subItems).toHaveLength(2);
    });
  });

  describe('getShiftDuration', () => {
    it('should return shift duration from config', async () => {
      const mockConfig: GameConfig = {
        shiftDuration: 180000,
        dialLevels: 2,
        itemsPerLevel: 6,
      };

      const mockScene = makeScene(mockConfig, { items: [] });

      await gameManager.initialize(mockScene, 'data/config.json', 'data/items.json');
      const duration = gameManager.getShiftDuration();

      expect(duration).toBe(180000);
    });

    it('should throw error if called before initialization', () => {
      expect(() => {
        gameManager.getShiftDuration();
      }).toThrow();
    });
  });
});

