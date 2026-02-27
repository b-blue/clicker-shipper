import Phaser from 'phaser';
import { Item, MenuItem } from '../../../types/GameTypes';
import { Colors } from '../../constants/Colors';
import { normalizeItems } from '../../utils/ItemAdapter';
import { DialContext } from './DialContext';
import { FaceEvent } from './FaceEvent';
import { IDialFace } from './IDialFace';
import { StandardNavFace } from './faces/StandardNavFace';
import { QuantityTerminalFace } from './faces/QuantityTerminalFace';
import { RepairTerminalFace } from './faces/RepairTerminalFace';
import { SubDialRegistry } from './registries/SubDialRegistry';
import { TerminalRegistry } from './registries/TerminalRegistry';

// ── Bootstrap default registry entries ──────────────────────────────────────
// These run once at module load so every RadialDial in any scene benefits.
SubDialRegistry.setDefault((_actionId, items) => new StandardNavFace(items));
TerminalRegistry.register('*', '*', (item, ctx) =>
  new QuantityTerminalFace(item, ctx.existingQty ?? 0, ctx.startAngle ?? Math.PI / 2));

/**
 * RadialDial — face-stack coordinator.
 *
 * Owns the shared Phaser display objects (frame graphic, center graphic,
 * center image, input zone), the glow timer, and the face stack.
 * All rendering and input logic lives in the face classes.
 *
 * Public API is identical to the previous monolithic RadialDial so Game.ts
 * and all existing tests continue to work without changes.
 */
export class RadialDial {
  // ── Scene reference ────────────────────────────────────────────────────────
  private readonly _scene: Phaser.Scene;

  // ── Shared display objects (created once; faces use them via DialContext) ──
  private dialFrameGraphic: Phaser.GameObjects.Graphics;
  private centerGraphic:    Phaser.GameObjects.Graphics;
  private centerImage:      Phaser.GameObjects.Image;
  private inputZone:         Phaser.GameObjects.Zone;

  // ── Glow timer ─────────────────────────────────────────────────────────────
  private glowAngle: number = 0;
  private glowTimer: Phaser.Time.TimerEvent | null = null;

  // ── Face stack ─────────────────────────────────────────────────────────────
  private faceStack: IDialFace[] = [];

  // ── Pointer dedup (multi-pointer guard at coordinator level) ──────────────
  private activePointerId: number = -1;
  private pointerConsumed: boolean = false;
  private lastTouchEndTime: number = 0;
  private readonly touchSynthesisWindow: number = 500;

  // ── Context (re-created each push so glowAngle is always current) ─────────
  private readonly dialX: number;
  private readonly dialY: number;
  private readonly sliceRadius: number = 150;
  private readonly centerRadius: number = 50;

  // ── Navigation breadcrumb (set when root face drills down) ────────────────
  /** Id of the currently active A-level action (set on first drillDown from root). */
  private rootActionId: string | null = null;

  // ── Root items (kept so reset() can rebuild the root nav face) ────────────
  private readonly rootItems: MenuItem[];

  constructor(scene: Phaser.Scene, x: number, y: number, items: Item[] | MenuItem[]) {
    this._scene     = scene;
    this.dialX      = x;
    this.dialY      = y;
    this.rootItems  = normalizeItems(items as any);

    this.dialFrameGraphic = scene.add.graphics();
    this.dialFrameGraphic.setDepth(-2);
    this.centerGraphic = scene.add.graphics();
    this.centerImage   = scene.add.image(x, y, '').setScale(1.8).setOrigin(0.5);
    this.centerImage.setDepth(10);
    this.inputZone = scene.add.zone(x, y, 400, 400);

    if (scene.time?.addEvent) {
      this.glowTimer = scene.time.addEvent({
        delay: 60,
        loop: true,
        callback: () => {
          this.glowAngle = (this.glowAngle + 0.15) % (Math.PI * 2);
          this.topFace()?.redraw();
        },
      });
    }

    scene.input.on('pointermove', this.handleMouseMove, this);
    scene.input.on('pointerdown', this.handlePointerDown, this);
    scene.input.on('pointerup',   this.handlePointerUp,   this);

    this.pushFace(new StandardNavFace(this.rootItems));
  }

  // ── Public API (unchanged from monolithic RadialDial) ──────────────────────

  public getDepth(): number {
    const nav = this.findRootNavFace();
    return nav ? nav.getDepth() : 0;
  }

  public getNavigationPath(): string[] {
    const nav = this.findRootNavFace();
    return nav ? nav.getPath() : [];
  }

  public setRepairNavMode(enabled: boolean): void {
    const nav = this.findRootNavFace();
    if (nav) nav.repairNavMode = enabled;
  }

  public showTerminalDial(item: MenuItem, existingQty: number = 0, startAngle: number = Math.PI / 2): void {
    // Pop any existing terminal face
    if (this.topFace() && !(this.topFace() instanceof StandardNavFace)) {
      this.popFace();
    }
    this.pushFace(new QuantityTerminalFace(item, existingQty, startAngle));
  }

  public showRepairDial(item: MenuItem, currentRotationDeg: number, targetRotationDeg: number): void {
    if (this.topFace() && !(this.topFace() instanceof StandardNavFace)) {
      this.popFace();
    }
    this.pushFace(new RepairTerminalFace(item, currentRotationDeg, targetRotationDeg));
  }

  public reset(): void {
    // Clear the whole stack
    while (this.faceStack.length > 0) {
      const f = this.faceStack.pop()!;
      f.deactivate();
      f.destroy();
    }
    this.rootActionId = null;
    this.centerImage.setAngle(0);
    if (this.glowTimer) this.glowTimer.paused = false;
    // Push a fresh root nav face
    this.pushFace(new StandardNavFace(this.rootItems));
  }

  private scene(): Phaser.Scene {
    return this._scene;
  }

  public destroy(): void {
    const s = this.scene();
    s.input.off('pointermove', this.handleMouseMove, this);
    s.input.off('pointerdown', this.handlePointerDown, this);
    s.input.off('pointerup',   this.handlePointerUp,   this);

    while (this.faceStack.length > 0) {
      this.faceStack.pop()!.destroy();
    }

    if (this.glowTimer) this.glowTimer.remove();
    this.dialFrameGraphic.destroy();
    this.centerGraphic.destroy();
    this.centerImage.destroy();
    this.inputZone.destroy();
  }

  // ── Face stack management ──────────────────────────────────────────────────

  private makeContext(): DialContext {
    // glowAngle is a mutable property: capture `this` so the face always reads current value
    const self = this;
    return {
      scene:            this.scene(),
      dialX:            this.dialX,
      dialY:            this.dialY,
      sliceRadius:      this.sliceRadius,
      centerRadius:     this.centerRadius,
      dialFrameGraphic: this.dialFrameGraphic,
      centerGraphic:    this.centerGraphic,
      centerImage:      this.centerImage,
      get glowAngle()     { return self.glowAngle; },
      set glowAngle(v)    { self.glowAngle = v; },
      emit: (event: FaceEvent) => this.handleFaceEvent(event),
    };
  }

  private pushFace(face: IDialFace): void {
    if (this.faceStack.length > 0) {
      this.faceStack[this.faceStack.length - 1].deactivate();
    }
    this.faceStack.push(face);
    face.activate(this.makeContext());
  }

  private popFace(): IDialFace | undefined {
    const face = this.faceStack.pop();
    if (face) {
      face.deactivate();
      face.destroy();
    }
    const top = this.topFace();
    if (top) top.activate(this.makeContext());
    return face;
  }

  private topFace(): IDialFace | undefined {
    return this.faceStack[this.faceStack.length - 1];
  }

  private findRootNavFace(): StandardNavFace | undefined {
    return this.faceStack[0] instanceof StandardNavFace
      ? (this.faceStack[0] as StandardNavFace)
      : undefined;
  }

  // ── Face event dispatch ────────────────────────────────────────────────────

  private handleFaceEvent(event: FaceEvent): void {
    const s = this.scene();

    switch (event.type) {
      case 'drillDown': {
        // Track the root action for terminal registry lookups
        const nav = this.findRootNavFace();
        if (nav && nav.getDepth() === 1) {
          // depth just became 1 — this nav item IS the action
          this.rootActionId = event.item.id;
        }
        s.events.emit('dial:levelChanged', {
          depth: nav?.getDepth() ?? 1,
          item:  event.item,
        });
        // Sub-dial: only push a new face when the nav face itself gets a drillDown
        // *at the root level* (i.e. actionId is being chosen).
        // Deeper drill-downs are handled inside StandardNavFace via its own NavigationController.
        // (For now the nav face manages its own depth internally — sub-dial registry is consulted
        //  only when a custom face replaces the default StandardNavFace.)
        break;
      }

      case 'goBack': {
        const nav = this.findRootNavFace();
        if (this.faceStack.length > 1) {
          // A non-root face (terminal face) is popping itself
          this.popFace();
          if (nav && nav.getDepth() === 0) this.rootActionId = null;
        } else if (nav && nav.canGoBack()) {
          // Root nav face went back internally — update rootActionId
          if (nav.getDepth() === 0) this.rootActionId = null;
        }
        if (this.glowTimer) this.glowTimer.paused = false;
        s.events.emit('dial:goBack');
        break;
      }

      case 'itemConfirmed': {
        s.events.emit('dial:itemConfirmed', {
          item:             event.item,
          sliceCenterAngle: event.sliceCenterAngle,
        });
        break;
      }

      case 'quantityConfirmed': {
        // Pop terminal face, return to nav
        this.popFace();
        if (this.glowTimer) this.glowTimer.paused = false;
        s.events.emit('dial:quantityConfirmed', {
          item:     event.item,
          quantity: event.quantity,
        });
        break;
      }

      case 'repairSettled': {
        s.events.emit('dial:repairSettled', { success: event.success });
        break;
      }

      case 'repairRotated': {
        s.events.emit('dial:repairRotated', { rotation: event.rotation });
        break;
      }
    }
  }

  // ── Input routing ──────────────────────────────────────────────────────────

  private handleMouseMove(pointer: Phaser.Input.Pointer): void {
    this.topFace()?.onPointerMove(pointer);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    this.topFace()?.onPointerDown(pointer);
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    this.topFace()?.onPointerUp(pointer);
  }

  // ── Test-compatibility proxy accessors ─────────────────────────────────────
  // These forward to the active face so existing tests that read/write internal
  // state via `(dial as any).xxx` continue to work after the decomposition.

  /** The item loaded into the active QuantityTerminalFace (null if not in terminal mode). */
  get terminalItem(): MenuItem | null {
    const f = this.topFace();
    return f instanceof QuantityTerminalFace ? f.item : null;
  }

  get isTriggerActive(): boolean {
    return (this.topFace() as any)?.isTriggerActive ?? false;
  }
  set isTriggerActive(v: boolean) {
    const f = this.topFace() as any;
    if (f) f.isTriggerActive = v;
  }

  get arcProgress(): number {
    return (this.topFace() as any)?.arcProgress ?? 0;
  }

  get currentQuantity(): number {
    return (this.topFace() as any)?.currentQuantity ?? 1;
  }

  get terminalStartAngle(): number {
    const f = this.topFace();
    return f instanceof QuantityTerminalFace ? f.terminalStartAngle : Math.PI / 2;
  }

  get selectedItem(): MenuItem | null {
    return this.findRootNavFace()?.selectedItem ?? null;
  }

  get dragStartSliceIndex(): number {
    return this.findRootNavFace()?.dragStartSliceIndex ?? -1;
  }

  get lastNonCenterSliceIndex(): number {
    return this.findRootNavFace()?.lastNonCenterSliceIndex ?? -1;
  }

  get highlightedSliceIndex(): number {
    return this.findRootNavFace()?.highlightedSliceIndex ?? -1;
  }
  set highlightedSliceIndex(v: number) {
    const nav = this.findRootNavFace();
    if (nav) nav.highlightedSliceIndex = v;
  }

  get lastTouchEndTime(): number {
    return this.findRootNavFace()?.lastTouchEndTime ?? 0;
  }
  set lastTouchEndTime(v: number) {
    const nav = this.findRootNavFace();
    if (nav) nav.lastTouchEndTime = v;
  }

  /** Forward redrawDial() calls to the current top face (used by tests). */
  redrawDial(): void {
    this.topFace()?.redraw();
  }
}
