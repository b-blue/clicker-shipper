import Phaser from 'phaser';
import { MenuItem } from '../types/GameTypes';
import { Colors } from '../constants/Colors';
import { AssetLoader } from '../managers/AssetLoader';
import { RepairItem } from './RepairTypes';

type Bounds = { cx: number; cy: number; w: number; h: number };

const ROT_OPTIONS = [30, 60, 90, 120, 135, 150, 180, 210, 240, 270, 300, 330];

const ARM = 14;
const PAD = 10;
const STAGGER_MS        = 80;   // ms between each item appearing
const FADE_DUR          = 260;  // ms per individual fade
const REPAIRED_HOLD_MS  = 1400; // ms "DRONE REPAIRED" is visible

/**
 * Manages the Re-Orient repair action in the bottom 3/5 diagnostic panel.
 *
 * Sequence per repair event:
 *   buildArrangement() → materialize() → [player repairs] → dematerialize(cb)
 *
 * Items and brackets are created at alpha 0 so the panel is empty until
 * the drone has arrived in the top section.
 */
export class ReOrientMode {
  private scene: Phaser.Scene;
  private repairItems: RepairItem[] = [];
  private currentRepairItem: RepairItem | null = null;
  private botBounds: Bounds | null = null;
  private itemPool: any[] = [];
  private bracketGraphics: Phaser.GameObjects.Graphics[] = [];
  /** Container saved from buildArrangement — needed to add the repaired label. */
  private lastContainer: Phaser.GameObjects.Container | null = null;
  private repairedLabel: Phaser.GameObjects.BitmapText | null = null;
  /** Wireframe (DiagnosticFX) drone sprite rendered behind the icon grid. */
  private wireframeSprite: Phaser.GameObjects.Sprite | null = null;

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
      frameObj.strokeCircle(iconObj.x, iconObj.y, 28);
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
      52,      // cap so icons don't get enormous on wide panels
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
      // Scale to near-fill the bottom panel: cap to 92% of each dimension
      const dispSize = Math.round(Math.min(w * 0.92, h * 0.92));
      const wf = this.scene.add.sprite(cx, cy, droneKey);
      wf.setDisplaySize(dispSize, dispSize).setDepth(1).setAlpha(0);
      if (typeof (wf as any).setPostPipeline === 'function') {
        (wf as any).setPostPipeline('DiagnosticFX');
        // Set pendingEdgeColor on the raw instance now — onBoot() reads it
        // when the pipeline first draws, before this.uniforms exists.
        const rawPipe = (wf as any).getPostPipeline?.('DiagnosticFX');
        const inst = Array.isArray(rawPipe) ? rawPipe[0] : rawPipe;
        if (inst) inst.pendingEdgeColor = [0.28, 0.40, 0.32];
      }
      // Animate to match the live drone at the top
      if (this.scene.anims.exists(droneKey)) wf.play(droneKey);
      container.add(wf);
      this.wireframeSprite = wf;
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

    // ── Corner brackets around the grid ──────────────────────────────────
    this.drawGridBrackets(container, cx, cy, gridW, gridH);
  }

  // ── Transition helpers ────────────────────────────────────────────────

  /**
   * Staggered materialize: each icon + frame fades from alpha 0 → 1.
   * Brackets follow once all icons are visible.
   */
  materialize(): void {
    // Wireframe drone fades in first (or simultaneously with items)
    if (this.wireframeSprite) {
      this.scene.tweens.add({
        targets: this.wireframeSprite,
        alpha: { from: 0, to: 0.35 },
        duration: FADE_DUR,
        delay: 0,
        ease: 'Sine.easeOut',
      });
    }
    const targets = this.repairItems.flatMap(ri => [ri.frameObj, ri.iconObj]);
    targets.forEach((obj, i) => {
      this.scene.tweens.add({
        targets: obj,
        alpha: { from: 0, to: 1 },
        duration: FADE_DUR,
        delay: i * STAGGER_MS,
        ease: 'Sine.easeOut',
      });
    });
    const bracketDelay = targets.length * STAGGER_MS + FADE_DUR / 2;
    this.bracketGraphics.forEach(g => {
      this.scene.tweens.add({
        targets: g,
        alpha: { from: 0, to: 1 },
        duration: FADE_DUR,
        delay: bracketDelay,
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
      ...this.bracketGraphics,
      ...this.repairItems.flatMap(ri => [ri.frameObj, ri.iconObj]),
      ...(this.wireframeSprite ? [this.wireframeSprite] : []),
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

  /**
   * Draws L-shaped corner brackets (neon green) that tightly bound the icon grid.
   * Created at alpha 0 — made visible by materialize().
   */
  private drawGridBrackets(
    container: Phaser.GameObjects.Container,
    cx: number, cy: number, gridW: number, gridH: number,
  ): void {
    const left  = cx - gridW / 2 - PAD;
    const right = cx + gridW / 2 + PAD;
    const top   = cy - gridH / 2 - PAD;
    const bot   = cy + gridH / 2 + PAD;

    const g = this.scene.add.graphics();
    g.setDepth(8).setAlpha(0);
    g.lineStyle(2, 0x00e864, 0.9);

    const corners: Array<[number, number, number, number]> = [
      [left,  top,   1,  1],
      [right, top,  -1,  1],
      [left,  bot,   1, -1],
      [right, bot,  -1, -1],
    ];
    for (const [bx, by, dx, dy] of corners) {
      g.beginPath();
      g.moveTo(bx + dx * ARM, by);
      g.lineTo(bx, by);
      g.lineTo(bx, by + dy * ARM);
      g.strokePath();
    }
    container.add(g);
    this.bracketGraphics.push(g);
  }

  private destroyItems(): void {
    for (const ri of this.repairItems) { ri.iconObj.destroy(); ri.frameObj.destroy(); }
    for (const g of this.bracketGraphics) g.destroy();
    this.repairedLabel?.destroy();
    this.wireframeSprite?.destroy();
    this.repairItems      = [];
    this.bracketGraphics  = [];
    this.repairedLabel    = null;
    this.wireframeSprite  = null;
    this.currentRepairItem = null;
  }

  /**
   * Phaser 3.60+ getPostPipeline() can return an array; this helper always
   * returns the single pipeline instance (or null if not found / not yet booted).
   * Guards on `instance.uniforms` being populated — set3f crashes if called
   * before onBoot() fires on first draw.
   */
  private static getPipelineInstance(
    sprite: Phaser.GameObjects.Sprite,
    name: string,
  ): any {
    const raw = (sprite as any).getPostPipeline?.(name);
    if (!raw) return null;
    const instance = Array.isArray(raw) ? raw[0] : raw;
    // uniforms is only populated after onBoot — guard before calling set3f
    return (instance && typeof instance.set3f === 'function' && instance.uniforms)
      ? instance : null;
  }
}
