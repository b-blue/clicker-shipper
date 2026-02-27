import Phaser from 'phaser';
import { MenuItem } from '../types/GameTypes';
import { Colors } from '../constants/Colors';
import { AssetLoader } from '../managers/AssetLoader';
import { RepairItem } from './RepairTypes';
import { DroneWireframe } from './DroneWireframe';

type Bounds = { cx: number; cy: number; w: number; h: number };

const ROT_OPTIONS = [30, 60, 90, 120, 135, 150, 180, 210, 240, 270, 300, 330];
/** Icon key for the re-orient action badge shown on each repair item card. */
const REORIENT_ACTION_ICON = 'skill-gear';

const STAGGER_MS        = 80;   // ms between each item appearing
const FADE_DUR          = 260;  // ms per individual fade
const REPAIRED_HOLD_MS  = 1400; // ms "DRONE REPAIRED" is visible

/**
 * Manages the Re-Orient repair action in the bottom 3/5 diagnostic panel.
 *
 * Sequence per repair event:
 *   buildArrangement() → materialize() → [player repairs] → dematerialize(cb)
 *
 * Items are created at alpha 0 so the panel is empty until
 * the drone has arrived in the top section.
 */
export class ReOrientMode {
  private scene: Phaser.Scene;
  private repairItems: RepairItem[] = [];
  private currentRepairItem: RepairItem | null = null;
  private botBounds: Bounds | null = null;
  private itemPool: any[] = [];
  /** Container saved from buildArrangement — needed to add the repaired label. */
  private lastContainer: Phaser.GameObjects.Container | null = null;
  private repairedLabel: Phaser.GameObjects.BitmapText | null = null;
  /** Wireframe sprite shown in the diagnostic panel, managed by DroneWireframe. */
  private wireframe: DroneWireframe | null = null;

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

  onRotated(data: { rotation: number }): void {
    if (!this.currentRepairItem) return;
    this.currentRepairItem.currentRotationDeg = data.rotation;
    this.currentRepairItem.iconObj.setAngle(data.rotation);
  }

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
      frameObj.strokeCircle(iconObj.x, iconObj.y, Math.round(iconObj.displayWidth / 2) + 2);
    }
    this.currentRepairItem = null;
    cornerHUD?.onGoBack();
    return this.isAllSolved();
  }

  // ── Arrangement building ───────────────────────────────────────────────

  /**
   * Builds the icon grid at alpha 0. Call materialize() once the drone arrives.
   *
   * Layout:
   *   count ≤ 4  →  square  (cols = ceil(sqrt(count)))
   *   count ≥ 5  →  2 rows  (cols = ceil(count / 2))
   */
  buildArrangement(container: Phaser.GameObjects.Container, count: number, droneKey?: string): void {
    this.destroyItems();
    this.lastContainer = container;
    if (!this.botBounds || this.itemPool.length === 0) return;
    const { cx, cy, w, h } = this.botBounds;

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

    // Cell size: fit inside botBounds with some padding
    const cellSize = Math.min(
      Math.floor((w - 20) / cols),
      Math.floor((h - 24) / rows),
      104,     // cap so icons don't get enormous on wide panels
    );
    const iconSize = Math.round(cellSize * 0.88);
    const GAP = 12;  // extra px between icon centres
    const cellStep = cellSize + GAP;

    const gridW = (cols - 1) * cellStep + cellSize;
    const gridH = (rows - 1) * cellStep + cellSize;
    const originX = cx - gridW / 2 + cellSize / 2;
    const originY = cy - gridH / 2 + cellSize / 2;

    // ── Wireframe drone — added FIRST so it renders behind all items ────────
    if (droneKey && this.scene.textures.exists(droneKey)) {
      this.wireframe = new DroneWireframe(
        this.scene, container, cx, cy, w, h, droneKey,
      );
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

      // Dark-panel background — visually lifts the icon from the wireframe behind it
      const bgObj = this.scene.add.graphics();
      bgObj.fillStyle(Colors.PANEL_DARK, 0.88);
      bgObj.fillCircle(vx, vy, r + 1);
      bgObj.setDepth(3).setAlpha(0);
      container.add(bgObj);

      // Frame circle
      const frameG = this.scene.add.graphics();
      frameG.lineStyle(2, Colors.BORDER_BLUE, 0.8);
      frameG.strokeCircle(vx, vy, r);
      frameG.setDepth(4).setAlpha(0);
      container.add(frameG);

      // Icon
      const iconKey: string = chosen[i].icon || chosen[i].id;
      let iconObj: Phaser.GameObjects.Image;
      if (AssetLoader.textureExists(this.scene, iconKey)) {
        iconObj = AssetLoader.createImage(this.scene, vx, vy, iconKey);
      } else {
        iconObj = this.scene.add.image(vx, vy, '').setVisible(false);
      }
      iconObj.setAngle(startRot).setDisplaySize(iconSize, iconSize).setDepth(5).setAlpha(0);
      container.add(iconObj);

      // Action badge: small circle in the bottom-right corner showing the repair action icon
      const badgeR  = Math.round(r * 0.56);  // scales with icon size; doubled from 0.28
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
        iconObj,
        frameObj: frameG,
        bgObj,
        badgeBg,
        badgeIcon,
      });
    }

  }

  // ── Transition helpers ────────────────────────────────────────────────

  /**
   * Staggered materialize: each icon + frame fades from alpha 0 → 1.
   */
  materialize(): void {
    // Wireframe: swipe-down reveal + animation start, both in sync with the
    // live drone (frame 0 at the same game tick).
    this.wireframe?.reveal();
    const targets = this.repairItems.flatMap(ri => [ri.bgObj, ri.frameObj, ri.iconObj, ri.badgeBg, ri.badgeIcon]);
    targets.forEach((obj, i) => {
      this.scene.tweens.add({
        targets: obj,
        alpha: { from: 0, to: 1 },
        duration: FADE_DUR,
        delay: i * STAGGER_MS,
        ease: 'Sine.easeOut',
      });
    });
  }

  /**
   * Staggered dematerialize: items fade out, then "DRONE REPAIRED" text
   * appears briefly before onComplete is called.
   */
  dematerialize(onComplete: () => void): void {
    if (!this.botBounds) { onComplete(); return; }
    const { cx, cy } = this.botBounds;

    const allObjs: Phaser.GameObjects.GameObject[] = [
      ...this.repairItems.flatMap(ri => [ri.bgObj, ri.frameObj, ri.iconObj, ri.badgeBg, ri.badgeIcon]),
      ...(this.wireframe?.sprite ? [this.wireframe.sprite] : []),
    ].reverse();

    allObjs.forEach((obj, i) => {
      this.scene.tweens.add({
        targets: obj,
        alpha: { to: 0 },
        duration: Math.round(FADE_DUR * 0.8),
        delay: i * Math.round(STAGGER_MS * 0.5),
        ease: 'Sine.easeIn',
      });
    });

    const totalFade = allObjs.length * STAGGER_MS * 0.5 + FADE_DUR * 0.8;

    this.scene.time.delayedCall(totalFade + 60, () => {
      if (!this.botBounds) { onComplete(); return; }
      const lbl = this.scene.add.bitmapText(cx, cy, 'clicker', 'DRONE REPAIRED', 13)
        .setOrigin(0.5).setTint(0x00e864).setDepth(10).setAlpha(0);
      this.lastContainer?.add(lbl);
      this.repairedLabel = lbl;

      this.scene.tweens.add({
        targets: lbl,
        alpha: { from: 0, to: 1 },
        duration: 300,
        ease: 'Sine.easeOut',
        onComplete: () => {
          this.scene.time.delayedCall(REPAIRED_HOLD_MS, () => {
            this.scene.tweens.add({
              targets: lbl,
              alpha: { to: 0 },
              duration: 250,
              ease: 'Sine.easeIn',
              onComplete: () => {
                lbl.destroy();
                this.repairedLabel = null;
                onComplete();
              },
            });
          });
        },
      });
    });
  }

  destroy(): void {
    this.destroyItems();
  }

  // ── private ────────────────────────────────────────────────────────────

  private destroyItems(): void {
    for (const ri of this.repairItems) {
      ri.iconObj.destroy(); ri.frameObj.destroy();
      ri.bgObj.destroy(); ri.badgeBg.destroy(); ri.badgeIcon.destroy();
    }
    this.repairedLabel?.destroy();
    this.wireframe?.destroy();
    this.repairItems       = [];
    this.repairedLabel     = null;
    this.wireframe         = null;
    this.currentRepairItem = null;
  }

}
