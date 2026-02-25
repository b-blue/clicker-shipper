import { Colors, toColorString } from '../constants/Colors';
import { fitFontSize } from '../utils/UiUtils';

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

    const margin = 20;
    const availableWidth = gameWidth - margin;

    // Title with background
    const titleText = 'CYBERPUNK SHIPPER';
    const titleMaxWidth = gameWidth - margin * 2;
    const titleFontSize = fitFontSize(titleText, titleMaxWidth, 32);
    this.add.rectangle(gameWidth / 2, gameHeight * 0.15, titleMaxWidth, 50, Colors.PANEL_MEDIUM, 0.9);
    this.add.bitmapText(gameWidth / 2, gameHeight * 0.15, 'clicker', titleText, titleFontSize)
      .setOrigin(0.5)
      .setMaxWidth(titleMaxWidth);

    // Subtitle with background
    const subtitleText = 'ORDER FULFILLMENT TERMINAL';
    const subtitleFontSize = fitFontSize(subtitleText, availableWidth, 16);
    this.add.rectangle(gameWidth / 2, gameHeight * 0.25, Math.min(500, gameWidth - margin), 30, Colors.PANEL_MEDIUM, 0.85);
    this.add.bitmapText(gameWidth / 2, gameHeight * 0.25, 'clicker', subtitleText, subtitleFontSize)
      .setOrigin(0.5);

    // Menu buttons
    const buttonY = gameHeight * 0.45;
    const buttonSpacing = 70;

    // Start Shift button
    this.createButton(gameWidth / 2, buttonY, 'START SHIFT', () => this.punchIn());

    // Upgrades button
    this.createButton(gameWidth / 2, buttonY + buttonSpacing, 'UPGRADES', () => this.openUpgrades());

    // Settings button
    this.createButton(gameWidth / 2, buttonY + buttonSpacing * 2, 'CALIBRATE DIAL', () => this.openSettings());

    // Exit button
    this.createButton(gameWidth / 2, buttonY + buttonSpacing * 3, 'EXIT', () => this.exitGame());

    // Footer with background
    const footerText = 'PRESS SPACE TO START SHIFT';
    const footerFontSize = fitFontSize(footerText, availableWidth, 12);
    this.add.rectangle(gameWidth / 2, gameHeight * 0.9, Math.min(400, gameWidth - margin), 24, Colors.PANEL_MEDIUM, 0.85);
    this.add.bitmapText(gameWidth / 2, gameHeight * 0.9, 'clicker', footerText, footerFontSize)
      .setOrigin(0.5);

    // Keyboard shortcuts
    this.input.keyboard?.on('keydown-SPACE', () => this.punchIn());
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

    // Button text background
    this.add.rectangle(x, y, buttonWidth - 10, 28, Colors.PANEL_MEDIUM, 0.8);
    // Button text
    this.add.bitmapText(x, y, 'clicker', text, 13)
      .setOrigin(0.5);
  }

  punchIn() {
    // Transition to Game scene
    this.scene.start('Game');
  }

  openUpgrades() {
    // Open upgrades screen (no shift data — just browsing/spending quanta)
    this.scene.start('EndShift', { revenue: 0, bonus: 0 });
  }

  openSettings() {
    // Transition to Settings scene
    this.scene.start('DialCalibration');
  }

  exitGame() {
    // Return to main page or close game
    window.location.href = '/';
  }
}
