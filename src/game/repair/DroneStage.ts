import Phaser from 'phaser';
import { DIAGNOSTIC_FX } from '../fx/DiagnosticFXPipeline';

type Bounds = { cx: number; cy: number; w: number; h: number };

const IDLE_KEYS = [
  'drone-1-idle', 'drone-3-idle', 'drone-4-idle',
  'drone-5-idle', 'drone-5b-idle',
];

/**
 * Manages spawning and exiting the drone sprite in the top half of the Repair panel.
 * Does NOT own the Phaser container — callers pass it in at spawn time.
 */
export class DroneStage {
  private scene: Phaser.Scene;
  private droneSprite: Phaser.GameObjects.Sprite | null = null;
  private topBounds: Bounds | null = null;
  private overlays: Phaser.GameObjects.Graphics[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  setTopBounds(bounds: Bounds): void {
    this.topBounds = bounds;
  }

  getSprite(): Phaser.GameObjects.Sprite | null {
    return this.droneSprite;
  }

  /** Picks a random idle drone, tweens it in from off-screen left. */
  spawn(container: Phaser.GameObjects.Container): void {
    if (!this.topBounds) return;
    const { cx, cy, w, h } = this.topBounds;

    const key = IDLE_KEYS[Math.floor(Math.random() * IDLE_KEYS.length)];
    this.registerAnim(key);

    const startX = cx - w / 2 - 80;
    const sprite = this.scene.add.sprite(startX, cy, key).setScale(3).setDepth(5);
    sprite.play(key);

    // Diagnostic wireframe: Sobel edge-detection PostFX (WebGL only)
    if (this.scene.game.renderer.type === Phaser.WEBGL) {
      sprite.setPostPipeline(DIAGNOSTIC_FX);
    }

    container.add(sprite);
    this.droneSprite = sprite;

    // Static diagnostic overlays (scan lines + corner brackets)
    this.clearOverlays();
    this.addScanlines(container, cx, cy, w, h);
    this.addCornerBrackets(container, cx, cy);

    this.scene.tweens.add({ targets: sprite, x: cx, duration: 600, ease: 'Cubic.easeOut' });
  }

  /**
   * Tweens the drone off-screen right, destroys it, then fires onComplete.
   * A short delay before onComplete gives time for the next drone to appear.
   */
  exit(onComplete: () => void): void {
    if (!this.droneSprite || !this.topBounds) {
      this.clearOverlays();
      onComplete();
      return;
    }
    const exitX = this.topBounds.cx + this.topBounds.w / 2 + 80;
    this.scene.tweens.add({
      targets: this.droneSprite,
      x: exitX,
      duration: 500,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.droneSprite?.destroy();
        this.droneSprite = null;
        this.clearOverlays();
        this.scene.time.delayedCall(200, onComplete);
      },
    });
  }

  destroy(): void {
    this.droneSprite?.destroy();
    this.droneSprite = null;
    this.clearOverlays();
  }

  // ── private helpers ────────────────────────────────────────────────────

  /** Destroy and remove all diagnostic overlay graphics. */
  private clearOverlays(): void {
    for (const g of this.overlays) g.destroy();
    this.overlays = [];
  }

  /**
   * Horizontal scan-line stripes over the drone stage area — CRT / diagnostic look.
   * Drawn at very low alpha so they don't obscure the wireframe edges.
   */
  private addScanlines(
    container: Phaser.GameObjects.Container,
    cx: number, cy: number, w: number, h: number
  ): void {
    const g = this.scene.add.graphics();
    g.setDepth(6);
    const top    = cy - h / 2;
    const left   = cx - w / 2;
    const step   = 5;
    g.lineStyle(1, 0x00e864, 0.07);
    for (let y = top; y < top + h; y += step) {
      g.lineBetween(left, y, left + w, y);
    }
    container.add(g);
    this.overlays.push(g);
  }

  /**
   * Four L-shaped corner brackets around the drone centroid — targeting-reticle
   * motif common to diagnostic / HUD displays.
   */
  private addCornerBrackets(
    container: Phaser.GameObjects.Container,
    cx: number, cy: number
  ): void {
    const ARM  = 18;   // px per bracket arm
    const PAD  = 48;   // half-size of the bounding box
    const g    = this.scene.add.graphics();
    g.setDepth(7);
    g.lineStyle(2, 0x00e864, 0.9);

    const corners: Array<[number, number, number, number]> = [
      // [cornerX, cornerY, xDir, yDir]
      [cx - PAD, cy - PAD,  1,  1],
      [cx + PAD, cy - PAD, -1,  1],
      [cx - PAD, cy + PAD,  1, -1],
      [cx + PAD, cy + PAD, -1, -1],
    ];

    for (const [bx, by, dx, dy] of corners) {
      g.beginPath();
      g.moveTo(bx + dx * ARM, by);
      g.lineTo(bx, by);
      g.lineTo(bx, by + dy * ARM);
      g.strokePath();
    }

    container.add(g);
    this.overlays.push(g);
  }

  /** Lazily registers a Phaser animation from a horizontal sprite strip (square frames). */
  private registerAnim(key: string): void {
    if (this.scene.anims.exists(key)) return;
    const tex = this.scene.textures.get(key);
    const src = tex.source[0];
    const frameH     = src.height;
    const frameCount = Math.max(1, Math.floor(src.width / frameH));
    for (let i = 0; i < frameCount; i++) {
      if (!tex.has(String(i))) tex.add(String(i), 0, i * frameH, 0, frameH, frameH);
    }
    const frames = Array.from({ length: frameCount }, (_, i) => ({ key, frame: String(i) }));
    this.scene.anims.create({ key, frames, frameRate: 8, repeat: -1 });
  }
}
