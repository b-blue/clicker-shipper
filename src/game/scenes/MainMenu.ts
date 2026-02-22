import { Colors, toColorString } from '../constants/Colors';

export class MainMenu extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create() {
    // Get responsive viewport dimensions
    const gameWidth = this.cameras.main.width;
    const gameHeight = this.cameras.main.height;

    // Background
    this.add.rectangle(gameWidth / 2, gameHeight / 2, gameWidth, gameHeight, Colors.BACKGROUND_DARK);

    // Title
    this.add.text(gameWidth / 2, gameHeight * 0.15, 'INTERGALACTIC SHIPPER', {
      fontSize: '48px',
      color: toColorString(Colors.HIGHLIGHT_YELLOW),
      fontStyle: 'bold',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(gameWidth / 2, gameHeight * 0.25, 'Order Fulfillment Terminal', {
      fontSize: '20px',
      color: toColorString(Colors.LIGHT_BLUE),
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Menu buttons
    const buttonY = gameHeight * 0.45;
    const buttonSpacing = 70;

    // Start Shift button
    this.createButton(gameWidth / 2, buttonY, 'START SHIFT', () => this.punchIn());

    // Catalog button
    this.createButton(gameWidth / 2, buttonY + buttonSpacing, 'ITEM CATALOG', () => this.openManual());

    // Settings button
    this.createButton(gameWidth / 2, buttonY + buttonSpacing * 2, 'SETTINGS', () => this.openSettings());

    // Exit button
    this.createButton(gameWidth / 2, buttonY + buttonSpacing * 3, 'EXIT', () => this.exitGame());

    // Footer
    this.add.text(gameWidth / 2, gameHeight * 0.9, 'Press SPACE to START SHIFT • Press M to view CATALOG', {
      fontSize: '12px',
      color: toColorString(Colors.TEXT_MUTED_BLUE),
      align: 'center',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Keyboard shortcuts
    this.input.keyboard?.on('keydown-SPACE', () => this.punchIn());
    this.input.keyboard?.on('keydown-M', () => this.openManual());
  }

  private createButton(x: number, y: number, text: string, callback: () => void, colorHex: string = toColorString(Colors.HIGHLIGHT_YELLOW)): void {
    const buttonWidth = 200;
    const buttonHeight = 50;

    // Button background
    const buttonBg = this.add.rectangle(x, y, buttonWidth, buttonHeight, Colors.PANEL_DARK, 0.75);
    buttonBg.setInteractive();
    buttonBg.on('pointerdown', callback);
    buttonBg.on('pointerover', () => {
      buttonBg.setFillStyle(Colors.BUTTON_HOVER, 0.9);
    });
    buttonBg.on('pointerout', () => {
      buttonBg.setFillStyle(Colors.PANEL_DARK, 0.75);
    });

    // Button border
    const color = parseInt(colorHex.replace('#', ''), 16);
    this.add.rectangle(x, y, buttonWidth, buttonHeight).setStrokeStyle(2, color);

    // Button text
    this.add.text(x, y, text, {
      fontSize: '18px',
      color: colorHex,
      fontStyle: 'bold',
      fontFamily: 'monospace',
      align: 'center'
    }).setOrigin(0.5);
  }

  punchIn() {
    // Transition to Game scene
    this.scene.start('Game');
  }

  openManual() {
    // Launch ItemManual scene as overlay
    this.scene.launch('ItemManual');
  }

  openSettings() {
    // Transition to Settings scene
    this.scene.start('Settings');
  }

  exitGame() {
    // Return to main page or close game
    window.location.href = '/';
  }
}
