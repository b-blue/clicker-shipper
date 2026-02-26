#!/usr/bin/env python3
import os
DEST = os.path.join(os.path.dirname(__file__), '..', 'src', 'game', 'repair', 'ReOrientMode.ts')
CONTENT = r"""import Phaser from 'phaser';
import { MenuItem } from '../types/GameTypes';
import { Colors } from '../constants/Colors';
import { AssetLoader } from '../managers/AssetLoader';
import { RepairItem } from './RepairTypes';

type Bounds = { cx: number; cy: number; w: number; h: number };

// Guaranteed-wrong starting angles — multiples of 30°, excluding 0° / 360°
const ROT_OPTIONS = [30, 60, 90, 120, 135, 150, 180, 210, 240, 270, 300, 330];

const ARM = 14;    // corner-bracket arm length (px)
const PAD = 10;    // padding around icon grid for brackets

/**
 * Manages the Re-Orient repair action:
 *  - Builds a grid icon arrangement in the bottom 3/5 of the Repair panel
 *  - Handles incoming dial events (item selected, ring rotated, ring settled)
 *  - Tracks solved state per arrangement; reports "all solved" to the caller
 */
export class ReOrientMode {
  private scene: Phaser.Scene;
  private repairItems: RepairItem[] = [];
  private currentRepairItem: RepairItem | null = null;
  private botBounds: Bounds | null = null;
  private itemPool: any[] = [];
  /** Extra graphics (corner brackets) destroyed alongside items. */
  private bracketGraphics: Phaser.GameObjects.Graphics[] = [];

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
   * Destroys any existing arrangement and builds a fresh icon grid.
   *
   * Layout rules:
   *   count ≤ 4  →  square grid  (cols = ceil(sqrt(count)), rows = ceil(count / cols))
   *   count ≥ 5  →  2-row rect   (cols = ceil(count / 2), rows = 2)
   *
   * Icons are placed left-to-right, top-to-bottom; grid is centred in botBounds.
   * Corner brackets are drawn around the tight bounding box of the grid.
   *
   * @param count  Explicit icon count driven by drone frame size (from DroneStage).
   */
  buildArrangement(container: Phaser.GameObjects.Container, count: number): void {
    this.destroyItems();
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
    const iconSize = Math.round(cellSize * 0.72);

    const gridW = cols * cellSize;
    const gridH = rows * cellSize;
    const originX = cx - gridW / 2 + cellSize / 2;
    const originY = cy - gridH / 2 + cellSize / 2;

    for (let i = 0; i < chosen.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const vx  = originX + col * cellSize;
      const vy  = originY + row * cellSize;

      const startRot = ROT_OPTIONS[Math.floor(Math.random() * ROT_OPTIONS.length)];
      let targetRot  = ROT_OPTIONS[Math.floor(Math.random() * ROT_OPTIONS.length)];
      while (targetRot === startRot) targetRot = ROT_OPTIONS[Math.floor(Math.random() * ROT_OPTIONS.length)];

      const r = Math.round(iconSize / 2) + 2;

      // Frame circle
      const frameG = this.scene.add.graphics();
      frameG.lineStyle(2, Colors.BORDER_BLUE, 0.8);
      frameG.strokeCircle(vx, vy, r);
      frameG.setDepth(4);
      container.add(frameG);

      // Icon
      const iconKey: string = chosen[i].icon || chosen[i].id;
      let iconObj: Phaser.GameObjects.Image;
      if (AssetLoader.textureExists(this.scene, iconKey)) {
        iconObj = AssetLoader.createImage(this.scene, vx, vy, iconKey);
      } else {
        iconObj = this.scene.add.image(vx, vy, '').setVisible(false);
      }
      iconObj.setAngle(startRot).setDisplaySize(iconSize, iconSize).setDepth(5);
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

  destroy(): void {
    this.destroyItems();
  }

  // ── private ────────────────────────────────────────────────────────────

  /**
   * Draws L-shaped corner brackets (neon green) that tightly bound the icon grid.
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
    g.setDepth(8);
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
    for (const ri of this.repairItems) {
      ri.iconObj.destroy();
      ri.frameObj.destroy();
    }
    for (const g of this.bracketGraphics) g.destroy();
    this.repairItems = [];
    this.bracketGraphics = [];
    this.currentRepairItem = null;
  }
}
"""
with open(DEST, 'w') as fh:
    fh.write(CONTENT)
print(f"Written {len(CONTENT)} chars to {DEST}")
