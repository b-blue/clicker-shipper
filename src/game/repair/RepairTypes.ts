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
  /**
   * Set to true when the player fails the primary repair action for this item.
   * Once true the item can only be resolved via the Replace delivery flow.
   */
  requiresReplace: boolean;
  iconObj: Phaser.GameObjects.Image;
  frameObj: Phaser.GameObjects.Graphics;
  /** Dark-panel fill circle behind the icon — separates it from the wireframe bg. */
  bgObj: Phaser.GameObjects.Graphics;
  /** Small circular badge background in the bottom-right corner of each icon cell. */
  badgeBg: Phaser.GameObjects.Graphics;
  /** Action icon shown inside the badge (e.g. skill-refresh for re-orient). */
  badgeIcon: Phaser.GameObjects.Image;
  /** Rotating blue ring drawn around the badge when this item needs replacement. */
  badgeRing?: Phaser.GameObjects.Graphics;
}
