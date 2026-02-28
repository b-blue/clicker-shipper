import Phaser from 'phaser';
import { MenuItem } from '../../../types/GameTypes';
import { Colors, toColorString } from '../../../constants/Colors';
import { AssetLoader } from '../../../managers/AssetLoader';
import { IDialFace } from '../IDialFace';
import { DialContext } from '../DialContext';
import { readoutStyle } from '../../../constants/FontStyle';

/**
 * Terminal face: quantity-selector arc.
 *
 * Displays a draggable trigger on a semicircular arc track. The user sweeps the
 * trigger CCW to select qty 1 / 2 / 3 or CW to remove (qty 0).
 */
export class QuantityTerminalFace implements IDialFace {
  // ── Public fields — read by RadialDial backward-compat getters ─────────────
  /** The item whose quantity is being chosen. Exposed as `item` (tests may read as `terminalItem`). */
  item: MenuItem;
  isTriggerActive: boolean = false;
  currentQuantity: number  = 1;
  arcProgress: number      = 0;    // [-0.6, 1.0]; 0 = start angle, 1 = qty-3 max
  terminalStartAngle: number;       // radians; where the trigger starts

  // ── Private arc state ──────────────────────────────────────────────────────
  private arcRadius: number = 0;   // midpoint between centerRadius and sliceRadius
  private readonly triggerHitRadius: number = 18;

  // ── Per-frame Phaser objects ──────────────────────────────────────────────
  private arcFillGraphics: Phaser.GameObjects.Graphics | null = null;
  private quantityNumeral: Phaser.GameObjects.Text | null = null;

  // ── Pointer guard ──────────────────────────────────────────────────────────
  private pointerConsumed: boolean = false;
  private activePointerId: number  = -1;

  private ctx: DialContext | null = null;

  constructor(item: MenuItem, existingQty: number = 0, startAngle: number = Math.PI / 2) {
    this.item = item;
    this.terminalStartAngle = startAngle;
    // Pre-position the trigger at the correct arc angle for the existing quantity:
    //   qty≤1 → 0, qty2 → 0.4, qty3 → 0.8
    this.arcProgress    = existingQty > 1 ? (existingQty - 1) / 2.5 : 0;
    this.currentQuantity = Math.max(0, Math.min(3, Math.round(this.arcProgress * 2.5 + 1)));
  }

  // ── IDialFace lifecycle ────────────────────────────────────────────────────

  activate(context: DialContext): void {
    this.ctx = context;
    this.arcRadius = (context.centerRadius + context.sliceRadius) / 2;
    this.isTriggerActive = false;
    this.pointerConsumed = false;
    this.activePointerId = -1;
    this.redraw();
  }

  deactivate(): void { /* non-destructive */ }

  destroy(): void {
    this._clearGraphics();
    this.ctx = null;
  }

  redraw(): void {
    if (!this.ctx) return;
    this._drawFrame();
    this._drawCenterIndicator();
    this._drawQuantityFace();
    this.ctx.centerGraphic.setDepth(10);
    this.ctx.centerImage.setDepth(10);
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.ctx || !this.isTriggerActive) return;

    const { dialX, dialY } = this.ctx;
    const dx = pointer.x - dialX;
    const dy = pointer.y - dialY;
    const pointerAngle = Math.atan2(dy, dx);

    let angularTravel = this.terminalStartAngle - pointerAngle;
    while (angularTravel > Math.PI)  angularTravel -= 2 * Math.PI;
    while (angularTravel < -Math.PI) angularTravel += 2 * Math.PI;
    angularTravel = Math.max(-Math.PI / 2, Math.min(5 * Math.PI / 6, angularTravel));
    this.arcProgress     = angularTravel / (5 * Math.PI / 6);
    this.currentQuantity = Math.max(0, Math.min(3, Math.round(this.arcProgress * 2.5 + 1)));
    this.redraw();
  }

  onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.ctx) return;
    if (this.activePointerId !== -1 && pointer.pointerId !== this.activePointerId) return;

    const triggerAngle  = this.terminalStartAngle - this.arcProgress * (5 * Math.PI / 6);
    const triggerX      = this.ctx.dialX + Math.cos(triggerAngle) * this.arcRadius;
    const triggerY      = this.ctx.dialY + Math.sin(triggerAngle) * this.arcRadius;
    const tdx           = pointer.x - triggerX;
    const tdy           = pointer.y - triggerY;
    const triggerDist   = Math.sqrt(tdx * tdx + tdy * tdy);

    if (triggerDist <= this.triggerHitRadius) {
      this.activePointerId = pointer.pointerId;
      this.pointerConsumed = false;
      this.isTriggerActive = true;
      this.redraw();
    }
  }

  onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.ctx) return;
    if (this.activePointerId !== -1 && pointer.pointerId !== this.activePointerId) return;
    if (this.pointerConsumed) return;
    this.pointerConsumed = true;
    this.activePointerId = -1;

    const { dialX, dialY, centerRadius } = this.ctx;
    const endDx      = pointer.x - dialX;
    const endDy      = pointer.y - dialY;
    const endDistance = Math.sqrt(endDx * endDx + endDy * endDy);

    if (this.isTriggerActive) {
      const targetItem = this.item;
      const qty        = this.currentQuantity;
      // Reset local state before emitting so the face is clean if re-activated
      this.isTriggerActive  = false;
      this.arcProgress      = 0;
      this.currentQuantity  = 1;
      this._clearGraphics();
      this.ctx.emit({ type: 'quantityConfirmed', item: targetItem, quantity: qty });
      return;
    }

    if (endDistance < centerRadius) {
      this.isTriggerActive  = false;
      this.arcProgress      = 0;
      this.currentQuantity  = 1;
      this._clearGraphics();
      this.ctx.emit({ type: 'goBack' });
    }
  }

  // ── Rendering helpers ──────────────────────────────────────────────────────

  private _clearGraphics(): void {
    if (this.arcFillGraphics)  { this.arcFillGraphics.destroy();  this.arcFillGraphics  = null; }
    if (this.quantityNumeral)  { this.quantityNumeral.destroy();  this.quantityNumeral  = null; }
  }

  private _drawFrame(): void {
    const { dialX, dialY, sliceRadius, dialFrameGraphic } = this.ctx!;
    dialFrameGraphic.clear();
    const frameRadius = sliceRadius + 10;
    dialFrameGraphic.fillStyle(Colors.PANEL_DARK, 0.65);
    dialFrameGraphic.fillCircle(dialX, dialY, frameRadius);
    dialFrameGraphic.lineStyle(2, Colors.BORDER_BLUE, 1.0);
    dialFrameGraphic.strokeCircle(dialX, dialY, frameRadius);
    dialFrameGraphic.lineStyle(1, Colors.BORDER_BLUE, 0.7);
    dialFrameGraphic.strokeCircle(dialX, dialY, sliceRadius * 0.6);
    // No dividers in terminal mode
  }

  private _drawCenterIndicator(): void {
    const { dialX, dialY, centerRadius, centerGraphic, centerImage, scene } = this.ctx!;
    centerGraphic.clear();
    centerGraphic.fillStyle(Colors.PANEL_DARK, 0.35);
    centerGraphic.fillCircle(dialX, dialY, centerRadius - 2);
    centerGraphic.lineStyle(3, Colors.LIGHT_BLUE, 0.7);
    centerGraphic.strokeCircle(dialX, dialY, centerRadius);

    const iconKey = this.item.icon || this.item.id;
    if (AssetLoader.textureExists(scene, iconKey)) {
      const atlasKey = AssetLoader.getAtlasKey(iconKey);
      if (atlasKey) {
        centerImage.setTexture(atlasKey, iconKey);
      } else {
        centerImage.setTexture(iconKey);
      }
      centerImage.setPosition(dialX, dialY - 8);
      centerImage.setVisible(true);
    } else {
      centerImage.setVisible(false);
    }

    // Quantity numeral inside center
    const isRemoval    = this.arcProgress < -0.2;
    const numeralColor = isRemoval
      ? 0xff2244
      : this.arcProgress < 0.2  ? 0x00cccc
      : this.arcProgress < 0.6  ? 0xffd700
      : 0xff8800;

    if (this.quantityNumeral) {
      this.quantityNumeral.setText(String(this.currentQuantity));
      this.quantityNumeral.setColor(toColorString(numeralColor));
    } else {
      this.quantityNumeral = scene.add.text(
        dialX, dialY + 12, String(this.currentQuantity), readoutStyle(20, numeralColor),
      ).setOrigin(0.5).setDepth(11);
    }
  }

  private _drawQuantityFace(): void {
    if (this.arcFillGraphics) { this.arcFillGraphics.destroy(); this.arcFillGraphics = null; }
    const { scene, dialX, dialY } = this.ctx!;

    const g = scene.add.graphics();
    g.setDepth(1);
    this.arcFillGraphics = g;

    const { arcRadius, arcProgress, terminalStartAngle } = this;
    const arcSweep = 5 * Math.PI / 6; // CCW portion = 2.5 × (π/3)

    const triggerAngle = terminalStartAngle - arcProgress * arcSweep;
    const triggerX     = dialX + Math.cos(triggerAngle) * arcRadius;
    const triggerY     = dialY + Math.sin(triggerAngle) * arcRadius;

    // Dim CCW track
    g.lineStyle(8, 0x223344, 1.0);
    g.beginPath();
    g.arc(dialX, dialY, arcRadius, terminalStartAngle, terminalStartAngle - arcSweep, true);
    g.strokePath();

    // Dim CW removal track
    g.lineStyle(8, 0x331111, 1.0);
    g.beginPath();
    g.arc(dialX, dialY, arcRadius, terminalStartAngle, terminalStartAngle + Math.PI / 2, false);
    g.strokePath();

    // Filled arc
    if (arcProgress > 0) {
      const arcColor = arcProgress < 0.2 ? 0x00cccc : (arcProgress < 0.6 ? 0xffd700 : 0xff8800);
      g.lineStyle(8, arcColor, 1.0);
      g.beginPath();
      g.arc(dialX, dialY, arcRadius, terminalStartAngle, terminalStartAngle - arcProgress * arcSweep, true);
      g.strokePath();
    } else if (arcProgress < 0) {
      const fillColor = arcProgress >= -0.2 ? 0x00cccc : 0xff2244;
      g.lineStyle(8, fillColor, 1.0);
      g.beginPath();
      g.arc(dialX, dialY, arcRadius, terminalStartAngle, terminalStartAngle - arcProgress * arcSweep, false);
      g.strokePath();
    }

    // Tick marks at slice-divider angles inside the sweep
    const dividers = Array.from({ length: 6 }, (_, k) => -Math.PI / 2 + k * Math.PI / 3);
    dividers.forEach(d => {
      let t = terminalStartAngle - d;
      while (t < 0)            t += 2 * Math.PI;
      while (t >= 2 * Math.PI) t -= 2 * Math.PI;
      const inCCW = t > 0 && t < arcSweep;
      const inCW  = t > (2 * Math.PI - Math.PI / 2);
      if (!inCCW && !inCW) return;
      const inner = arcRadius - 8;
      const outer = arcRadius + 8;
      g.lineStyle(2, 0xffffff, 0.5);
      g.beginPath();
      g.moveTo(dialX + Math.cos(d) * inner, dialY + Math.sin(d) * inner);
      g.lineTo(dialX + Math.cos(d) * outer, dialY + Math.sin(d) * outer);
      g.strokePath();
    });

    // Trigger button
    g.fillStyle(this.isTriggerActive ? 0xffffff : 0xaaaacc, this.isTriggerActive ? 1.0 : 0.8);
    g.fillCircle(triggerX, triggerY, this.triggerHitRadius);
    if (this.isTriggerActive) {
      g.lineStyle(2, 0xffffff, 0.9);
      g.strokeCircle(triggerX, triggerY, this.triggerHitRadius + 4);
    }
  }
}
