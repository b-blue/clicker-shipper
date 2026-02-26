import Phaser from 'phaser';

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
    const { cx, cy, w } = this.topBounds;

    const key = IDLE_KEYS[Math.floor(Math.random() * IDLE_KEYS.length)];
    this.registerAnim(key);

    const startX = cx - w / 2 - 80;
    const sprite = this.scene.add.sprite(startX, cy, key).setScale(3).setDepth(5);
    sprite.play(key);
    container.add(sprite);
    this.droneSprite = sprite;

    this.scene.tweens.add({ targets: sprite, x: cx, duration: 600, ease: 'Cubic.easeOut' });
  }

  /**
   * Tweens the drone off-screen right, destroys it, then fires onComplete.
   * A short delay before onComplete gives time for the next drone to appear.
   */
  exit(onComplete: () => void): void {
    if (!this.droneSprite || !this.topBounds) {
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
        this.scene.time.delayedCall(200, onComplete);
      },
    });
  }

  destroy(): void {
    this.droneSprite?.destroy();
    this.droneSprite = null;
  }

  // ── private helpers ────────────────────────────────────────────────────

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
