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
  private overlays: Phaser.GameObjects.Graphics[] = [];
  private pendingKey: string | null = null;
  private currentKey: string | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  setTopBounds(bounds: Bounds): void {
    this.topBounds = bounds;
  }

  getSprite(): Phaser.GameObjects.Sprite | null {
    return this.droneSprite;
  }

  /** Returns the key that was most recently picked (set by pickKey). */
  getCurrentKey(): string | null {
    return this.currentKey;
  }

  /**
   * Pre-selects a random drone key so callers can read the frame size
   * (and therefore compute the icon count) before spawn() is called.
   */
  pickKey(): void {
    this.pendingKey = IDLE_KEYS[Math.floor(Math.random() * IDLE_KEYS.length)];
    this.currentKey = this.pendingKey;
  }

  /**
   * Returns the pixel height of one frame for the currently-pending key.
   * This is the sprite's natural frame size, used to derive icon count.
   * Falls back to a medium value (64) if no key has been picked yet.
   */
  iconCountForCurrentKey(): number {
    if (!this.pendingKey) return 4;
    this.registerAnim(this.pendingKey);
    const tex = this.scene.textures.get(this.pendingKey);
    const frameH = tex.source[0].height;
    // Small sprites (≤32 px tall): 2–3 icons
    // Medium sprites (≤64 px):     4–5 icons
    // Large sprites  (>64 px):     6–8 icons
    if (frameH <= 32) return 2 + Math.floor(Math.random() * 2);      // 2 or 3
    if (frameH <= 64) return 4 + Math.floor(Math.random() * 2);      // 4 or 5
    return 6 + Math.floor(Math.random() * 3);                         // 6, 7, or 8
  }

  /** Picks a random idle drone (or uses pendingKey), tweens it in from off-screen left.
   *  Fires onArrived (if provided) once the tween completes.
   *  Pass a GeometryMask to clip the sprite to the top-area viewport so the drone
   *  never bleeds outside the repair panel during its enter/exit tweens.
   */
  spawn(
    container: Phaser.GameObjects.Container,
    onArrived?: () => void,
    mask?: Phaser.Display.Masks.GeometryMask,
  ): void {
    if (!this.topBounds) return;
    const { cx, cy, w, h } = this.topBounds;

    const key = this.pendingKey ?? IDLE_KEYS[Math.floor(Math.random() * IDLE_KEYS.length)];
    this.pendingKey = null;
    this.currentKey = key;
    this.registerAnim(key);

    // Compute scale so the sprite fits fully within the top section
    const tex    = this.scene.textures.get(key);
    const frameH = tex.source[0].height;
    const maxScale = Math.min((w * 0.6) / frameH, (h * 0.85) / frameH);
    const scale    = Math.max(1, Math.round(maxScale));

    const startX = cx - w / 2 - frameH * scale;
    const sprite = this.scene.add.sprite(startX, cy, key).setScale(scale).setDepth(5);
    if (mask) sprite.setMask(mask);
    sprite.play(key);

    container.add(sprite);
    this.droneSprite = sprite;
    this.clearOverlays();

    this.scene.tweens.add({
      targets: sprite, x: cx, duration: 600, ease: 'Cubic.easeOut',
      onComplete: () => onArrived?.(),
    });
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
