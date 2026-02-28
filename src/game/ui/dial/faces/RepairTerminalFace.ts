import Phaser from 'phaser';
import { MenuItem } from '../../../types/GameTypes';
import { Colors } from '../../../constants/Colors';
import { AssetLoader } from '../../../managers/AssetLoader';
import { IDialFace } from '../IDialFace';
import { DialContext } from '../DialContext';

/**
 * Terminal face: repair rotation ring.
 *
 * Displays a full 360° ring with a target tick at 12 o'clock and a draggable
 * indicator dot at the item's current rotation. The user rotates the ring to
 * align the item upright (0°). Emits `repairSettled` on finger lift and
 * `goBack` when the center is tapped.
 */
export class RepairTerminalFace implements IDialFace {
  // ── Public state (read by RadialDial backward-compat getters) ─────────────
  item: MenuItem;
  isTriggerActive: boolean = false;

  // ── Private repair state ───────────────────────────────────────────────────
  private repairItemRotationDeg: number;
  private arcRadius: number = 0;

  // ── Drag tracking ──────────────────────────────────────────────────────────
  private repairRingDragStartAngle: number         = 0;
  private repairRingDragStartRotationDeg: number   = 0;
  private repairPointerAngle: number               = 0;
  private repairPointerAngleTime: number           = 0;
  private repairPointerAngVel: number              = 0;

  // ── Wobble animation ───────────────────────────────────────────────────────
  private repairWobblePhase: number                = 0;
  private repairWobbleTimer: Phaser.Time.TimerEvent | null = null;

  // ── Per-frame Phaser objects ──────────────────────────────────────────────
  private repairFillGraphics: Phaser.GameObjects.Graphics | null = null;

  // ── Pointer guard ──────────────────────────────────────────────────────────
  private pointerConsumed: boolean = false;
  private activePointerId: number  = -1;
  private readonly triggerHitRadius: number = 18;

  private ctx: DialContext | null = null;

  constructor(item: MenuItem, currentRotationDeg: number, _targetRotationDeg: number) {
    this.item                  = item;
    this.repairItemRotationDeg = currentRotationDeg;
  }

  // ── IDialFace lifecycle ────────────────────────────────────────────────────

  activate(context: DialContext): void {
    this.ctx        = context;
    this.arcRadius  = (context.centerRadius + context.sliceRadius) / 2;
    this.isTriggerActive  = false;
    this.repairWobblePhase = 0;
    this.repairPointerAngVel = 0;
    this.pointerConsumed = false;
    this.activePointerId = -1;
    this.redraw();
  }

  deactivate(): void { /* non-destructive */ }

  destroy(): void {
    this._clearGraphics();
    if (this.repairWobbleTimer) { this.repairWobbleTimer.remove(); this.repairWobbleTimer = null; }
    this.ctx = null;
  }

  redraw(): void {
    if (!this.ctx) return;
    this._drawFrame();
    this._drawCenterIndicator();
    this._drawRepairFace();
    this.ctx.centerGraphic.setDepth(10);
    this.ctx.centerImage.setDepth(10);
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.ctx || !this.isTriggerActive) return;

    const { dialX, dialY } = this.ctx;
    const dx = pointer.x - dialX;
    const dy = pointer.y - dialY;
    const newAngle = Math.atan2(dy, dx);

    const now = Date.now();
    const dt  = Math.max(1, now - this.repairPointerAngleTime);
    let dAngle = newAngle - this.repairPointerAngle;
    while (dAngle > Math.PI)  dAngle -= 2 * Math.PI;
    while (dAngle < -Math.PI) dAngle += 2 * Math.PI;
    const rawVel = Math.abs(dAngle) / dt;
    this.repairPointerAngVel  = 0.5 * this.repairPointerAngVel + 0.5 * rawVel;
    this.repairPointerAngle      = newAngle;
    this.repairPointerAngleTime  = now;

    let delta = newAngle - this.repairRingDragStartAngle;
    while (delta > Math.PI)  delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    this.repairItemRotationDeg = this.repairRingDragStartRotationDeg + delta * (180 / Math.PI);
    this.ctx.emit({ type: 'repairRotated', rotation: this.repairItemRotationDeg });
    this.redraw();
  }

  onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.ctx) return;
    if (this.activePointerId !== -1 && pointer.pointerId !== this.activePointerId) return;

    const { dialX, dialY, centerRadius, sliceRadius } = this.ctx;
    const dx = pointer.x - dialX;
    const dy = pointer.y - dialY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const innerRing = centerRadius + 8;
    const outerRing = sliceRadius - 8;

    if (distance >= innerRing && distance <= outerRing) {
      this.activePointerId              = pointer.pointerId;
      this.pointerConsumed              = false;
      this.isTriggerActive              = true;
      this.repairRingDragStartAngle     = Math.atan2(dy, dx);
      this.repairRingDragStartRotationDeg = this.repairItemRotationDeg;
      this.repairWobblePhase            = 0;
      this.repairPointerAngle           = Math.atan2(dy, dx);
      this.repairPointerAngleTime       = Date.now();
      this.repairPointerAngVel          = 0;

      this.repairWobbleTimer = this.ctx.scene.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          this.repairPointerAngVel *= 0.90;
          const phaseStep = 0.03 + 0.22 * Math.tanh(this.repairPointerAngVel * 80);
          this.repairWobblePhase += phaseStep;
          this.redraw();
        },
      });
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
      this.isTriggerActive = false;
      if (this.repairWobbleTimer) { this.repairWobbleTimer.remove(); this.repairWobbleTimer = null; }
      this.repairWobblePhase = 0;

      let normalized = this.repairItemRotationDeg % 360;
      if (normalized > 180)  normalized -= 360;
      if (normalized <= -180) normalized += 360;
      this.repairItemRotationDeg = normalized;

      const success = Math.abs(normalized) <= 10;
      this.redraw();
      this.ctx.emit({ type: 'repairSettled', success });
      return;
    }

    if (endDistance < centerRadius) {
      if (this.repairWobbleTimer) { this.repairWobbleTimer.remove(); this.repairWobbleTimer = null; }
      this.repairWobblePhase = 0;
      this.isTriggerActive   = false;
      this._clearGraphics();
      this.ctx.centerImage.setAngle(0);
      this.ctx.emit({ type: 'goBack' });
    }
  }

  // ── Rendering helpers ──────────────────────────────────────────────────────

  private _clearGraphics(): void {
    if (this.repairFillGraphics) { this.repairFillGraphics.destroy(); this.repairFillGraphics = null; }
  }

  private getStatusColor(): number {
    let normDeg = this.repairItemRotationDeg % 360;
    if (normDeg > 180)  normDeg -= 360;
    if (normDeg <= -180) normDeg += 360;
    const absDeg = Math.abs(normDeg);
    return absDeg <= 10 ? 0x44ff88 : (absDeg <= 30 ? 0xffd700 : 0xaaaacc);
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
    // No dividers in repair mode
  }

  private _drawCenterIndicator(): void {
    const { dialX, dialY, centerRadius, centerGraphic, centerImage, scene } = this.ctx!;
    centerGraphic.clear();
    centerGraphic.fillStyle(Colors.PANEL_DARK, 0.35);
    centerGraphic.fillCircle(dialX, dialY, centerRadius - 2);
    centerGraphic.lineStyle(3, this.getStatusColor(), 0.9);
    centerGraphic.strokeCircle(dialX, dialY, centerRadius);

    const iconKey = this.item.icon || this.item.id;
    if (AssetLoader.textureExists(scene, iconKey)) {
      const atlasKey = AssetLoader.getAtlasKey(iconKey);
      if (atlasKey) {
        centerImage.setTexture(atlasKey, iconKey);
      } else {
        centerImage.setTexture(iconKey);
      }
      centerImage.setPosition(dialX, dialY);
      centerImage.setAngle(this.repairItemRotationDeg);
      centerImage.setVisible(true);
    } else {
      centerImage.setVisible(false);
    }
  }

  private _drawRepairFace(): void {
    this._clearGraphics();
    const { scene, dialX, dialY } = this.ctx!;

    const g = scene.add.graphics();
    g.setDepth(1);
    this.repairFillGraphics = g;

    const statusColor = this.getStatusColor();

    if (this.isTriggerActive) {
      const AMPL = 6;
      const FREQ = 5;
      const N    = 64;
      g.lineStyle(8, statusColor, 0.9);
      g.beginPath();
      for (let j = 0; j <= N; j++) {
        const theta = (j / N) * Math.PI * 2;
        const r  = this.arcRadius + AMPL * Math.sin(FREQ * theta + this.repairWobblePhase);
        const px = dialX + Math.cos(theta) * r;
        const py = dialY + Math.sin(theta) * r;
        if (j === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.strokePath();
    } else {
      g.lineStyle(8, statusColor, 0.35);
      g.beginPath();
      g.arc(dialX, dialY, this.arcRadius, 0, Math.PI * 2, false);
      g.strokePath();
    }

    const currentAngle = this.repairItemRotationDeg * (Math.PI / 180) - Math.PI / 2;
    const dotX = dialX + Math.cos(currentAngle) * this.arcRadius;
    const dotY = dialY + Math.sin(currentAngle) * this.arcRadius;

    g.fillStyle(statusColor, this.isTriggerActive ? 1.0 : 0.8);
    g.fillCircle(dotX, dotY, this.triggerHitRadius);
    if (this.isTriggerActive) {
      g.lineStyle(2, Colors.WHITE, 0.9);
      g.strokeCircle(dotX, dotY, this.triggerHitRadius + 4);
    }
  }
}
