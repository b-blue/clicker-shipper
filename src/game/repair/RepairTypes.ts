/**
 * Represents a single damaged component in a drone repair arrangement.
 * Owned and managed by ReOrientMode during the Re-Orient action.
 */
export interface RepairItem {
  iconKey: string;
  startRotationDeg: number;    // initial wrong angle shown when arrangement is built
  targetRotationDeg: number;   // randomized ring offset used to position the green zone
  currentRotationDeg: number;  // updated live during ring drag
  solved: boolean;
  iconObj: Phaser.GameObjects.Image;
  frameObj: Phaser.GameObjects.Graphics;
}

/**
 * Mutable shift-timer state shared between Game and SettingsPanel.
 * Both reads and writes go through this object by reference.
 */
export interface ShiftTimerState {
  timerPaused: boolean;
  timerPausedAt: number;
  shiftStartTime: number;
  shiftDurationMs: number;
  shiftTimerEvent: Phaser.Time.TimerEvent | null;
}
