import { GameManager } from '../managers/GameManager';

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
      
      // Transition to MainMenu
      this.scene.start('MainMenu');
    } catch (error) {
      console.error('Failed to initialize game:', error);
      // Fallback to MainMenu anyway for now
      this.scene.start('MainMenu');
    }
  }
}