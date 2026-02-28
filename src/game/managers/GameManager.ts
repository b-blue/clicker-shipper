import { GameConfig, ItemsData, Item } from '../types/GameTypes';

export class GameManager {
  private static instance: GameManager;
  private config: GameConfig | null = null;
  private items: Item[] = [];

  private constructor() {}

  static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager();
    }
    return GameManager.instance;
  }

  async initialize(scene: Phaser.Scene, configPath: string, itemsPath: string): Promise<void> {
    // Both files are queued in Preloader.preload() so they are already in the
    // Phaser JSON cache by the time create() calls this — no re-fetch needed.
    // Derive cache keys from paths: 'data/config.json' → 'config', etc.
    const configKey  = configPath.split('/').pop()!.replace('.json', '');
    const itemsKey   = itemsPath.split('/').pop()!.replace('.json', '');
    this.config      = scene.cache.json.get(configKey) as GameConfig;
    const itemsData  = scene.cache.json.get(itemsKey)  as ItemsData;
    this.items = itemsData.items;
  }

  getConfig(): GameConfig {
    if (!this.config) {
      throw new Error('GameManager not initialized. Call initialize() first.');
    }
    return this.config;
  }

  getItems(): Item[] {
    return this.items;
  }

  getShiftDuration(): number {
    return this.getConfig().shiftDuration;
  }
}