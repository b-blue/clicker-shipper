import { RadialDial } from '../ui/RadialDial';
import { GameManager } from '../managers/GameManager';
import { SettingsManager } from '../managers/SettingsManager';
import { Colors } from '../constants/Colors';

export class Game extends Phaser.Scene {
  private radialDial: RadialDial | null = null;

  constructor() {
    super('Game');
  }

  create() {
    try {
      const gameManager = GameManager.getInstance();
      const items = gameManager.getItems();

      // Calculate dial position based on viewport (responsive)
      const gameWidth = this.cameras.main.width;
      const gameHeight = this.cameras.main.height;
      
      // Load dial position from settings
      const settingsManager = SettingsManager.getInstance();
      const dialSettings = settingsManager.getDialSettings();
      const dialX = gameWidth + dialSettings.offsetX;
      const dialY = gameHeight + dialSettings.offsetY;

      // Background
      this.add.rectangle(gameWidth / 2, gameHeight / 2, gameWidth, gameHeight, Colors.BACKGROUND_DARK);

      // HUD strip (holographic panel)
      this.add.rectangle(gameWidth / 2, 28, gameWidth - 24, 40, Colors.PANEL_DARK, 0.75);

      // Catalog button (bottom left)
      const manualX = 80;
      const manualY = gameHeight - 40;
      const manualWidth = 140;
      const manualHeight = 34;
      const manualBg = this.add.rectangle(manualX, manualY, manualWidth, manualHeight, Colors.PANEL_DARK, 0.9);
      manualBg.setStrokeStyle(2, Colors.HIGHLIGHT_YELLOW);
      manualBg.setInteractive();
      manualBg.on('pointerdown', () => this.scene.launch('ItemManual'));
      manualBg.on('pointerover', () => manualBg.setFillStyle(Colors.BUTTON_HOVER, 0.95));
      manualBg.on('pointerout', () => manualBg.setFillStyle(Colors.PANEL_DARK, 0.9));
      this.add.bitmapText(manualX, manualY, 'clicker', 'CATALOG', 13)
        .setOrigin(0.5);
      this.radialDial = new RadialDial(this, dialX, dialY, items);

      // Listen for item confirmation (hold-to-confirm on center)
      this.events.on('dial:itemConfirmed', (data: { item: any }) => {
        console.log('Item confirmed:', data.item.name, 'Cost:', data.item.cost);
        // Add to order bucket, check budget, etc.
      });

      // Listen for level changes (when drilling into sub-items)
      this.events.on('dial:levelChanged', (data: { level: number; item: any }) => {
        console.log('Entered submenu for:', data.item.name);
      });

      // Listen for going back (tap center to return to root)
      this.events.on('dial:goBack', () => {
        console.log('Returned to main menu');
      });

      const buildHash = '84BEE6B';
      this.add.rectangle(100, 16, 160, 20, Colors.PANEL_MEDIUM, 0.85);
      this.add.bitmapText(24, 16, 'clicker', `BUILD ${buildHash}`, 12);

      // Add temporary info text
      this.add.rectangle(200, 42, 360, 20, Colors.PANEL_MEDIUM, 0.85);
      this.add.bitmapText(24, 42, 'clicker', 'DRAG SLICE TO CENTER TO SELECT ITEM', 12);

      this.input.keyboard?.on('keydown-M', () => this.scene.launch('ItemManual'));
    } catch (error) {
      console.error('Error creating Game scene:', error);
      this.add.bitmapText(50, 50, 'clicker', 'ERROR LOADING GAME DATA', 20);
    }
  }

  update(_time: number, _delta: number) {
    // Update shift timer display
  }

  onOrderComplete() {
    // Validate order is within budget
    // Load next order
    // Reset dial to first level
    if (this.radialDial) {
      this.radialDial.reset();
    }
    // If no more orders, end shift
  }

  endShift() {
    // this.scene.start('GameOver', { stats });
  }

  shutdown() {
    if (this.radialDial) {
      this.radialDial.destroy();
    }
  }
}