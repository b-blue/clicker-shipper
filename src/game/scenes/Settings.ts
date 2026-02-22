import { Scene } from 'phaser';
import { Colors, toColorString } from '../constants/Colors';
import { SettingsManager } from '../managers/SettingsManager';

export class Settings extends Scene {
  private settingsManager: SettingsManager;
  private dialX: number = -200;
  private dialY: number = -150;
  private showOutline: boolean = false;
  private temporarilyShowOutline: boolean = false;
  private fadeOutTimer: Phaser.Time.TimerEvent | null = null;
  private previewDial: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super('Settings');
    this.settingsManager = SettingsManager.getInstance();
  }

  create() {
    const gameWidth = this.cameras.main.width;
    const gameHeight = this.cameras.main.height;
    const panelWidth = Math.min(gameWidth * 0.9, 600);
    const panelHeight = Math.min(gameHeight * 0.55, 400);
    const panelCenterY = gameHeight * 0.32;

    // Background
    this.add.rectangle(gameWidth / 2, gameHeight / 2, gameWidth, gameHeight, Colors.BACKGROUND_DARK);

    // Panel
    this.add.rectangle(gameWidth / 2, panelCenterY, panelWidth, panelHeight, Colors.PANEL_DARK, 0.9);
    this.add.rectangle(gameWidth / 2, panelCenterY, panelWidth, panelHeight)
      .setStrokeStyle(2, Colors.BORDER_BLUE);

    // Title
    this.add.text(gameWidth / 2, gameHeight * 0.10, 'SETTINGS', {
      fontSize: '32px',
      color: toColorString(Colors.HIGHLIGHT_YELLOW),
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Load current settings
    const currentSettings = this.settingsManager.getDialSettings();
    this.dialX = currentSettings.offsetX;
    this.dialY = currentSettings.offsetY;
    this.showOutline = currentSettings.showOutline ?? false;

    // Dial Position Section
    this.add.text(gameWidth / 2, gameHeight * 0.18, 'DIAL POSITION', {
      fontSize: '16px',
      color: toColorString(Colors.LIGHT_BLUE),
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(gameWidth / 2, gameHeight * 0.22, 'Adjust the radial dial position from bottom-right corner', {
      fontSize: '11px',
      color: toColorString(Colors.LIGHT_BLUE),
    }).setOrigin(0.5);

    // Horizontal position controls
    const xLabelY = gameHeight * 0.29;
    this.add.text(gameWidth / 2 - panelWidth / 2 + 40, xLabelY, 'Horizontal:', {
      fontSize: '14px',
      color: toColorString(Colors.HIGHLIGHT_YELLOW),
    }).setOrigin(0, 0.5);

    this.createAdjustButton(
      gameWidth / 2 - 80,
      xLabelY,
      '←',
      () => this.adjustDialPosition(-10, 0)
    );

    const xValueText = this.add.text(gameWidth / 2, xLabelY, `${this.dialX}px`, {
      fontSize: '14px',
      color: toColorString(Colors.WHITE),
    }).setOrigin(0.5, 0.5);

    this.createAdjustButton(
      gameWidth / 2 + 80,
      xLabelY,
      '→',
      () => this.adjustDialPosition(10, 0)
    );

    // Vertical position controls
    const yLabelY = gameHeight * 0.36;
    this.add.text(gameWidth / 2 - panelWidth / 2 + 40, yLabelY, 'Vertical:', {
      fontSize: '14px',
      color: toColorString(Colors.HIGHLIGHT_YELLOW),
    }).setOrigin(0, 0.5);

    this.createAdjustButton(
      gameWidth / 2 - 80,
      yLabelY,
      '↑',
      () => this.adjustDialPosition(0, -10)
    );

    const yValueText = this.add.text(gameWidth / 2, yLabelY, `${this.dialY}px`, {
      fontSize: '14px',
      color: toColorString(Colors.WHITE),
    }).setOrigin(0.5, 0.5);

    this.createAdjustButton(
      gameWidth / 2 + 80,
      yLabelY,
      '↓',
      () => this.adjustDialPosition(0, 10)
    );

    // Store references for updating
    this.data.set('xValueText', xValueText);
    this.data.set('yValueText', yValueText);

    // Dial Outline Toggle
    const toggleY = gameHeight * 0.43;
    this.add.text(gameWidth / 2 - panelWidth / 2 + 40, toggleY, 'Show Outline:', {
      fontSize: '14px',
      color: toColorString(Colors.HIGHLIGHT_YELLOW),
    }).setOrigin(0, 0.5);

    const toggleButton = this.add.rectangle(gameWidth / 2, toggleY, 60, 30, 
      this.showOutline ? Colors.SLICE_HIGHLIGHTED : Colors.PANEL_DARK, 0.8);
    toggleButton.setStrokeStyle(2, Colors.BORDER_BLUE);
    toggleButton.setInteractive();

    const toggleText = this.add.text(gameWidth / 2, toggleY, this.showOutline ? 'ON' : 'OFF', {
      fontSize: '14px',
      color: toColorString(Colors.WHITE),
      fontStyle: 'bold',
    }).setOrigin(0.5);

    toggleButton.on('pointerdown', () => {
      this.showOutline = !this.showOutline;
      toggleButton.setFillStyle(this.showOutline ? Colors.SLICE_HIGHLIGHTED : Colors.PANEL_DARK, 0.8);
      toggleText.setText(this.showOutline ? 'ON' : 'OFF');
      this.drawPreviewDial();
    });

    toggleButton.on('pointerover', () => {
      toggleButton.setFillStyle(this.showOutline ? Colors.SLICE_HIGHLIGHTED : Colors.BUTTON_HOVER, 0.9);
    });

    toggleButton.on('pointerout', () => {
      toggleButton.setFillStyle(this.showOutline ? Colors.SLICE_HIGHLIGHTED : Colors.PANEL_DARK, 0.8);
    });

    // Preview dial
    this.drawPreviewDial();

    // Action buttons in single row: Reset, Cancel, Save
    const buttonY = gameHeight * 0.52;
    const buttonSpacing = 150;
    
    this.createButton(
      gameWidth / 2 - buttonSpacing,
      buttonY,
      'RESET',
      () => this.resetToDefaults(),
      120
    );

    this.createButton(
      gameWidth / 2,
      buttonY,
      'CANCEL',
      () => this.scene.start('MainMenu'),
      120
    );

    this.createButton(
      gameWidth / 2 + buttonSpacing,
      buttonY,
      'SAVE',
      () => this.saveAndClose(),
      120
    );
  }

  private adjustDialPosition(deltaX: number, deltaY: number): void {
    this.dialX += deltaX;
    this.dialY += deltaY;

    // Clamp values to reasonable ranges
    this.dialX = Math.max(-400, Math.min(-50, this.dialX));
    this.dialY = Math.max(-400, Math.min(-50, this.dialY));

    // Update text displays
    const xValueText = this.data.get('xValueText') as Phaser.GameObjects.Text;
    const yValueText = this.data.get('yValueText') as Phaser.GameObjects.Text;
    
    if (xValueText) xValueText.setText(`${this.dialX}px`);
    if (yValueText) yValueText.setText(`${this.dialY}px`);

    // Update preview
    this.drawPreviewDial();
  }

  private drawPreviewDial(): void {
    if (this.previewDial) {
      this.previewDial.destroy();
    }

    const gameWidth = this.cameras.main.width;
    const gameHeight = this.cameras.main.height;
    const dialPreviewX = gameWidth + this.dialX;
    const dialPreviewY = gameHeight + this.dialY;

    this.previewDial = this.add.graphics();
    
    // Draw simplified dial preview only if showOutline is true or temporarily showing
    const shouldShow = this.showOutline || this.temporarilyShowOutline;
    const alpha = shouldShow ? 0.8 : 0;
    
    this.previewDial.lineStyle(2, Colors.HIGHLIGHT_YELLOW, alpha);
    this.previewDial.strokeCircle(dialPreviewX, dialPreviewY, 150);
    this.previewDial.strokeCircle(dialPreviewX, dialPreviewY, 50);
    
    // Draw crosshair at center
    this.previewDial.lineStyle(1, Colors.HIGHLIGHT_YELLOW, alpha * 0.75);
    this.previewDial.lineBetween(dialPreviewX - 10, dialPreviewY, dialPreviewX + 10, dialPreviewY);
    this.previewDial.lineBetween(dialPreviewX, dialPreviewY - 10, dialPreviewX, dialPreviewY + 10);

    this.previewDial.setDepth(10);
  }

  private resetToDefaults(): void {
    this.dialX = -200;
    this.dialY = -150;

    const xValueText = this.data.get('xValueText') as Phaser.GameObjects.Text;
    const yValueText = this.data.get('yValueText') as Phaser.GameObjects.Text;
    
    if (xValueText) xValueText.setText(`${this.dialX}px`);
    if (yValueText) yValueText.setText(`${this.dialY}px`);

    this.drawPreviewDial();
  }

  private saveAndClose(): void {
    // Update settings manager
    this.settingsManager.updateDialPosition(this.dialX, this.dialY);
    this.settingsManager.updateDialOutline(this.showOutline);
    
    // Save to localStorage
    try {
      const settings = this.settingsManager.getSettings();
      localStorage.setItem('clicker-shipper-settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }

    // Return to main menu
    this.scene.start('MainMenu');
  }

  private createAdjustButton(x: number, y: number, text: string, callback: () => void): void {
    const button = this.add.rectangle(x, y, 40, 40, Colors.PANEL_DARK, 0.8);
    button.setStrokeStyle(2, Colors.BORDER_BLUE);
    button.setInteractive();

    button.on('pointerdown', () => {
      // Show outline temporarily
      this.temporarilyShowOutline = true;
      this.drawPreviewDial();
      
      // Clear any existing fade timer
      if (this.fadeOutTimer) {
        this.fadeOutTimer.remove();
      }
      
      callback();
    });
    
    button.on('pointerup', () => {
      // Start fade out timer
      this.fadeOutTimer = this.time.delayedCall(500, () => {
        this.temporarilyShowOutline = false;
        this.drawPreviewDial();
      });
    });
    
    button.on('pointerover', () => {
      button.setFillStyle(Colors.BUTTON_HOVER, 0.9);
    });
    button.on('pointerout', () => {
      button.setFillStyle(Colors.PANEL_DARK, 0.8);
      
      // Also trigger fade out on pointer leaving button
      if (this.temporarilyShowOutline && this.fadeOutTimer) {
        this.fadeOutTimer.remove();
        this.fadeOutTimer = this.time.delayedCall(500, () => {
          this.temporarilyShowOutline = false;
          this.drawPreviewDial();
        });
      }
    });

    this.add.text(x, y, text, {
      fontSize: '20px',
      color: toColorString(Colors.HIGHLIGHT_YELLOW),
      fontStyle: 'bold',
    }).setOrigin(0.5);
  }

  private createButton(x: number, y: number, text: string, callback: () => void, width: number = 200): void {
    const buttonHeight = 50;
    const buttonBg = this.add.rectangle(x, y, width, buttonHeight, Colors.PANEL_DARK, 0.75);
    buttonBg.setInteractive();

    buttonBg.on('pointerdown', callback);
    buttonBg.on('pointerover', () => {
      buttonBg.setFillStyle(Colors.BUTTON_HOVER, 0.9);
    });
    buttonBg.on('pointerout', () => {
      buttonBg.setFillStyle(Colors.PANEL_DARK, 0.75);
    });

    this.add.rectangle(x, y, width, buttonHeight).setStrokeStyle(2, Colors.HIGHLIGHT_YELLOW);

    this.add.text(x, y, text, {
      fontSize: '18px',
      color: toColorString(Colors.HIGHLIGHT_YELLOW),
      fontStyle: 'bold',
    }).setOrigin(0.5);
  }
}
