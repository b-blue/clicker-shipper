import Phaser from 'phaser';
import { ProgressionManager } from '../../managers/ProgressionManager';
import { Colors } from '../../constants/Colors';

/** Builds the SETTINGS tab content. */
export class SettingsPanel {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  build(container: Phaser.GameObjects.Container, panelX: number, panelWidth: number): void {
    const btnW = panelWidth - 60;

    // CALIBRATE DIAL
    const calibrateY = 60;
    const btn = this.scene.add.rectangle(panelX, calibrateY, btnW, 28, Colors.PANEL_DARK, 0.9);
    btn.setStrokeStyle(2, Colors.BORDER_BLUE);
    btn.setInteractive();
    btn.on('pointerdown', () => this.scene.scene.start('DialCalibration'));
    btn.on('pointerover', () => btn.setFillStyle(Colors.BUTTON_HOVER, 0.95));
    btn.on('pointerout',  () => btn.setFillStyle(Colors.PANEL_DARK, 0.9));
    const btnLabel = this.scene.add.bitmapText(panelX, calibrateY, 'clicker', 'CALIBRATE DIAL', 11).setOrigin(0.5);

    // RESET PROGRESSION (two-tap confirmation)
    const resetY = calibrateY + 44;
    const resetBtn = this.scene.add.rectangle(panelX, resetY, btnW, 28, Colors.PANEL_DARK, 0.9);
    resetBtn.setStrokeStyle(2, 0xff2244);
    resetBtn.setInteractive();
    const resetLabel = this.scene.add.bitmapText(panelX, resetY, 'clicker', 'RESET PROGRESS', 11)
      .setOrigin(0.5).setTint(0xff2244);
    let resetPending = false;
    let resetTimer: Phaser.Time.TimerEvent | null = null;
    resetBtn.on('pointerdown', () => {
      if (!resetPending) {
        resetPending = true;
        resetLabel.setText('CONFIRM?');
        resetBtn.setFillStyle(0x3a0008, 0.95);
        resetTimer = this.scene.time.addEvent({
          delay: 3000,
          callback: () => {
            resetPending = false;
            resetLabel.setText('RESET PROGRESS');
            resetBtn.setFillStyle(Colors.PANEL_DARK, 0.9);
          },
        });
      } else {
        resetTimer?.remove();
        ProgressionManager.getInstance().reset();
        this.scene.scene.restart();
      }
    });
    resetBtn.on('pointerover', () => resetBtn.setFillStyle(resetPending ? 0x5a0010 : 0x1a0008, 0.95));
    resetBtn.on('pointerout',  () => resetBtn.setFillStyle(resetPending ? 0x3a0008 : Colors.PANEL_DARK, 0.9));

    container.add([btn, btnLabel, resetBtn, resetLabel]);
  }
}
