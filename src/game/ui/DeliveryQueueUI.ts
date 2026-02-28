import { AssetLoader } from '../managers/AssetLoader';
import { Colors } from '../constants/Colors';
import { DialSettings } from '../managers/SettingsManager';

const SLOT_SIZE   = 44;   // diameter of each circular slot
const SLOT_GAP    = 8;    // vertical gap between slots
const RING_WIDTH  = 4;
const BOUNCE_AMP  = 5;    // pixels
const BOUNCE_DUR  = 550;  // ms per half-cycle

interface DeliverySlot {
  iconKey:  string;
  duration: number;
  container: Phaser.GameObjects.Container;
  bg:        Phaser.GameObjects.Graphics;
  icon:      Phaser.GameObjects.Image | null;
  ring:      Phaser.GameObjects.Graphics;
  tween:     Phaser.Tweens.Tween;
  startTime: number;
}

/**
 * Animated delivery queue UI — circular slots positioned to the left of the
 * dial (right-handed layout) or right (left-handed).  Each slot shows:
 *   • Round icon + dark circular background
 *   • Arc ring sweeping 0 → 2π as delivery progress advances
 *   • Gentle vertical bounce tween
 *
 * Call `addSlot(iconKey, duration)` when a delivery starts and
 * `removeSlot(iconKey)` when it completes (the slot flashes then removes itself).
 */
export class DeliveryQueueUI {
  private scene:      Phaser.Scene;
  private slots:      DeliverySlot[] = [];
  private baseX:      number;   // centre x of the column
  private baseY:      number;   // top centre y (slots grow downward)
  private updateCb:   () => void;

  constructor(
    scene:      Phaser.Scene,
    dialX:      number,
    dialY:      number,
    dialR:      number,
    leftHanded: boolean,
    _ds:        DialSettings,
  ) {
    this.scene = scene;

    // Position the column clear of the dial circumference
    const margin = dialR + SLOT_SIZE * 0.6 + 12;
    this.baseX   = leftHanded ? dialX + margin : dialX - margin;
    this.baseY   = dialY - dialR * 0.5;   // start near the top of the dial

    // Register update callback to redraw rings
    this.updateCb = () => this.updateRings();
    scene.events.on('update', this.updateCb);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  addSlot(iconKey: string, duration: number): void {
    // Avoid duplicate slots for same icon
    if (this.slots.find(s => s.iconKey === iconKey)) return;

    const idx = this.slots.length;
    const cy  = this.baseY + idx * (SLOT_SIZE + SLOT_GAP);

    const container = this.scene.add.container(this.baseX, cy);
    container.setDepth(50);

    // Background circle
    const bg = this.scene.add.graphics();
    this.drawBg(bg);
    container.add(bg);

    // Icon
    let icon: Phaser.GameObjects.Image | null = null;
    if (AssetLoader.textureExists(this.scene, iconKey)) {
      icon = AssetLoader.createImage(this.scene, 0, 0, iconKey);
      icon.setDisplaySize(SLOT_SIZE - 12, SLOT_SIZE - 12);
      container.add(icon);
    }

    // Ring (drawn fresh each update)
    const ring = this.scene.add.graphics();
    container.add(ring);

    // Bounce tween
    const tween = this.scene.tweens.add({
      targets:  container,
      y:        cy - BOUNCE_AMP,
      duration: BOUNCE_DUR,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });

    const slot: DeliverySlot = {
      iconKey, duration, container, bg, icon, ring, tween,
      startTime: this.scene.time.now,
    };
    this.slots.push(slot);
    this.repositionSlots();
  }

  removeSlot(iconKey: string): void {
    const idx = this.slots.findIndex(s => s.iconKey === iconKey);
    if (idx === -1) return;
    const slot = this.slots[idx];

    // Flash the slot before destroying
    slot.tween.stop();
    this.scene.tweens.add({
      targets:  slot.container,
      alpha:    { from: 1, to: 0 },
      duration: 350,
      ease:     'Quad.easeIn',
      onComplete: () => {
        slot.container.destroy();
      },
    });

    this.slots.splice(idx, 1);
    this.repositionSlots();
  }

  destroy(): void {
    this.scene.events.off('update', this.updateCb);
    for (const s of this.slots) {
      s.tween.stop();
      s.container.destroy();
    }
    this.slots = [];
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private updateRings(): void {
    const now = this.scene.time.now;
    for (const slot of this.slots) {
      const elapsed  = now - slot.startTime;
      const progress = Math.min(1, elapsed / slot.duration);
      slot.ring.clear();
      this.drawRing(slot.ring, progress);
    }
  }

  private drawBg(g: Phaser.GameObjects.Graphics): void {
    g.clear();
    // Outer fill — dark panel colour
    g.fillStyle(Colors.PANEL_DARK, 0.92);
    g.fillCircle(0, 0, SLOT_SIZE / 2);
    // Subtle border
    g.lineStyle(1.5, Colors.BORDER_BLUE, 0.7);
    g.strokeCircle(0, 0, SLOT_SIZE / 2);
  }

  private drawRing(g: Phaser.GameObjects.Graphics, progress: number): void {
    if (progress <= 0) return;
    const r       = SLOT_SIZE / 2 + RING_WIDTH * 0.5 + 1;
    const endAngle = -Math.PI / 2 + progress * Math.PI * 2;

    // Track arc (dim)
    g.lineStyle(RING_WIDTH, Colors.BORDER_BLUE, 0.4);
    g.beginPath();
    g.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2, false);
    g.strokePath();

    // Progress arc (bright yellow)
    g.lineStyle(RING_WIDTH, Colors.HIGHLIGHT_YELLOW, 0.95);
    g.beginPath();
    g.arc(0, 0, r, -Math.PI / 2, endAngle, false);
    g.strokePath();

    // Leading dot
    const dotX = Math.cos(endAngle) * r;
    const dotY = Math.sin(endAngle) * r;
    g.fillStyle(Colors.HIGHLIGHT_YELLOW, 1);
    g.fillCircle(dotX, dotY, RING_WIDTH * 0.65);
  }

  private repositionSlots(): void {
    this.slots.forEach((slot, i) => {
      const targetY = this.baseY + i * (SLOT_SIZE + SLOT_GAP);
      slot.tween.stop();
      this.scene.tweens.add({
        targets:  slot.container,
        y:        targetY,
        duration: 200,
        ease:     'Back.easeOut',
        onComplete: () => {
          // Restart bounce from new position
          slot.tween = this.scene.tweens.add({
            targets:  slot.container,
            y:        targetY - BOUNCE_AMP,
            duration: BOUNCE_DUR,
            yoyo:     true,
            repeat:   -1,
            ease:     'Sine.easeInOut',
          });
        },
      });
    });
  }
}
