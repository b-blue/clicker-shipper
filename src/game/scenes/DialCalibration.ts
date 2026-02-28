import { Scene } from 'phaser';
import { Colors } from '../constants/Colors';
import { labelStyle, readoutStyle } from '../constants/FontStyle';
import { SettingsManager } from '../managers/SettingsManager';

export class DialCalibration extends Scene {
  private settingsManager: SettingsManager;
  private dialX: number = -200;
  private dialY: number = -150;
  private dialRadius: number = 150;
  private showOutline: boolean = false;
  private temporarilyShowOutline: boolean = false;
  private fadeOutTimer: Phaser.Time.TimerEvent | null = null;
  private previewDial: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super('DialCalibration');
    this.settingsManager = SettingsManager.getInstance();
  }

  create() {
    const gameWidth = this.cameras.main.width;
    const gameHeight = this.cameras.main.height;

    // Panel — wider and taller to accommodate two-column layout
    const panelWidth = Math.min(720, gameWidth - 40);
    const panelHeight = Math.min(440, gameHeight * 0.74);
    const panelCenterY = gameHeight * 0.40;

    // Column centres — each sits at 1/4 and 3/4 of panel width
    const leftCX = gameWidth / 2 - panelWidth / 4;
    const rightCX = gameWidth / 2 + panelWidth / 4;

    // Background
    this.add.rectangle(gameWidth / 2, gameHeight / 2, gameWidth, gameHeight, Colors.BACKGROUND_DARK);

    // Panel
    this.add.rectangle(gameWidth / 2, panelCenterY, panelWidth, panelHeight, Colors.PANEL_DARK, 0.9);
    this.add.rectangle(gameWidth / 2, panelCenterY, panelWidth, panelHeight)
      .setStrokeStyle(2, Colors.BORDER_BLUE);

    // Title
    this.add.text(gameWidth / 2, gameHeight * 0.10, 'CALIBRATE DIAL', labelStyle(26))
      .setOrigin(0.5);

    // Load current settings
    const currentSettings = this.settingsManager.getDialSettings();
    this.dialX = currentSettings.offsetX;
    this.dialY = currentSettings.offsetY;
    this.showOutline = currentSettings.showOutline ?? false;
    this.dialRadius = currentSettings.radius ?? 150;

    // ── LEFT COLUMN: D-pad for position ──────────────────────────────────
    const padCX = leftCX;
    const padCY = panelCenterY - 10;
    const padStep = 58; // button size 48 + 10 gap

    this.add.text(padCX, gameHeight * 0.22, 'DIAL POSITION', labelStyle(14))
      .setOrigin(0.5, 0.5);

    // Cross pattern: UP top, DOWN bottom, LEFT left, RIGHT right
    this.createAdjustButton(padCX,            padCY - padStep, 'UP', () => this.adjustDialPosition(0, -10));
    this.createAdjustButton(padCX - padStep,  padCY,           'LT', () => this.adjustDialPosition(-10, 0));
    this.createAdjustButton(padCX + padStep,  padCY,           'RT', () => this.adjustDialPosition(10, 0));
    this.createAdjustButton(padCX,            padCY + padStep, 'DN', () => this.adjustDialPosition(0, 10));

    // X / Y value readout below the D-pad
    const xValueText = this.add.text(padCX, padCY + 90, `X: ${this.dialX}`, readoutStyle(12))
      .setOrigin(0.5, 0.5);
    const yValueText = this.add.text(padCX, padCY + 110, `Y: ${this.dialY}`, readoutStyle(12))
      .setOrigin(0.5, 0.5);

    // ── RIGHT COLUMN: Dial size + outline toggle ──────────────────────────
    const dialSizeLabelY  = panelCenterY - 75;
    const dialSizeCtrlY   = panelCenterY - 35;
    const btnOffset = 60;

    this.add.text(rightCX, dialSizeLabelY, 'DIAL SIZE', labelStyle(14))
      .setOrigin(0.5, 0.5);

    this.createAdjustButton(rightCX - btnOffset, dialSizeCtrlY, 'LT', () => this.adjustDialRadius(-10));
    const radiusValueText = this.add.text(rightCX, dialSizeCtrlY, `${this.dialRadius}`, readoutStyle(14))
      .setOrigin(0.5);
    this.createAdjustButton(rightCX + btnOffset, dialSizeCtrlY, 'RT', () => this.adjustDialRadius(10));

    const outlineLabelY  = panelCenterY + 40;
    const outlineToggleY = panelCenterY + 75;

    this.add.text(rightCX, outlineLabelY, 'SHOW OUTLINE', labelStyle(14))
      .setOrigin(0.5, 0.5);

    const toggleButton = this.add.rectangle(rightCX, outlineToggleY, 60, 30,
      this.showOutline ? Colors.SLICE_HIGHLIGHTED : Colors.PANEL_DARK, 0.8);
    toggleButton.setStrokeStyle(2, Colors.BORDER_BLUE);
    toggleButton.setInteractive();

    const toggleText = this.add.text(rightCX, outlineToggleY, this.showOutline ? 'ON' : 'OFF', labelStyle(14))
      .setOrigin(0.5);

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

    // Store references for live updates
    this.data.set('xValueText', xValueText);
    this.data.set('yValueText', yValueText);
    this.data.set('radiusValueText', radiusValueText);

    // Preview dial
    this.drawPreviewDial();

    // ── ACTION BUTTONS ──────────────────────────────────────────────────
    const buttonY = panelCenterY + panelHeight / 2 - 35;
    const buttonSpacing = 110;

    this.createButton(gameWidth / 2 - buttonSpacing, buttonY, 'RESET',  () => this.resetToDefaults(), 100);
    this.createButton(gameWidth / 2,                 buttonY, 'CANCEL', () => this.scene.start('MainMenu'), 100);
    this.createButton(gameWidth / 2 + buttonSpacing, buttonY, 'SAVE',   () => this.saveAndClose(), 100);
  }

  private adjustDialRadius(delta: number): void {
    this.dialRadius = Math.max(80, Math.min(250, this.dialRadius + delta));
    const radiusValueText = this.data.get('radiusValueText') as Phaser.GameObjects.Text;
    if (radiusValueText) radiusValueText.setText(`${this.dialRadius}`);
    this.drawPreviewDial();
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

    if (xValueText) xValueText.setText(`X: ${this.dialX}`);
    if (yValueText) yValueText.setText(`Y: ${this.dialY}`);

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
    this.previewDial.strokeCircle(dialPreviewX, dialPreviewY, this.dialRadius);
    this.previewDial.strokeCircle(dialPreviewX, dialPreviewY, Math.round(this.dialRadius / 3));
    
    // Draw crosshair at center
    this.previewDial.lineStyle(1, Colors.HIGHLIGHT_YELLOW, alpha * 0.75);
    this.previewDial.lineBetween(dialPreviewX - 10, dialPreviewY, dialPreviewX + 10, dialPreviewY);
    this.previewDial.lineBetween(dialPreviewX, dialPreviewY - 10, dialPreviewX, dialPreviewY + 10);

    this.previewDial.setDepth(10);
  }

  private resetToDefaults(): void {
    this.dialX = -200;
    this.dialY = -150;
    this.dialRadius = 150;

    const xValueText = this.data.get('xValueText') as Phaser.GameObjects.Text;
    const yValueText = this.data.get('yValueText') as Phaser.GameObjects.Text;
    const radiusValueText = this.data.get('radiusValueText') as Phaser.GameObjects.Text;
    
    if (xValueText) xValueText.setText(`X: ${this.dialX}`);
    if (yValueText) yValueText.setText(`Y: ${this.dialY}`);
    if (radiusValueText) radiusValueText.setText(`${this.dialRadius}`);

    this.drawPreviewDial();
  }

  private saveAndClose(): void {
    // Update settings manager
    this.settingsManager.updateDialPosition(this.dialX, this.dialY);
    this.settingsManager.updateDialOutline(this.showOutline);
    this.settingsManager.updateDialRadius(this.dialRadius);
    
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

  private createAdjustButton(x: number, y: number, direction: 'LT' | 'RT' | 'UP' | 'DN', callback: () => void): void {
    const button = this.add.rectangle(x, y, 48, 48, Colors.PANEL_DARK, 0.8);
    button.setStrokeStyle(2, Colors.BORDER_BLUE);
    button.setInteractive();

    button.on('pointerdown', () => {
      this.temporarilyShowOutline = true;
      this.drawPreviewDial();
      if (this.fadeOutTimer) this.fadeOutTimer.remove();
      callback();
    });

    button.on('pointerup', () => {
      this.fadeOutTimer = this.time.delayedCall(500, () => {
        this.temporarilyShowOutline = false;
        this.drawPreviewDial();
      });
    });

    button.on('pointerover', () => { button.setFillStyle(Colors.BUTTON_HOVER, 0.9); });
    button.on('pointerout', () => {
      button.setFillStyle(Colors.PANEL_DARK, 0.8);
      if (this.temporarilyShowOutline && this.fadeOutTimer) {
        this.fadeOutTimer.remove();
        this.fadeOutTimer = this.time.delayedCall(500, () => {
          this.temporarilyShowOutline = false;
          this.drawPreviewDial();
        });
      }
    });

    // Yellow arrow triangle
    const arrow = this.add.graphics();
    arrow.fillStyle(Colors.HIGHLIGHT_YELLOW, 1);
    const s = 7;
    if (direction === 'LT') {
      arrow.fillTriangle(x - s, y, x + s, y - s, x + s, y + s);
    } else if (direction === 'RT') {
      arrow.fillTriangle(x + s, y, x - s, y - s, x - s, y + s);
    } else if (direction === 'UP') {
      arrow.fillTriangle(x, y - s, x - s, y + s, x + s, y + s);
    } else {
      arrow.fillTriangle(x, y + s, x - s, y - s, x + s, y - s);
    }
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

    this.add.text(x, y, text, labelStyle(14))
      .setOrigin(0.5);
  }
}
