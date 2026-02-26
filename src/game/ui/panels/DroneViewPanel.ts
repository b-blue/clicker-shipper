import Phaser from 'phaser';
import { Colors } from '../../constants/Colors';

/**
 * Builds the DRONES tab content: animated sprite carousel + scale slider.
 *
 * To add a new drone animation:
 *  1. Load it as a spritesheet in Preloader.preload() (frameWidth / frameHeight).
 *  2. Push a new entry into DRONE_ANIMS below.
 */
export class DroneViewPanel {
  private scene: Phaser.Scene;

  /** All known drone animation entries, in carousel order. */
  private static readonly DRONE_ANIMS: Array<{ key: string; label: string; frameRate: number }> = [
    { key: 'drone-1-death',    label: '1 · Death',     frameRate: 8  },
    { key: 'drone-1-idle',     label: '1 · Idle',      frameRate: 8  },
    { key: 'drone-1-scan',     label: '1 · Scan',      frameRate: 10 },
    { key: 'drone-1-walk',     label: '1 · Walk',      frameRate: 10 },
    { key: 'drone-1-walkscan', label: '1 · Walk+Scan', frameRate: 10 },
    { key: 'drone-2-bomb',     label: '2 · Bomb',      frameRate: 8  },
    { key: 'drone-2-drop',     label: '2 · Drop',      frameRate: 8  },
    { key: 'drone-3-back',     label: '3 · Back',      frameRate: 10 },
    { key: 'drone-3-death',    label: '3 · Death',     frameRate: 8  },
    { key: 'drone-3-fire1',    label: '3 · Fire 1',    frameRate: 12 },
    { key: 'drone-3-fire2',    label: '3 · Fire 2',    frameRate: 12 },
    { key: 'drone-3-fire3',    label: '3 · Fire 3',    frameRate: 12 },
    { key: 'drone-3-forward',  label: '3 · Forward',   frameRate: 10 },
    { key: 'drone-3-idle',     label: '3 · Idle',      frameRate: 8  },
    { key: 'drone-4-death',    label: '4 · Death',     frameRate: 8  },
    { key: 'drone-4-idle',     label: '4 · Idle',      frameRate: 8  },
    { key: 'drone-4-landing',  label: '4 · Landing',   frameRate: 8  },
    { key: 'drone-4-walk',     label: '4 · Walk',      frameRate: 10 },
    { key: 'drone-5-death',    label: '5 · Death',     frameRate: 8  },
    { key: 'drone-5-idle',     label: '5 · Idle',      frameRate: 8  },
    { key: 'drone-5-walk',     label: '5 · Walk',      frameRate: 10 },
    { key: 'drone-5b-death',   label: '5b · Death',    frameRate: 8  },
    { key: 'drone-5b-idle',    label: '5b · Idle',     frameRate: 8  },
    { key: 'drone-5b-walk',    label: '5b · Walk',     frameRate: 10 },
    { key: 'drone-6-capsule',  label: '6 · Capsule',   frameRate: 8  },
    { key: 'drone-6-drop',     label: '6 · Drop',      frameRate: 8  },
    { key: 'drone-6-walk',     label: '6 · Walk',      frameRate: 10 },
    { key: 'drone-6-walk2',    label: '6 · Walk 2',    frameRate: 10 },
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
    const DRONE_ANIMS = DroneViewPanel.DRONE_ANIMS;

    // ── Register Phaser animations (idempotent) ──────────────────────────
    for (const entry of DRONE_ANIMS) {
      if (!this.scene.anims.exists(entry.key)) {
        const tex       = this.scene.textures.get(entry.key);
        const src       = tex.source[0];
        const frameH    = src.height;
        const frameCount = Math.max(1, Math.floor(src.width / frameH));
        for (let i = 0; i < frameCount; i++) {
          if (!tex.has(String(i))) tex.add(String(i), 0, i * frameH, 0, frameH, frameH);
        }
        const frames = Array.from({ length: frameCount }, (_, i) => ({ key: entry.key, frame: String(i) }));
        this.scene.anims.create({ key: entry.key, frames, frameRate: entry.frameRate, repeat: -1 });
      }
    }

    // ── Layout ─────────────────────────────────────────────────────────────
    const left   = x - width / 2;
    const right  = x + width / 2;
    const top    = y;
    const bottom = y + height;

    const sliderStripW = 32;
    const trackX       = right - sliderStripW / 2;
    const trackTopY    = top    + 24;
    const trackBotY    = bottom - 28;
    const trackH       = trackBotY - trackTopY;
    const thumbW       = 18;
    const thumbH       = 26;
    const minScale     = 0.5;
    const maxScale     = 6;
    let thumbT          = 0.4;
    let currentScale    = maxScale - thumbT * (maxScale - minScale);

    const arrowAreaH  = 40;
    const displayW    = width - sliderStripW - 16;
    const displayCX   = left + displayW / 2;
    const displayCY   = top + (height - arrowAreaH) / 2;
    const arrowY      = bottom - arrowAreaH / 2;

    // Geometry mask for viewport clipping
    const maskGfx = this.scene.add.graphics();
    maskGfx.fillStyle(0xffffff, 1);
    maskGfx.fillRect(left, top, displayW, height - arrowAreaH);
    maskGfx.setVisible(false);
    const viewportMask = maskGfx.createGeometryMask();

    // ── Slider ─────────────────────────────────────────────────────────────
    const sliderG = this.scene.add.graphics();

    const drawSlider = (t: number, dragging = false): void => {
      sliderG.clear();
      sliderG.lineStyle(2, Colors.BORDER_BLUE, 0.55);
      sliderG.lineBetween(trackX, trackTopY, trackX, trackBotY);
      for (let i = 0; i <= 4; i++) {
        const ty = trackTopY + (trackH * i) / 4;
        sliderG.lineStyle(1, Colors.BORDER_BLUE, 0.3);
        sliderG.lineBetween(trackX - 5, ty, trackX + 5, ty);
      }
      const ty = trackTopY + t * trackH;
      sliderG.fillStyle(dragging ? Colors.BUTTON_HOVER : Colors.PANEL_MEDIUM, 1);
      sliderG.fillRoundedRect(trackX - thumbW / 2, ty - thumbH / 2, thumbW, thumbH, 4);
      sliderG.lineStyle(1, dragging ? Colors.HIGHLIGHT_YELLOW : Colors.BORDER_LIGHT_BLUE, 0.9);
      sliderG.strokeRoundedRect(trackX - thumbW / 2, ty - thumbH / 2, thumbW, thumbH, 4);
    };
    drawSlider(thumbT);
    container.add(sliderG);

    const scaleLbl = this.scene.add.bitmapText(trackX, trackBotY + 14, 'clicker', `x${currentScale.toFixed(1)}`, 10)
      .setOrigin(0.5).setTint(Colors.TEXT_MUTED_BLUE);
    container.add(scaleLbl);

    let isDraggingSlider = false;
    let currentSprite: Phaser.GameObjects.Sprite | null = null;

    const applyScale = (): void => { currentSprite?.setScale(currentScale); };

    const sliderZone = this.scene.add
      .zone(trackX, (trackTopY + trackBotY) / 2, sliderStripW + 8, trackH + thumbH)
      .setInteractive();

    sliderZone.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      isDraggingSlider = true;
      thumbT        = Phaser.Math.Clamp((ptr.y - trackTopY) / trackH, 0, 1);
      currentScale  = maxScale - thumbT * (maxScale - minScale);
      applyScale();
      drawSlider(thumbT, true);
      scaleLbl.setText(`x${currentScale.toFixed(1)}`);
    });
    this.scene.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!isDraggingSlider) return;
      thumbT        = Phaser.Math.Clamp((ptr.y - trackTopY) / trackH, 0, 1);
      currentScale  = maxScale - thumbT * (maxScale - minScale);
      applyScale();
      drawSlider(thumbT, true);
      scaleLbl.setText(`x${currentScale.toFixed(1)}`);
    });
    this.scene.input.on('pointerup', () => {
      if (!isDraggingSlider) return;
      isDraggingSlider = false;
      drawSlider(thumbT);
    });
    container.add(sliderZone);

    // ── Carousel ───────────────────────────────────────────────────────────
    let currentIndex    = 0;
    let isTransitioning = false;

    const spawnSprite = (index: number, startX: number = displayCX): Phaser.GameObjects.Sprite => {
      const spr = this.scene.add
        .sprite(startX, displayCY, DRONE_ANIMS[index].key)
        .setScale(currentScale)
        .setMask(viewportMask);
      spr.play(DRONE_ANIMS[index].key);
      container.add(spr);
      return spr;
    };
    currentSprite = spawnSprite(0);

    const nameLabel = this.scene.add.bitmapText(displayCX, top + 14, 'clicker', DRONE_ANIMS[0].label, 12)
      .setOrigin(0.5).setTint(Colors.HIGHLIGHT_YELLOW);
    container.add(nameLabel);

    const navigate = (dir: 1 | -1): void => {
      if (isTransitioning || DRONE_ANIMS.length <= 1) return;
      isTransitioning = true;
      const nextIndex = (currentIndex + dir + DRONE_ANIMS.length) % DRONE_ANIMS.length;
      const outX      = displayCX - dir * (displayW + 40);
      const startX    = displayCX + dir * (displayW + 40);
      const oldSprite = currentSprite!;
      const newSprite = spawnSprite(nextIndex, startX);
      currentSprite   = newSprite;
      currentIndex    = nextIndex;
      nameLabel.setText(DRONE_ANIMS[nextIndex].label);
      this.scene.tweens.add({
        targets: oldSprite,
        x: outX,
        duration: 220,
        ease: 'Cubic.easeIn',
        onComplete: () => oldSprite.destroy(),
      });
      this.scene.tweens.add({
        targets: newSprite,
        x: displayCX,
        duration: 220,
        ease: 'Cubic.easeOut',
        onComplete: () => { isTransitioning = false; },
      });
    };

    // ── Arrow buttons ──────────────────────────────────────────────────────
    const multiEntry = DRONE_ANIMS.length > 1;
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
    makeArrow('<', displayCX - 52, -1);
    makeArrow('>', displayCX + 52, 1);
  }
}
