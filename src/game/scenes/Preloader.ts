import { GameManager } from '../managers/GameManager';
import { AssetLoader } from '../managers/AssetLoader';

export class Preloader extends Phaser.Scene {
  constructor() {
    super('Preloader');
  }

  preload() {
    // Load config and items data
    this.load.json('config', 'data/config.json');
    this.load.json('items', 'data/items.json');
  }

  async create() {
    try {
      // Initialize GameManager with loaded data
      const gameManager = GameManager.getInstance();
      await gameManager.initialize(this, 'data/config.json', 'data/items.json');
      
      const config = gameManager.getConfig();
      const items = gameManager.getItems();
      
      // Now load root dial icon (if path is specified)
      if (config.rootDialIconPath) {
        this.load.image('rootDialIcon', config.rootDialIconPath);
      }
      
      // Load item sprite assets
      AssetLoader.preloadItemAssets(this, items);
      
      // Start load and wait for completion
      this.load.start();
      
      // Wait for all assets to load
      await new Promise<void>((resolve) => {
        this.load.once('complete', () => {
          resolve();
        });
      });
      
      // Transition to MainMenu
      this.scene.start('MainMenu');
    } catch (error) {
      console.error('Failed to initialize game:', error);
      // Fallback to MainMenu anyway for now
      this.scene.start('MainMenu');
    }
  }
}