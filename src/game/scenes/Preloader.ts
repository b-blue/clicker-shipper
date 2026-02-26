import { GameManager } from '../managers/GameManager';
import { SettingsManager } from '../managers/SettingsManager';
import { AssetLoader } from '../managers/AssetLoader';

export class Preloader extends Phaser.Scene {
  constructor() {
    super('Preloader');
  }

  preload() {
    // Load config and items data
    this.load.json('config', 'data/config.json');
    this.load.json('items', 'data/items.json');

    // Load bitmap font
    this.load.bitmapFont('clicker', 'assets/fonts/clicker.png', 'assets/fonts/clicker.fnt');

    // Drone spritesheets (4 frames side-by-side, 48×48 each)
    this.load.spritesheet('drone-771-idle', 'assets/drones/771-idle.png', {
      frameWidth: 48,
      frameHeight: 48,
    });
  }

  async create() {
    try {
      // Initialize GameManager with loaded data
      const gameManager = GameManager.getInstance();
      await gameManager.initialize(this, 'data/config.json', 'data/items.json');
      
      // Initialize SettingsManager
      const settingsManager = SettingsManager.getInstance();
      await settingsManager.loadSettings();
      
      const config = gameManager.getConfig();

      // Now load root dial icon (if path is specified)
      if (config.rootDialIconPath) {
        this.load.image('rootDialIcon', config.rootDialIconPath);
      }

      // Load all sprite atlases (replaces the individual per-sprite loads)
      AssetLoader.preloadAtlases(this);
      
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