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
    this.config = await this.loadJSON<GameConfig>(scene, configPath);
    const itemsData = await this.loadJSON<ItemsData>(scene, itemsPath);
    this.items = itemsData.items;
  }

  private loadJSON<T>(scene: Phaser.Scene, path: string): Promise<T> {
    return new Promise((resolve, reject) => {
      scene.load.json('tempJson', path);
      scene.load.once('complete', () => {
        const data = scene.cache.json.get('tempJson');
        scene.cache.json.remove('tempJson');
        resolve(data as T);
      });
      scene.load.once('loaderror', () => {
        reject(new Error(`Failed to load ${path}`));
      });
      scene.load.start();
    });
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