import { RadialDial } from '../ui/RadialDial';
import { GameManager } from '../managers/GameManager';
import { SettingsManager } from '../managers/SettingsManager';
import { Colors, toColorString } from '../constants/Colors';

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
      this.add.text(manualX, manualY, 'CATALOG', {
        fontSize: '13px',
        color: toColorString(Colors.HIGHLIGHT_YELLOW),
        fontStyle: 'bold',
        fontFamily: 'monospace',
        align: 'center'
      }).setOrigin(0.5);
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

      const buildHash = '84bee6b';
      this.add.text(24, 16, `Build: ${buildHash}`, { fontSize: '12px', color: toColorString(Colors.HIGHLIGHT_YELLOW) });

      // Add temporary info text
      this.add.text(24, 42, 'Drag slice → center to select item, Tap center to go back', { fontSize: '14px', color: toColorString(Colors.LIGHT_BLUE) });

      this.input.keyboard?.on('keydown-M', () => this.scene.launch('ItemManual'));
    } catch (error) {
      console.error('Error creating Game scene:', error);
      this.add.text(50, 50, 'Error loading game data', { fontSize: '20px', color: toColorString(Colors.HIGHLIGHT_YELLOW) });
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