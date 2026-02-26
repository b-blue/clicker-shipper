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
    this.load.json('rad-dial', 'data/rad-dial.json');

    // Load bitmap font
    this.load.bitmapFont('clicker', 'assets/fonts/clicker.png', 'assets/fonts/clicker.fnt');

    // Drone animation strips — loaded as plain images; frame layout is detected
    // at runtime in buildDroneContent (frameWidth = textureHeight, square frames).
    // Key convention: drone-{id}-{animation}.
    const DRONE_FILE_MANIFEST: Array<[string, string]> = [
      ['drone-1-death',    'assets/drones/1/Death.png'],
      ['drone-1-idle',     'assets/drones/1/Idle.png'],
      ['drone-1-scan',     'assets/drones/1/Scan.png'],
      ['drone-1-walk',     'assets/drones/1/Walk.png'],
      ['drone-1-walkscan', 'assets/drones/1/Walk_scan.png'],
      ['drone-2-bomb',     'assets/drones/2/Bomb.png'],
      ['drone-2-drop',     'assets/drones/2/Drop.png'],
      ['drone-3-back',     'assets/drones/3/Back.png'],
      ['drone-3-death',    'assets/drones/3/Death.png'],
      ['drone-3-fire1',    'assets/drones/3/Fire1.png'],
      ['drone-3-fire2',    'assets/drones/3/Fire2.png'],
      ['drone-3-fire3',    'assets/drones/3/Fire3.png'],
      ['drone-3-forward',  'assets/drones/3/Forward.png'],
      ['drone-3-idle',     'assets/drones/3/Idle.png'],
      ['drone-4-death',    'assets/drones/4/Death.png'],
      ['drone-4-idle',     'assets/drones/4/Idle.png'],
      ['drone-4-landing',  'assets/drones/4/Landing.png'],
      ['drone-4-walk',     'assets/drones/4/Walk.png'],
      ['drone-5-death',    'assets/drones/5/Death.png'],
      ['drone-5-idle',     'assets/drones/5/Idle.png'],
      ['drone-5-walk',     'assets/drones/5/Walk.png'],
      ['drone-5b-death',   'assets/drones/5_2/Death.png'],
      ['drone-5b-idle',    'assets/drones/5_2/Idle.png'],
      ['drone-5b-walk',    'assets/drones/5_2/Walk.png'],
      ['drone-6-capsule',  'assets/drones/6/Capsule.png'],
      ['drone-6-drop',     'assets/drones/6/Drop.png'],
      ['drone-6-walk',     'assets/drones/6/Walk.png'],
      ['drone-6-walk2',    'assets/drones/6/Walk2.png'],
    ];
    for (const [key, path] of DRONE_FILE_MANIFEST) {
      this.load.image(key, path);
    }
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