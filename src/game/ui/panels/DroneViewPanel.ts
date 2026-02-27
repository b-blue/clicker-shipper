import Phaser from 'phaser';
import { Colors } from '../../constants/Colors';
import { ParallaxBackground } from '../ParallaxBackground';

/**
 * Builds the DRONES tab content: a parallax background preview carousel.
 *
 * Displays all 16 variants (8 sets × Day + Night) of the scrolling parallax
 * background layers. The user cycles through them with the < > arrow buttons.
 * The active variant auto-scrolls via the scene update event.
 */
export class DroneViewPanel {
  private scene: Phaser.Scene;

  /** All 16 background variants in carousel order (set 1 day → set 8 night). */
  private static readonly BG_ENTRIES: Array<{ set: number; tod: 'day' | 'night' }> = [
    ...Array.from({ length: 8 }, (_, i) => ({ set: i + 1, tod: 'day'  as const })),
    ...Array.from({ length: 8 }, (_, i) => ({ set: i + 1, tod: 'night' as const })),
  ];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  build(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const BG_ENTRIES  = DroneViewPanel.BG_ENTRIES;
    const left        = x - width / 2;
    const top         = y;
    const bottom      = y + height;
    const arrowAreaH  = 40;
    const displayW    = width;
    const displayH    = height - arrowAreaH;
    const arrowY      = bottom - arrowAreaH / 2;

    // Parallax display area is top-left anchored at (left, top).
    let currentBg: ParallaxBackground | null = null;
    let currentIndex = 0;
    let isTransitioning = false;

    // Geometry mask: clips TileSprites to the display rect.
    const maskGfx = this.scene.add.graphics();
    maskGfx.fillStyle(0xffffff, 1);
    maskGfx.fillRect(left, top, displayW, displayH);
    maskGfx.setVisible(false);
    const viewportMask = maskGfx.createGeometryMask();

    // Dark fallback fill so the area isn't blank on first frame.
    const bgFill = this.scene.add.graphics();
    bgFill.fillStyle(Colors.PANEL_DARK, 1);
    bgFill.fillRect(left, top, displayW, displayH);
    container.add(bgFill);

    const nameLabel = this.scene.add
      .bitmapText(x, top + 14, 'clicker', '', 12)
      .setOrigin(0.5)
      .setTint(Colors.HIGHLIGHT_YELLOW);
    container.add(nameLabel);

    const spawnBg = (index: number): ParallaxBackground => {
      const entry = BG_ENTRIES[index];
      const bg = new ParallaxBackground(
        this.scene, left, top, displayW, displayH, entry.set, entry.tod,
      );
      // Apply the viewport mask and add each tile to the container.
      for (const tile of bg.tiles) {
        tile.setMask(viewportMask);
        container.add(tile);
      }
      nameLabel.setText(bg.label);
      return bg;
    };

    // Show the first variant.
    currentBg = spawnBg(0);

    // Advance scroll on every scene update tick.
    const onUpdate = (_time: number, delta: number): void => {
      currentBg?.update(delta);
    };
    this.scene.events.on('update', onUpdate);
    // Clean up listener when the scene shuts down.
    this.scene.events.once('shutdown', () => this.scene.events.off('update', onUpdate));

    const navigate = (dir: 1 | -1): void => {
      if (isTransitioning || BG_ENTRIES.length <= 1) return;
      isTransitioning = true;
      currentBg?.destroy();
      currentIndex = (currentIndex + dir + BG_ENTRIES.length) % BG_ENTRIES.length;
      currentBg = spawnBg(currentIndex);
      isTransitioning = false;
    };

    // ── Arrow buttons ───────────────────────────────────────────────────
    const multiEntry = BG_ENTRIES.length > 1;
    const makeArrow = (label: string, ax: number, dir: 1 | -1): void => {
      const bg = this.scene.add
        .rectangle(ax, arrowY, 44, 28, Colors.PANEL_MEDIUM, multiEntry ? 0.85 : 0.3)
        .setStrokeStyle(1, Colors.BORDER_BLUE, multiEntry ? 0.8 : 0.25);
      const lbl = this.scene.add
        .bitmapText(ax, arrowY, 'clicker', label, 14)
        .setOrigin(0.5)
        .setTint(multiEntry ? Colors.HIGHLIGHT_YELLOW : Colors.BORDER_BLUE);
      if (multiEntry) {
        bg.setInteractive();
        bg.on('pointerdown', () => navigate(dir));
        bg.on('pointerover', () => bg.setFillStyle(Colors.BUTTON_HOVER, 0.95));
        bg.on('pointerout',  () => bg.setFillStyle(Colors.PANEL_MEDIUM, 0.85));
      }
      container.add([bg, lbl]);
    };
    makeArrow('<', x - 52, -1);
    makeArrow('>', x + 52,  1);
  }
}
