import Phaser from 'phaser';
import { ProgressionManager } from '../../managers/ProgressionManager';
import { SettingsManager } from '../../managers/SettingsManager';
import { Colors } from '../../constants/Colors';
import { ShiftTimerState } from '../../repair/RepairTypes';

export interface SettingsCallbacks {
  /** Called when a duration preset restarts the shift timer. */
  onEndShift(): void;
}

/**
 * Builds the SETTINGS tab content.
 * Reads and writes timer state via the shared ShiftTimerState reference.
 */
export class SettingsPanel {
  private scene: Phaser.Scene;
  private timerState: ShiftTimerState;
  private callbacks: SettingsCallbacks;

  constructor(scene: Phaser.Scene, timerState: ShiftTimerState, callbacks: SettingsCallbacks) {
    this.scene       = scene;
    this.timerState  = timerState;
    this.callbacks   = callbacks;
  }

  build(container: Phaser.GameObjects.Container, panelX: number, panelWidth: number): void {
    const btnW = panelWidth - 60;

    // CALIBRATE DIAL
    const calibrateY = 120;
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

    // SHIFT TIMER toggle
    const timerToggleY = resetY + 44;
    const timerToggleBg = this.scene.add.rectangle(panelX, timerToggleY, btnW, 28, Colors.PANEL_DARK, 0.9);
    timerToggleBg.setStrokeStyle(2, Colors.BORDER_BLUE);
    timerToggleBg.setInteractive();
    const timerToggleLbl = this.scene.add.bitmapText(panelX, timerToggleY, 'clicker', 'SHIFT TIMER: ON', 11).setOrigin(0.5);
    const refreshTimerToggle = () => {
      timerToggleLbl.setText(this.timerState.timerPaused ? 'SHIFT TIMER: OFF' : 'SHIFT TIMER: ON');
      timerToggleLbl.setTint(this.timerState.timerPaused ? Colors.MUTED_BLUE : Colors.HIGHLIGHT_YELLOW);
    };
    timerToggleBg.on('pointerdown', () => {
      const s = this.timerState;
      if (!s.timerPaused) {
        s.timerPaused    = true;
        s.timerPausedAt  = Date.now();
        if (s.shiftTimerEvent) s.shiftTimerEvent.paused = true;
      } else {
        s.shiftStartTime += Date.now() - s.timerPausedAt;
        s.timerPaused     = false;
        if (s.shiftTimerEvent) s.shiftTimerEvent.paused = false;
      }
      refreshTimerToggle();
    });
    timerToggleBg.on('pointerover', () => timerToggleBg.setFillStyle(Colors.BUTTON_HOVER, 0.95));
    timerToggleBg.on('pointerout',  () => timerToggleBg.setFillStyle(Colors.PANEL_DARK, 0.9));

    // SHIFT DURATION presets
    const sm = SettingsManager.getInstance();
    const durationLabelY = timerToggleY + 52;
    const durationLbl = this.scene.add
      .bitmapText(panelX - btnW / 2, durationLabelY, 'clicker', 'SHIFT DURATION', 10)
      .setOrigin(0, 0.5).setTint(0xaaaacc);
    const durationPresets = [
      { label: '30 SEC', ms: 30000  },
      { label: '1 MIN',  ms: 60000  },
      { label: '2 MIN',  ms: 120000 },
      { label: '5 MIN',  ms: 300000 },
    ];
    const presetBtnW = (btnW - 12) / 4;
    const presetY    = durationLabelY + 28;
    const presetBgRefs: Array<{ bg: Phaser.GameObjects.Rectangle; ms: number }> = [];
    const refreshPresetStyles = () => {
      const cur = sm.getShiftDurationMs();
      for (const p of presetBgRefs) {
        const active = p.ms === cur;
        p.bg.setStrokeStyle(2, active ? Colors.NEON_BLUE : Colors.BORDER_BLUE, active ? 1 : 0.5);
        p.bg.setFillStyle(active ? 0x0a1f3a : Colors.PANEL_DARK, 0.9);
      }
    };
    durationPresets.forEach((preset, i) => {
      const bx = panelX - btnW / 2 + i * (presetBtnW + 4) + presetBtnW / 2;
      const isActive = preset.ms === sm.getShiftDurationMs();
      const presetBg = this.scene.add.rectangle(bx, presetY, presetBtnW, 26, isActive ? 0x0a1f3a : Colors.PANEL_DARK, 0.9);
      presetBg.setStrokeStyle(2, isActive ? Colors.NEON_BLUE : Colors.BORDER_BLUE, isActive ? 1 : 0.5);
      presetBg.setInteractive();
      presetBg.on('pointerdown', () => {
        sm.updateShiftDuration(preset.ms);
        const s = this.timerState;
        s.shiftDurationMs = preset.ms;
        s.shiftTimerEvent?.remove();
        s.shiftStartTime = Date.now();
        s.shiftTimerEvent = this.scene.time.addEvent({
          delay: s.shiftDurationMs,
          callback: this.callbacks.onEndShift,
          callbackScope: null,
        });
        refreshPresetStyles();
      });
      presetBg.on('pointerover', () => { if (preset.ms !== sm.getShiftDurationMs()) presetBg.setFillStyle(Colors.BUTTON_HOVER, 0.6); });
      presetBg.on('pointerout',  () => refreshPresetStyles());
      const presetLbl = this.scene.add.bitmapText(bx, presetY, 'clicker', preset.label, 9).setOrigin(0.5);
      presetBgRefs.push({ bg: presetBg, ms: preset.ms });
      container.add([presetBg, presetLbl]);
    });

    container.add([btn, btnLabel, resetBtn, resetLabel, timerToggleBg, timerToggleLbl, durationLbl]);
  }
}
