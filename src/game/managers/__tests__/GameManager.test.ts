import { GameManager } from '../GameManager';
import { GameConfig, ItemsData } from '../types/GameTypes';

describe('GameManager', () => {
  let gameManager: GameManager;

  beforeEach(() => {
    // Reset the singleton instance for each test
    (GameManager as any).instance = undefined;
    gameManager = GameManager.getInstance();
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
    it('should load config and items successfully', async () => {
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

      const mockScene: any = {
        load: {
          json: jest.fn(),
          once: jest.fn((event, callback) => {
            if (event === 'complete') {
              setTimeout(callback, 0);
            }
          }),
          start: jest.fn(),
        },
        cache: {
          json: {
            get: jest.fn()
              .mockReturnValueOnce(mockConfig)
              .mockReturnValueOnce(mockItemsData),
            remove: jest.fn(),
          },
        },
      };

      await gameManager.initialize(mockScene, 'data/config.json', 'data/items.json');

      expect(mockScene.load.json).toHaveBeenCalledWith('tempJson', 'data/config.json');
      expect(mockScene.load.json).toHaveBeenCalledWith('tempJson', 'data/items.json');
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

      const mockItemsData: ItemsData = {
        items: [],
      };

      const mockScene: any = {
        load: {
          json: jest.fn(),
          once: jest.fn((event, callback) => {
            if (event === 'complete') {
              setTimeout(callback, 0);
            }
          }),
          start: jest.fn(),
        },
        cache: {
          json: {
            get: jest.fn()
              .mockReturnValueOnce(mockConfig)
              .mockReturnValueOnce(mockItemsData),
            remove: jest.fn(),
          },
        },
      };

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

      const mockScene: any = {
        load: {
          json: jest.fn(),
          once: jest.fn((event, callback) => {
            if (event === 'complete') {
              setTimeout(callback, 0);
            }
          }),
          start: jest.fn(),
        },
        cache: {
          json: {
            get: jest.fn()
              .mockReturnValueOnce(mockConfig)
              .mockReturnValueOnce(mockItemsData),
            remove: jest.fn(),
          },
        },
      };

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

      const mockItemsData: ItemsData = {
        items: [],
      };

      const mockScene: any = {
        load: {
          json: jest.fn(),
          once: jest.fn((event, callback) => {
            if (event === 'complete') {
              setTimeout(callback, 0);
            }
          }),
          start: jest.fn(),
        },
        cache: {
          json: {
            get: jest.fn()
              .mockReturnValueOnce(mockConfig)
              .mockReturnValueOnce(mockItemsData),
            remove: jest.fn(),
          },
        },
      };

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

