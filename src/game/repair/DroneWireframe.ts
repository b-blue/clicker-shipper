import Phaser from 'phaser';

const SWIPE_DUR     = 480;  // ms for the reveal swipe-down tween
const EDGE_COLOR: [number, number, number] = [0.28, 0.40, 0.32];

/**
 * Manages the DiagnosticFX wireframe sprite shown in the diagnostic panel
 * during a repair session.
 *
 * Lifecycle (called by the active repair mode):
 *   1. new DroneWireframe(scene, container, bounds, droneKey)
 *      → sprite created, mask applied (fully hidden), NOT animating yet
 *   2. reveal()
 *      → animation starts (synced to live drone), swipe-down mask tween begins
 *   3. fadeOut(duration, delay)
 *      → called during dematerialize to fade it in step with the icon grid
 *   4. destroy()
 *      → sprite + mask cleaned up
 *
 * By keeping this here, each repair mode can call reveal()/fadeOut()/destroy()
 * without re-implementing the DiagnosticFX setup or mask-swipe logic.
 */
export class DroneWireframe {
  /** The underlying Sprite — expose so callers can include it in tween targets. */
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly maskGfx: Phaser.GameObjects.Graphics;
  private readonly droneKey: string;
  private readonly scene: Phaser.Scene;

  // Stored bot-area bounds for the swipe tween.
  private readonly botLeft: number;
  private readonly botTop:  number;
  private readonly botW:    number;
  private readonly botH:    number;

  /**
   * @param scene     Active Phaser scene.
   * @param container Repair-panel container the sprite is added to.
   * @param cx        Centre-X of the diagnostic panel area.
   * @param cy        Centre-Y of the diagnostic panel area.
   * @param w         Width of the diagnostic panel area.
   * @param h         Height of the diagnostic panel area.
   * @param droneKey  Texture key for the drone/robot idle strip (already loaded).
   */
  constructor(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    cx: number,
    cy: number,
    w: number,
    h: number,
    droneKey: string,
  ) {
    this.scene    = scene;
    this.droneKey = droneKey;
    this.botLeft  = cx - w / 2;
    this.botTop   = cy - h / 2;
    this.botW     = w;
    this.botH     = h;

    // Scale to near-fill the diagnostic panel; cap to 92% of each dimension.
    const dispSize = Math.round(Math.min(w * 0.92, h * 0.92));
    const spr = scene.add.sprite(cx, cy, droneKey);
    spr.setDisplaySize(dispSize, dispSize).setDepth(1).setAlpha(0.35);

    // Apply DiagnosticFX post-pipeline (WebGL only — silently no-ops on Canvas).
    if (typeof (spr as any).setPostPipeline === 'function') {
      (spr as any).setPostPipeline('DiagnosticFX');
      // Use a direct get here (not getPipelineInstance) because the pipeline
      // may not be fully booted yet — uniforms/set3f can be absent right after
      // setPostPipeline, and we only need to stamp pendingEdgeColor onto the object.
      const rawPipe = (spr as any).getPostPipeline?.('DiagnosticFX');
      const inst    = Array.isArray(rawPipe) ? rawPipe[0] : rawPipe;
      if (inst) inst.pendingEdgeColor = EDGE_COLOR;
    }

    // Geometry mask starts empty → sprite is fully clipped (invisible).
    // reveal() will animate the mask rect open top-to-bottom.
    // Use scene.make (add: false) so the graphics object is NOT added to the
    // scene's display list — otherwise its fillRect would paint a white rect.
    const maskGfx = scene.make.graphics({}, false);
    spr.setMask(maskGfx.createGeometryMask());
    this.maskGfx = maskGfx;

    container.add(spr);
    this.sprite = spr;
  }

  /**
   * Start the sprite animation and open the mask with a downward swipe.
   * Call this once the live drone has fully entered the repair panel so that
   * both animations begin at frame 0 on the same game tick.
   */
  reveal(): void {
    // Start animation in sync with the live drone.
    if (this.scene.anims.exists(this.droneKey)) {
      this.sprite.play(this.droneKey);
    }

    // Animate the mask open from top to bottom.
    const { maskGfx, botLeft, botTop, botW, botH } = this;
    const proxy = { h: 0 };
    this.scene.tweens.add({
      targets:  proxy,
      h:        botH,
      duration: SWIPE_DUR,
      ease:     'Quad.easeInOut',
      onUpdate: () => {
        maskGfx.clear();
        maskGfx.fillStyle(0xffffff, 1);
        maskGfx.fillRect(botLeft, botTop, botW, proxy.h);
      },
      onComplete: () => {
        maskGfx.clear();
        maskGfx.fillStyle(0xffffff, 1);
        maskGfx.fillRect(botLeft, botTop, botW, botH);
      },
    });
  }

  /**
   * Alpha-fade the wireframe out.  Used by the repair mode during dematerialize
   * so timings stay consistent with the rest of the diagnostic panel.
   */
  fadeOut(duration: number, delay: number = 0): void {
    this.scene.tweens.add({
      targets:  this.sprite,
      alpha:    { to: 0 },
      duration,
      delay,
      ease:     'Sine.easeIn',
    });
  }

  destroy(): void {
    this.sprite.destroy();
    this.maskGfx.destroy();
  }

  /**
   * Resolves a pipeline instance from getPostPipeline(), guarding against
   * pre-boot state where uniforms are not yet populated.
   * Phaser 3.60+ may return an array; this always returns the first element.
   */
  static getPipelineInstance(
    sprite: Phaser.GameObjects.Sprite,
    name: string,
  ): any {
    const raw = (sprite as any).getPostPipeline?.(name);
    if (!raw) return null;
    const instance = Array.isArray(raw) ? raw[0] : raw;
    return (instance && typeof instance.set3f === 'function' && instance.uniforms)
      ? instance : null;
  }
}
