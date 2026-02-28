import { GameManager } from '../GameManager';
import { GameConfig } from '../../types/GameTypes';

describe('GameManager', () => {
  let gameManager: GameManager;

  beforeEach(() => {
    // Reset the singleton instance for each test
    (GameManager as any).instance = undefined;
    gameManager = GameManager.getInstance();
  });

  /** Build a minimal scene mock whose JSON cache returns the given fixtures. */
  const makeScene = (config: GameConfig, radDial: any = null, modeItems: Record<string, any> = {}): any => ({
    cache: {
      json: {
        get: jest.fn((key: string) => {
          if (key === 'config')   return config;
          if (key === 'rad-dial') return radDial;
          if (key in modeItems)  return modeItems[key];
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
    it('reads config from the Phaser JSON cache (no re-fetch)', async () => {
      const mockConfig: GameConfig = {
        shiftDuration: 180000,
        dialLevels: 2,
        itemsPerLevel: 6,
        quantaPerRepair: 10,
        deliveryCosts: [2, 5, 10],
        deliveryDurations: [8000, 4000, 1500],
      };

      const mockScene = makeScene(mockConfig);

      await gameManager.initialize(mockScene, 'data/config.json');

      // Resolves cache key from path: 'data/config.json' → 'config'
      expect(mockScene.cache.json.get).toHaveBeenCalledWith('config');
      expect(gameManager.getConfig()).toEqual(mockConfig);
    });

    it('builds mode stores from rad-dial.json action entries', async () => {
      const mockConfig: GameConfig = { shiftDuration: 180000, dialLevels: 2, itemsPerLevel: 5, quantaPerRepair: 10, deliveryCosts: [2, 5, 10], deliveryDurations: [8000, 4000, 1500] };
      const radDial = {
        actions: [
          { id: 'action_reorient', name: 'RE-ORIENT', icon: 'skill-gear', terminalMode: 'reorient',
            enabled: true, itemsFile: 'data/modes/reorient/items.json' },
        ],
      };
      const modeItems = {
        action_reorient: [
          { id: 'item_001', name: 'ITEM A', icon: 'resource1', cost: 10 },
          { id: 'item_002', name: 'ITEM B', icon: 'resource2', cost: 12 },
        ],
      };
      const mockScene = makeScene(mockConfig, radDial, modeItems);

      await gameManager.initialize(mockScene, 'data/config.json');

      const store = gameManager.getModeStore('action_reorient');
      expect(store).toBeDefined();
      expect(store!.flat).toHaveLength(2);
      expect(store!.flat[0].id).toBe('item_001');
    });

    it('paginated navTree wraps into pages of itemsPerLevel', async () => {
      const mockConfig: GameConfig = { shiftDuration: 180000, dialLevels: 2, itemsPerLevel: 2, quantaPerRepair: 10, deliveryCosts: [2, 5, 10], deliveryDurations: [8000, 4000, 1500] };
      const radDial = {
        actions: [
          { id: 'action_reorient', name: 'RE-ORIENT', icon: 'skill-gear', terminalMode: 'reorient',
            enabled: true, itemsFile: 'data/modes/reorient/items.json' },
        ],
      };
      // 3 items with pageSize=2 → page1=[A,B] + navDown→[C]
      const modeItems = {
        action_reorient: [
          { id: 'item_A', name: 'A', icon: 'a', cost: 1 },
          { id: 'item_B', name: 'B', icon: 'b', cost: 2 },
          { id: 'item_C', name: 'C', icon: 'c', cost: 3 },
        ],
      };
      const mockScene = makeScene(mockConfig, radDial, modeItems);

      await gameManager.initialize(mockScene, 'data/config.json');

      const store = gameManager.getModeStore('action_reorient');
      expect(store!.navTree).toHaveLength(3); // A, B, navDown
      const navDown = store!.navTree.find(n => n.id.startsWith('nav_page_down'));
      expect(navDown).toBeDefined();
      expect(navDown!.children).toHaveLength(1);
      expect(navDown!.children![0].id).toBe('item_C');
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
        quantaPerRepair: 10,
        deliveryCosts: [2, 5, 10],
        deliveryDurations: [8000, 4000, 1500],
      };

      const mockScene = makeScene(mockConfig);

      await gameManager.initialize(mockScene, 'data/config.json');
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
  });

  describe('getShiftDuration', () => {
    it('should return shift duration from config', async () => {
      const mockConfig: GameConfig = {
        shiftDuration: 180000,
        dialLevels: 2,
        itemsPerLevel: 6,
        quantaPerRepair: 10,
        deliveryCosts: [2, 5, 10],
        deliveryDurations: [8000, 4000, 1500],
      };

      const mockScene = makeScene(mockConfig, { items: [] });

      await gameManager.initialize(mockScene, 'data/config.json');
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

