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
