import Phaser from 'phaser';
import { MenuItem } from '../types/GameTypes';
import { Colors } from '../constants/Colors';
import { AssetLoader } from '../managers/AssetLoader';
import { RepairItem } from './RepairTypes';
import { DroneWireframe } from './DroneWireframe';
import { IRepairTask, TaskBounds } from './IRepairTask';

const ROT_OPTIONS = [30, 60, 90, 120, 135, 150, 180, 210, 240, 270, 300, 330];
/** Icon key for the re-orient action badge shown on each repair item card. */
const REORIENT_ACTION_ICON = 'skill-refresh';

/**
 * Re-Orient repair task.
 *
 * Picks items from the pool, builds the icon grid and manages rotation
 * game-logic. Animation (materialize/dematerialize) lives in RepairPanel.
 *
 * Outward scene events emitted:
 *   repair:showDial   { item, currentRotationDeg, targetRotationDeg }
 *   repair:noMatch    {}
 *   repair:itemSolved {}   (one item repaired, more remain)
 *   repair:allSolved  {}   (all items in this arrangement are done)
 */
export class ReOrientMode implements IRepairTask {
  private scene: Phaser.Scene;
  private repairItems: RepairItem[] = [];
  private currentRepairItem: RepairItem | null = null;
  private itemPool: any[] = [];
  private wireframe: DroneWireframe | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // ── IRepairTask lifecycle ─────────────────────────────────────────────

  activate(): void {
    this.scene.events.on('dial:repairRotated', this.onRotatedInternal, this);
    this.scene.events.on('dial:repairSettled', this.onSettledInternal, this);
  }

  deactivate(): void {
    this.scene.events.off('dial:repairRotated', this.onRotatedInternal, this);
    this.scene.events.off('dial:repairSettled', this.onSettledInternal, this);
  }

  // ── IRepairTask data accessors ────────────────────────────────────────

  /** Sets the pool of items that arrangements are drawn from. */
  setPool(items: any[]): void {
    this.itemPool = items;
  }

  getItems(): RepairItem[] {
    return this.repairItems;
  }

  getWireframe(): DroneWireframe | null {
    return this.wireframe;
  }

  isAllSolved(): boolean {
    return this.repairItems.length > 0 && this.repairItems.every(r => r.solved);
  }

  clearCurrent(): void {
    this.currentRepairItem = null;
  }

  resolveItem(iconKey: string): void {
    const item = this.repairItems.find(r => r.iconKey === iconKey && r.requiresReplace && !r.solved);
    if (!item) return;
    item.solved = true;
    // Redraw frame in solved green
    item.frameObj.clear();
    item.frameObj.lineStyle(3, 0x44ff88, 1.0);
    item.frameObj.strokeCircle(item.iconObj.x, item.iconObj.y, Math.round(item.iconObj.displayWidth / 2) + 2);
    this.scene.events.emit(this.isAllSolved() ? 'repair:allSolved' : 'repair:itemSolved');
  }

  // ── IRepairTask nav events ────────────────────────────────────────────

  /**
   * Called when dial:itemConfirmed fires while this task is active.
   * Emits repair:showDial on match, repair:noMatch otherwise.
   */
  onItemSelected(item: MenuItem): void {
    const iconKey = item.icon || item.id;
    const match   = this.repairItems.find(r => r.iconKey === iconKey && !r.solved);
    if (!match) {
      this.scene.events.emit('repair:noMatch');
      return;
    }
    // If this item previously failed it now needs replacement — re-emitting
    // noMatch causes the dial to reset; repairPanel handles the badge swap.
    if (match.requiresReplace) {
      this.scene.events.emit('repair:noMatch');
      return;
    }
    this.currentRepairItem = match;
    this.scene.events.emit('repair:showDial', {
      item,
      currentRotationDeg: match.currentRotationDeg,
      targetRotationDeg:  match.targetRotationDeg,
    });
  }

  // ── Arrangement building ───────────────────────────────────────────────

  /**
   * Builds the icon grid at alpha 0. Call RepairPanel.materialize() once the drone arrives.
   *
   * Layout:
   *   count ≤ 4  →  square  (cols = ceil(sqrt(count)))
   *   count ≥ 5  →  2 rows  (cols = ceil(count / 2))
   */
  buildArrangement(
    container: Phaser.GameObjects.Container,
    bounds: TaskBounds,
    count: number,
    droneKey?: string,
  ): void {
    this.destroyItems();
    if (this.itemPool.length === 0) return;

    const { cx, cy, w, h } = bounds;

    const n      = Math.max(2, Math.min(count, 8));
    const actual = Math.min(n, this.itemPool.length);
    const chosen = [...this.itemPool].sort(() => Math.random() - 0.5).slice(0, actual);

    // ── Grid dimensions ──────────────────────────────────────────────────
    let cols: number, rows: number;
    if (actual <= 4) {
      cols = Math.ceil(Math.sqrt(actual));
      rows = Math.ceil(actual / cols);
    } else {
      cols = Math.ceil(actual / 2);
      rows = 2;
    }

    const cellSize = Math.min(
      Math.floor((w - 20) / cols),
      Math.floor((h - 24) / rows),
      104,
    );
    const iconSize = Math.round(cellSize * 0.88);
    const GAP      = 12;
    const cellStep = cellSize + GAP;

    const gridW   = (cols - 1) * cellStep + cellSize;
    const gridH   = (rows - 1) * cellStep + cellSize;
    const originX = cx - gridW / 2 + cellSize / 2;
    const originY = cy - gridH / 2 + cellSize / 2;

    // ── Wireframe drone — added FIRST so it renders behind all items ────
    if (droneKey && this.scene.textures.exists(droneKey)) {
      this.wireframe = new DroneWireframe(this.scene, container, cx, cy, w, h, droneKey);
    }

    for (let i = 0; i < chosen.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const vx  = originX + col * cellStep;
      const vy  = originY + row * cellStep;

      const startRot = ROT_OPTIONS[Math.floor(Math.random() * ROT_OPTIONS.length)];
      let targetRot  = ROT_OPTIONS[Math.floor(Math.random() * ROT_OPTIONS.length)];
      while (targetRot === startRot) targetRot = ROT_OPTIONS[Math.floor(Math.random() * ROT_OPTIONS.length)];

      const r = Math.round(iconSize / 2) + 2;

      const bgObj = this.scene.add.graphics();
      bgObj.fillStyle(Colors.PANEL_DARK, 0.88);
      bgObj.fillCircle(vx, vy, r + 1);
      bgObj.setDepth(3).setAlpha(0);
      container.add(bgObj);

      const frameG = this.scene.add.graphics();
      frameG.lineStyle(2, Colors.BORDER_BLUE, 0.8);
      frameG.strokeCircle(vx, vy, r);
      frameG.setDepth(4).setAlpha(0);
      container.add(frameG);

      const iconKey: string = chosen[i].icon || chosen[i].id;
      let iconObj: Phaser.GameObjects.Image;
      if (AssetLoader.textureExists(this.scene, iconKey)) {
        iconObj = AssetLoader.createImage(this.scene, vx, vy, iconKey);
      } else {
        iconObj = this.scene.add.image(vx, vy, '').setVisible(false);
      }
      iconObj.setAngle(startRot).setDisplaySize(iconSize, iconSize).setDepth(5).setAlpha(0);
      container.add(iconObj);

      const badgeR  = Math.round(r * 0.56);
      const badgeCx = vx + r * 0.62;
      const badgeCy = vy + r * 0.62;

      const badgeBg = this.scene.add.graphics();
      badgeBg.fillStyle(Colors.PANEL_DARK, 0.95);
      badgeBg.fillCircle(badgeCx, badgeCy, badgeR);
      badgeBg.lineStyle(1, Colors.NEON_BLUE, 0.85);
      badgeBg.strokeCircle(badgeCx, badgeCy, badgeR);
      badgeBg.setDepth(7).setAlpha(0);
      container.add(badgeBg);

      let badgeIcon: Phaser.GameObjects.Image;
      if (AssetLoader.textureExists(this.scene, REORIENT_ACTION_ICON)) {
        badgeIcon = AssetLoader.createImage(this.scene, badgeCx, badgeCy, REORIENT_ACTION_ICON);
      } else {
        badgeIcon = this.scene.add.image(badgeCx, badgeCy, '').setVisible(false);
      }
      badgeIcon.setDisplaySize(badgeR * 1.5, badgeR * 1.5).setDepth(8).setAlpha(0);
      container.add(badgeIcon);

      this.repairItems.push({
        iconKey,
        startRotationDeg: startRot,
        targetRotationDeg: targetRot,
        currentRotationDeg: startRot,
        solved: false,
        requiresReplace: false,
        iconObj,
        frameObj: frameG,
        bgObj,
        badgeBg,
        badgeIcon,
      });
    }
  }

  destroy(): void {
    this.destroyItems();
  }

  // ── Private dial event handlers (subscribed in activate) ─────────────

  private onRotatedInternal(data: { rotation: number }): void {
    if (!this.currentRepairItem) return;
    this.currentRepairItem.currentRotationDeg = data.rotation;
    this.currentRepairItem.iconObj.setAngle(data.rotation);
  }

  private onSettledInternal(data: { success: boolean }): void {
    if (!this.currentRepairItem) return;
    if (data.success) {
      this.currentRepairItem.currentRotationDeg = 0;
      this.currentRepairItem.iconObj.setAngle(0);
      this.currentRepairItem.solved = true;
      const { iconObj, frameObj } = this.currentRepairItem;
      frameObj.clear();
      frameObj.lineStyle(3, 0x44ff88, 1.0);
      frameObj.strokeCircle(iconObj.x, iconObj.y, Math.round(iconObj.displayWidth / 2) + 2);
    } else {
      // Mark this item as requiring physical replacement.
      // RepairPanel will visually dim it and swap its badge.
      this.currentRepairItem.requiresReplace = true;
      this.scene.events.emit('repair:itemFailed', { iconKey: this.currentRepairItem.iconKey });
    }
    this.currentRepairItem = null;
    if (data.success) {
      this.scene.events.emit(this.isAllSolved() ? 'repair:allSolved' : 'repair:itemSolved');
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────

  private destroyItems(): void {
    for (const ri of this.repairItems) {
      ri.iconObj.destroy(); ri.frameObj.destroy();
      ri.bgObj.destroy(); ri.badgeBg.destroy(); ri.badgeIcon.destroy();
      ri.badgeRing?.destroy();
    }
    this.wireframe?.destroy();
    this.repairItems       = [];
    this.wireframe         = null;
    this.currentRepairItem = null;
  }

}
