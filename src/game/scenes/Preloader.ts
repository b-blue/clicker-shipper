import { GameManager } from '../managers/GameManager';
import { AssetLoader } from '../../managers/AssetLoader';

export class Preloader extends Phaser.Scene {
  constructor() {
    super('Preloader');
  }

  preload() {
    // Load config and items data
    this.load.json('config', 'data/config.json');
    this.load.json('items', 'data/items.json');

    // Auto-load item sprite assets
    this.load.once('complete', () => {
      const itemsData = this.cache.json.get('items');
      if (itemsData && itemsData.items) {
        AssetLoader.preloadItemAssets(this, itemsData.items);
      }
    });
  }

  async create() {
    try {
      // Initialize GameManager with loaded data
      const gameManager = GameManager.getInstance();
      await gameManager.initialize(this, 'data/config.json', 'data/items.json');
      
      // Transition to MainMenu
      this.scene.start('MainMenu');
    } catch (error) {
      console.error('Failed to initialize game:', error);
      // Fallback to MainMenu anyway for now
      this.scene.start('MainMenu');
    }
  }
}