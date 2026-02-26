import Phaser from 'phaser';
import { MenuItem } from '../types/GameTypes';
import { Colors } from '../constants/Colors';
import { AssetLoader } from '../managers/AssetLoader';
import { RepairItem } from './RepairTypes';

type Bounds = { cx: number; cy: number; w: number; h: number };

// Guaranteed-wrong starting angles — multiples of 30°, excluding 0° / 360°
const ROT_OPTIONS = [30, 60, 90, 120, 135, 150, 180, 210, 240, 270, 300, 330];

/**
 * Manages the Re-Orient repair action:
 *  - Builds the polygon item arrangement in the bottom half of the Repair panel
 *  - Handles incoming dial events (item selected, ring rotated, ring settled)
 *  - Tracks solved state per arrangement; reports "all solved" to the caller
 */
export class ReOrientMode {
  private scene: Phaser.Scene;
  private repairItems: RepairItem[] = [];
  private currentRepairItem: RepairItem | null = null;
  private botBounds: Bounds | null = null;
  private itemPool: any[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  setBotBounds(bounds: Bounds): void {
    this.botBounds = bounds;
  }

  /** Sets the pool of items that arrangements are drawn from. */
  setPool(items: any[]): void {
    this.itemPool = items;
  }

  getItems(): RepairItem[] {
    return this.repairItems;
  }

  isAllSolved(): boolean {
    return this.repairItems.length > 0 && this.repairItems.every(r => r.solved);
  }

  clearCurrent(): void {
    this.currentRepairItem = null;
  }

  // ── Dial event handlers ────────────────────────────────────────────────

  /**
   * Called when the player confirms a slice that matches a repair item.
   * Returns false and resets the dial if no unsolved match is found.
   */
  onItemSelected(
    item: MenuItem,
    dial: { showRepairDial: (i: MenuItem, rot: number, target: number) => void; reset: () => void },
    cornerHUD: { onItemConfirmed: () => void } | null,
  ): void {
    const iconKey = item.icon || item.id;
    const match = this.repairItems.find(r => r.iconKey === iconKey && !r.solved);
    if (!match) {
      dial.reset();
      return;
    }
    dial.showRepairDial(item, match.currentRotationDeg, match.targetRotationDeg);
    this.currentRepairItem = match;
    cornerHUD?.onItemConfirmed();
  }

  /** Called on every drag tick — keeps the item icon in sync with the ring. */
  onRotated(data: { rotation: number }): void {
    if (!this.currentRepairItem) return;
    this.currentRepairItem.currentRotationDeg = data.rotation;
    this.currentRepairItem.iconObj.setAngle(data.rotation);
  }

  /**
   * Called when the player lifts off the repair ring.
   * Returns true when every item in the arrangement has been solved.
   */
  onSettled(
    data: { success: boolean },
    cornerHUD: { onGoBack: () => void } | null,
  ): boolean {
    if (!this.currentRepairItem) return false;
    if (data.success) {
      this.currentRepairItem.currentRotationDeg = 0;
      this.currentRepairItem.iconObj.setAngle(0);
      this.currentRepairItem.solved = true;
      const { iconObj, frameObj } = this.currentRepairItem;
      frameObj.clear();
      frameObj.lineStyle(3, 0x44ff88, 1.0);
      frameObj.strokeCircle(iconObj.x, iconObj.y, 28);
    }
    this.currentRepairItem = null;
    cornerHUD?.onGoBack();
    return this.isAllSolved();
  }

  // ── Arrangement building ───────────────────────────────────────────────

  /**
   * Destroys any existing arrangement and builds a fresh 2–6 item polygon
   * with randomised wrong rotations.
   */
  buildArrangement(container: Phaser.GameObjects.Container): void {
    this.destroyItems();
    if (!this.botBounds || this.itemPool.length === 0) return;
    const { cx, cy, w, h } = this.botBounds;

    const n     = 2 + Math.floor(Math.random() * 5); // 2–6
    const count = Math.min(n, this.itemPool.length);
    const chosen = [...this.itemPool].sort(() => Math.random() - 0.5).slice(0, count);

    const polygonRadius = Math.min(w, h) * 0.32;

    for (let i = 0; i < chosen.length; i++) {
      const item     = chosen[i];
      const angle    = -Math.PI / 2 + (i / chosen.length) * 2 * Math.PI;
      const vx       = cx + Math.cos(angle) * polygonRadius;
      const vy       = cy + Math.sin(angle) * polygonRadius;
      const startRot = ROT_OPTIONS[Math.floor(Math.random() * ROT_OPTIONS.length)];
      let targetRot  = ROT_OPTIONS[Math.floor(Math.random() * ROT_OPTIONS.length)];
      while (targetRot === startRot) targetRot = ROT_OPTIONS[Math.floor(Math.random() * ROT_OPTIONS.length)];

      // Frame circle
      const frameG = this.scene.add.graphics();
      frameG.lineStyle(2, Colors.BORDER_BLUE, 0.8);
      frameG.strokeCircle(vx, vy, 28);
      frameG.setDepth(4);
      container.add(frameG);

      // Icon
      const iconKey: string = item.icon || item.id;
      let iconObj: Phaser.GameObjects.Image;
      if (AssetLoader.textureExists(this.scene, iconKey)) {
        iconObj = AssetLoader.createImage(this.scene, vx, vy, iconKey);
      } else {
        iconObj = this.scene.add.image(vx, vy, '').setVisible(false);
      }
      iconObj.setAngle(startRot).setScale(0.9).setDepth(5);
      container.add(iconObj);

      this.repairItems.push({
        iconKey,
        startRotationDeg: startRot,
        targetRotationDeg: targetRot,
        currentRotationDeg: startRot,
        solved: false,
        iconObj,
        frameObj: frameG,
      });
    }
  }

  destroy(): void {
    this.destroyItems();
  }

  // ── private ────────────────────────────────────────────────────────────

  private destroyItems(): void {
    for (const ri of this.repairItems) {
      ri.iconObj.destroy();
      ri.frameObj.destroy();
    }
    this.repairItems = [];
    this.currentRepairItem = null;
  }
}
