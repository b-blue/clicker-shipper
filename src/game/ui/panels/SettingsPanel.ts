import Phaser from 'phaser';
import { ProgressionManager } from '../../managers/ProgressionManager';
import { SettingsManager } from '../../managers/SettingsManager';
import { Colors } from '../../constants/Colors';
import { labelStyle } from '../../constants/FontStyle';

/** Builds the SETTINGS tab content. */
export class SettingsPanel {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  build(container: Phaser.GameObjects.Container, panelX: number, panelWidth: number): void {
    const sm   = SettingsManager.getInstance();
    const btnW = panelWidth - 60;

    // CALIBRATE DIAL
    const calibrateY = 60;
    const btn = this.scene.add.rectangle(panelX, calibrateY, btnW, 28, Colors.PANEL_DARK, 0.9);
    btn.setStrokeStyle(2, Colors.BORDER_BLUE);
    btn.setInteractive();
    btn.on('pointerdown', () => this.scene.scene.start('DialCalibration'));
    btn.on('pointerover', () => btn.setFillStyle(Colors.BUTTON_HOVER, 0.95));
    btn.on('pointerout',  () => btn.setFillStyle(Colors.PANEL_DARK, 0.9));
    const btnLabel = this.scene.add.text(panelX, calibrateY, 'CALIBRATE DIAL', labelStyle(11)).setOrigin(0.5);

    // HANDEDNESS toggle
    const handY     = calibrateY + 44;
    const handHalfW = (btnW - 8) / 2;
    const rX = panelX - handHalfW / 2 - 4;
    const lX = panelX + handHalfW / 2 + 4;

    const makeHandBtn = (label: string, x: number, value: 'right' | 'left') => {
      const active  = sm.getHandedness() === value;
      const bg = this.scene.add.rectangle(x, handY, handHalfW, 28,
        active ? Colors.BUTTON_HOVER : Colors.PANEL_DARK, active ? 0.95 : 0.9);
      bg.setStrokeStyle(2, active ? Colors.HIGHLIGHT_YELLOW : Colors.BORDER_BLUE);
      bg.setInteractive();
      const txt = this.scene.add.text(x, handY, label, labelStyle(11, active ? Colors.HIGHLIGHT_YELLOW : 0xaaaaaa)).setOrigin(0.5);
      bg.on('pointerdown', () => {
        if (sm.getHandedness() !== value) {
          sm.updateHandedness(value);
          this.scene.scene.restart();
        }
      });
      bg.on('pointerover', () => bg.setFillStyle(Colors.BUTTON_HOVER, 0.95));
      bg.on('pointerout',  () => bg.setFillStyle(active ? Colors.BUTTON_HOVER : Colors.PANEL_DARK, active ? 0.95 : 0.9));
      return [bg, txt] as const;
    };

    const [rBg, rTxt] = makeHandBtn('RIGHT-HAND', rX, 'right');
    const [lBg, lTxt] = makeHandBtn('LEFT-HAND',  lX, 'left');
    const handLabel   = this.scene.add.text(panelX, handY - 20, 'HANDEDNESS', labelStyle(9, Colors.BORDER_BLUE)).setOrigin(0.5);

    // RESET PROGRESSION (two-tap confirmation)
    const resetY = handY + 52;
    const resetBtn = this.scene.add.rectangle(panelX, resetY, btnW, 28, Colors.PANEL_DARK, 0.9);
    resetBtn.setStrokeStyle(2, 0xff2244);
    resetBtn.setInteractive();
    const resetLabel = this.scene.add.text(panelX, resetY, 'RESET PROGRESS', labelStyle(11, 0xff2244))
      .setOrigin(0.5);
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

    container.add([btn, btnLabel, handLabel, rBg, rTxt, lBg, lTxt, resetBtn, resetLabel]);
  }
}
