import Phaser from 'phaser';

/**
 * Renders a 5-layer parallax background using TileSprite objects.
 *
 * Layer ordering (depth):
 *   Layer 1 → sky / static background (slowest)
 *   Layer 2 → distant skyline
 *   Layer 3 → mid skyline
 *   Layer 4 → near skyline
 *   Layer 5 → foreground (fastest)
 *
 * Key convention used in Preloader: `bg-{set}-{tod}-{layer}`
 * e.g. `bg-3-night-2`
 */
export class ParallaxBackground {
  readonly tiles: Phaser.GameObjects.TileSprite[] = [];
  /** Scroll speed in px per ms for each of the 5 layers (index 0 = layer 1). */
  private static readonly SPEEDS = [0.0, 0.04, 0.10, 0.20, 0.38];

  readonly label: string;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number,
    setNum: number,
    tod: 'day' | 'night',
  ) {
    const setLabel = `SET ${setNum} — ${tod === 'day' ? 'DAY' : 'NIGHT'}`;
    this.label = setLabel;

    for (let layer = 1; layer <= 5; layer++) {
      const key = `bg-${setNum}-${tod}-${layer}`;
      if (!scene.textures.exists(key)) continue;

      const tex = scene.textures.get(key);
      const src = tex.source[0];
      const texW = src.width;
      const texH = src.height;

      // Scale the tile so it fills the display height exactly, preserving aspect ratio.
      const tileScale = texH > 0 ? h / texH : 1;
      const scaledW   = Math.round(texW * tileScale);

      // TileSprite dimensions must be at least as wide as the display area so the
      // tile always covers the full width even as tilePositionX advances.
      const tileW = Math.max(w, scaledW);

      const tile = scene.add.tileSprite(x, y, tileW, h, key);
      tile.setOrigin(0, 0);
      tile.setTileScale(tileScale, tileScale);
      tile.setDepth(layer);
      this.tiles.push(tile);
    }
  }

  /** Advance the scroll. Call once per update tick with the Phaser delta (ms). */
  update(delta: number): void {
    for (let i = 0; i < this.tiles.length; i++) {
      this.tiles[i].tilePositionX += ParallaxBackground.SPEEDS[i] * delta;
    }
  }

  /** Remove all TileSprites from the scene. */
  destroy(): void {
    for (const tile of this.tiles) tile.destroy();
    this.tiles.length = 0;
  }
}
