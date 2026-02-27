import Phaser from 'phaser';
import { MenuItem, Item } from '../types/GameTypes';
import { Colors } from '../constants/Colors';
import { NavigationController } from '../controllers/NavigationController';
import { normalizeItems } from '../utils/ItemAdapter';
import { ProgressionManager } from '../managers/ProgressionManager';
import { AssetLoader } from '../managers/AssetLoader';

export class RadialDial {
  private scene: Phaser.Scene;
  private items: MenuItem[];
  private navigationController: NavigationController;
  private sliceCount: number = 6;
  private readonly minSlices: number = 2;
  private readonly maxSlices: number = 6;
  private sliceRadius: number = 150;
  private centerRadius: number = 50;
  private highlightedSliceIndex: number = -1;
  private selectedItem: MenuItem | null = null; // Item shown in center
  private dialX: number;
  private dialY: number;
  private sliceGraphics: Phaser.GameObjects.Graphics[] = [];
  private sliceTexts: Phaser.GameObjects.BitmapText[] = [];
  private sliceImages: Phaser.GameObjects.Image[] = [];
  private sliceGlows: Phaser.GameObjects.Graphics[] = [];
  private dialFrameGraphic: Phaser.GameObjects.Graphics;
  private centerGraphic: Phaser.GameObjects.Graphics;
  private centerImage: Phaser.GameObjects.Image;
  private inputZone: Phaser.GameObjects.Zone;
  private readonly lockedNavItemIdPrefix: string = 'locked_';
  private terminalItem: MenuItem | null = null;

  // Quantity-selector mode (active when terminalItem is set)
  private isTriggerActive: boolean = false;
  private currentQuantity: number = 1;
  private arcProgress: number = 0;          // 0.0–1.0; 0 = start angle, 1 = start − π; negative = removal zone
  private arcRadius: number = 0;            // computed midpoint between centerRadius and sliceRadius
  private terminalStartAngle: number = Math.PI / 2; // dial angle (radians) where the arc track begins
  private readonly triggerHitRadius: number = 18; // px radius of the trigger button
  private arcFillGraphics: Phaser.GameObjects.Graphics | null = null;
  private quantityNumeral: Phaser.GameObjects.BitmapText | null = null;

  // Repair dial mode (active when repairItem is set; mutually exclusive with terminalItem)
  private repairItem: MenuItem | null = null;
  private repairItemRotationDeg: number = 0;
  private repairTargetDeg: number = 0;           // randomized success angle
  private repairNavMode: boolean = false;         // bypasses progression locks for resource nav
  private repairRingDragStartAngle: number = 0;
  private repairRingDragStartRotationDeg: number = 0;
  private repairFillGraphics: Phaser.GameObjects.Graphics | null = null;
  private repairWobblePhase: number = 0;
  // Spatial frequency is a fixed integer (5) so the sine wave closes seamlessly at the
  // theta=0 / theta=2π join point; only phase-advance speed varies with velocity.
  private repairWobbleTimer: Phaser.Time.TimerEvent | null = null;
  private repairPointerAngle: number = 0;        // last pointer angle relative to dial center (rad)
  private repairPointerAngleTime: number = 0;    // ms timestamp of the last pointermove
  private repairPointerAngVel: number = 0;       // rad/ms, EMA-smoothed angular velocity

  // Tap-to-confirm properties
  private dragStartSliceIndex: number = -1; // Index of slice where tap started
  private lastNonCenterSliceIndex: number = -1;
  private pointerConsumed: boolean = false; // guard against duplicate pointerup (touch + synthesized mouse)
  private lastTouchEndTime: number = 0;     // timestamp of last real touch-end, used to suppress synthesized mouse events
  private readonly touchSynthesisWindow: number = 500; // ms within which mouse events after a touch are ignored
  private activePointerId: number = -1;     // pointer ID that owns the current gesture; -1 = no active gesture
  private glowAngle: number = 0;
  private glowTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, items: Item[] | MenuItem[]) {
    this.scene = scene;
    // Normalize to MenuItem[] format (handles both legacy and new formats)
    this.items = normalizeItems(items as any);
    this.navigationController = new NavigationController(this.items);
    this.dialX = x;
    this.dialY = y;
    this.updateSliceCount();
    
    this.dialFrameGraphic = scene.add.graphics();
    this.dialFrameGraphic.setDepth(-2);
    this.centerGraphic = scene.add.graphics();
    this.centerImage = scene.add.image(x, y, '').setScale(1.8).setOrigin(0.5);
    this.centerImage.setDepth(10);
    
    // Create invisible zone for input detection
    this.inputZone = scene.add.zone(x, y, 400, 400);
    
    if (this.scene.time?.addEvent) {
      this.glowTimer = this.scene.time.addEvent({
        delay: 60,
        loop: true,
        callback: () => {
          this.glowAngle = (this.glowAngle + 0.15) % (Math.PI * 2);
          this.redrawDial();
        }
      });
    }

    this.setUpInputHandlers();
    this.reset();
  }

  private setUpInputHandlers(): void {
    // Use bound method references (not anonymous wrappers) so destroy() can
    // pass the same fn + context to off() and reliably remove these listeners.
    this.scene.input.on('pointermove', this.handleMouseMove, this);
    this.scene.input.on('pointerdown', this.handlePointerDown, this);
    this.scene.input.on('pointerup',   this.handlePointerUp,   this);
  }

  private handleMouseMove(pointer: Phaser.Input.Pointer): void {
    // Repair dial mode: ring drag tracking
    if (this.repairItem) {
      if (this.isTriggerActive) {
        const dx = pointer.x - this.dialX;
        const dy = pointer.y - this.dialY;
        const newAngle = Math.atan2(dy, dx);

        // Angular velocity: normalize the angle difference to avoid ±π seam jumps
        const now = Date.now();
        const dt = Math.max(1, now - this.repairPointerAngleTime);
        let dAngle = newAngle - this.repairPointerAngle;
        while (dAngle > Math.PI)  dAngle -= 2 * Math.PI;
        while (dAngle < -Math.PI) dAngle += 2 * Math.PI;
        const rawVel = Math.abs(dAngle) / dt;          // rad/ms
        this.repairPointerAngVel = 0.5 * this.repairPointerAngVel + 0.5 * rawVel; // EMA smoothing
        this.repairPointerAngle = newAngle;
        this.repairPointerAngleTime = now;

        let delta = newAngle - this.repairRingDragStartAngle;
        while (delta > Math.PI)  delta -= 2 * Math.PI;
        while (delta < -Math.PI) delta += 2 * Math.PI;
        this.repairItemRotationDeg = this.repairRingDragStartRotationDeg + delta * (180 / Math.PI);
        this.scene.events.emit('dial:repairRotated', { rotation: this.repairItemRotationDeg });
        this.redrawDial();
      }
      return;
    }
    // Terminal mode: only update arc fill when trigger is held
    if (this.terminalItem) {
      if (this.isTriggerActive) {
        const dx = pointer.x - this.dialX;
        const dy = pointer.y - this.dialY;
        const pointerAngle = Math.atan2(dy, dx);
        // Compute CCW angular travel from the arc start to the pointer.
        // Normalize to (-π, π] first to handle the atan2 ±π seam (which would
        // otherwise cause a jump when the pointer crosses the 9-o'clock axis).
        let angularTravel = this.terminalStartAngle - pointerAngle;
        while (angularTravel > Math.PI)  angularTravel -= 2 * Math.PI;
        while (angularTravel < -Math.PI) angularTravel += 2 * Math.PI;
        // Clamp: 1.5 slices CW for removal (π/2) to 2.5 slices CCW for qty 3 (5π/6)
        angularTravel = Math.max(-Math.PI / 2, Math.min(5 * Math.PI / 6, angularTravel));
        // Map travel onto [-0.6, 1.0]; negative = removal zone, 0 = start, 1 = qty-3 max
        this.arcProgress = angularTravel / (5 * Math.PI / 6);
        // Zone centres: qty1→0, qty2→0.4, qty3→0.8; boundaries at ±0.2, ±0.6
        this.currentQuantity = Math.max(0, Math.min(3, Math.round(this.arcProgress * 2.5 + 1)));
        this.redrawDial();
      }
      return;
    }

    const dx = pointer.x - this.dialX;
    const dy = pointer.y - this.dialY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Check if pointer is in center
    if (distance < this.centerRadius) {
      if (this.highlightedSliceIndex !== -999) {
        this.highlightedSliceIndex = -999;
        this.redrawDial();
      }
      return;
    }

    // Check if pointer is within the dial region
    if (distance < this.sliceRadius && distance > this.centerRadius + 5) {
      const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      const normalizedAngle = (angle + 360) % 360;
      const sliceAngle = 360 / this.sliceCount;
      const sliceIndex = Math.floor(normalizedAngle / sliceAngle);

      if (sliceIndex < this.sliceCount && sliceIndex !== this.highlightedSliceIndex) {
        this.highlightedSliceIndex = sliceIndex;
        this.lastNonCenterSliceIndex = sliceIndex;
        this.updateSelectedItem();
        this.redrawDial();
      }
    } else {
      if (this.highlightedSliceIndex !== -1 && this.highlightedSliceIndex !== -999) {
        this.highlightedSliceIndex = -1;
        this.selectedItem = null;
        this.redrawDial();
      }
    }
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    // Guard 1: simultaneous secondary touches (e.g. palm + finger on mobile).
    if (this.activePointerId !== -1 && pointer.pointerId !== this.activePointerId) {
      return;
    }

    const dx = pointer.x - this.dialX;
    const dy = pointer.y - this.dialY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Reset gesture state
    this.dragStartSliceIndex = -1;
    this.lastNonCenterSliceIndex = -1;

    // Guard 2: suppress synthesized mouse-down events browsers fire ~300 ms after a real touch.
    // pointer.wasTouch is unreliable in Phaser 3.90's pointer-event path, so also check the
    // underlying DOM event's pointerType directly.
    const isTouch = pointer.wasTouch || (pointer.event as PointerEvent | undefined)?.pointerType === 'touch';
    if (!isTouch && (Date.now() - this.lastTouchEndTime) < this.touchSynthesisWindow) {
      return;
    }

    this.activePointerId = pointer.pointerId; // claim this gesture for this pointer
    this.pointerConsumed = false; // genuine new gesture — allow next pointerup to process

    // Repair dial mode: full annular ring is the drag surface
    if (this.repairItem) {
      const innerRing = this.centerRadius + 8;
      const outerRing = this.sliceRadius - 8;
      if (distance >= innerRing && distance <= outerRing) {
        this.isTriggerActive = true;
        this.repairRingDragStartAngle = Math.atan2(dy, dx);
        this.repairRingDragStartRotationDeg = this.repairItemRotationDeg;
        this.repairWobblePhase = 0;
        this.repairPointerAngle = Math.atan2(dy, dx);
        this.repairPointerAngleTime = Date.now();
        this.repairPointerAngVel = 0;
        // Drive the wobble animation at ~60 fps for as long as the finger is held.
        // Phase-advance rate and spatial frequency both scale with angular velocity.
        this.repairWobbleTimer = this.scene.time.addEvent({
          delay: 16,
          loop: true,
          callback: () => {
            // Decay velocity so the wave eases back to the base rate when the finger stops.
            this.repairPointerAngVel *= 0.90;
            // tanh compresses outliers without hard-clamping.
            // Multiplier 80 keeps typical dial angular velocities (0.001–0.015 rad/ms)
            // across the responsive part of the curve rather than saturating immediately.
            // Range: 0.03 (stopped) → 0.25 (fast swipe).
            const phaseStep = 0.03 + 0.22 * Math.tanh(this.repairPointerAngVel * 80);
            this.repairWobblePhase += phaseStep;
            this.redrawDial();
          },
        });
        this.redrawDial();
      }
      return;
    }
    // Terminal mode: only the dynamic trigger button is interactive
    if (this.terminalItem) {
      const triggerAngle = this.terminalStartAngle - this.arcProgress * (5 * Math.PI / 6);
      const triggerX = this.dialX + Math.cos(triggerAngle) * this.arcRadius;
      const triggerY = this.dialY + Math.sin(triggerAngle) * this.arcRadius;
      const tdx = pointer.x - triggerX;
      const tdy = pointer.y - triggerY;
      const triggerDist = Math.sqrt(tdx * tdx + tdy * tdy);
      if (triggerDist <= this.triggerHitRadius) {
        this.isTriggerActive = true;
        this.redrawDial();
      }
      return;
    }

    // Check if started on a slice
    if (distance < this.sliceRadius && distance > this.centerRadius + 5) {
      const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      const normalizedAngle = (angle + 360) % 360;
      const sliceAngle = 360 / this.sliceCount;
      const sliceIndex = Math.floor(normalizedAngle / sliceAngle);

      if (sliceIndex < this.sliceCount) {
        this.dragStartSliceIndex = sliceIndex;
        this.highlightedSliceIndex = sliceIndex;
        this.lastNonCenterSliceIndex = sliceIndex;
        this.updateSelectedItem();
        this.redrawDial();
      }
    }
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    // Only process the pointer that owns the current gesture.
    if (this.activePointerId !== -1 && pointer.pointerId !== this.activePointerId) {
      return;
    }
    // Ignore duplicate pointerup events from the same gesture (e.g. touch + synthesized mouse)
    if (this.pointerConsumed) return;
    this.pointerConsumed = true;
    this.activePointerId = -1; // release gesture ownership

    // Record when a real touch ends so handlePointerDown can suppress the
    // synthesized mouse events the browser fires shortly after.
    // Check both wasTouch and the underlying DOM event's pointerType because
    // Phaser 3.90's pointer-event path does not always set wasTouch correctly.
    const isTouch = pointer.wasTouch || (pointer.event as PointerEvent | undefined)?.pointerType === 'touch';
    if (isTouch) {
      this.lastTouchEndTime = Date.now();
    }

    const endX = pointer.x;
    const endY = pointer.y;
    const endDx = endX - this.dialX;
    const endDy = endY - this.dialY;
    const endDistance = Math.sqrt(endDx * endDx + endDy * endDy);

    // Repair dial mode: settle rotation on finger-up, cancel on center tap
    if (this.repairItem) {
      if (this.isTriggerActive) {
        this.isTriggerActive = false;
        if (this.repairWobbleTimer) { this.repairWobbleTimer.remove(); this.repairWobbleTimer = null; }
        this.repairWobblePhase = 0;
        let normalized = this.repairItemRotationDeg % 360;
        if (normalized > 180) normalized -= 360;
        if (normalized <= -180) normalized += 360;
        this.repairItemRotationDeg = normalized;
        const success = Math.abs(normalized) <= 10;
        this.scene.events.emit('dial:repairSettled', { success });
        this.redrawDial();
        return;
      }
      if (endDistance < this.centerRadius) {
        this.repairItem = null;
        this.isTriggerActive = false;
        if (this.repairWobbleTimer) { this.repairWobbleTimer.remove(); this.repairWobbleTimer = null; }
        this.repairWobblePhase = 0;
        if (this.repairFillGraphics) { this.repairFillGraphics.destroy(); this.repairFillGraphics = null; }
        this.centerImage.setAngle(0);
        if (this.glowTimer) this.glowTimer.paused = false;
        this.updateSliceCount();
        this.redrawDial();
        this.scene.events.emit('dial:goBack');
        return;
      }
      return;
    }

    // Terminal mode: emit quantity on trigger release, or cancel on center tap
    if (this.terminalItem) {
      if (this.isTriggerActive) {
        const targetItem = this.terminalItem;
        const qty = this.currentQuantity;
        this.terminalItem = null;
        this.isTriggerActive = false;
        this.arcProgress = 0;
        this.currentQuantity = 1;
        if (this.arcFillGraphics) { this.arcFillGraphics.destroy(); this.arcFillGraphics = null; }
        if (this.quantityNumeral) { this.quantityNumeral.destroy(); this.quantityNumeral = null; }
        this.scene.events.emit('dial:quantityConfirmed', { item: targetItem, quantity: qty });
        this.reset();
        return;
      }
      if (endDistance < this.centerRadius) {
        this.terminalItem = null;
        this.isTriggerActive = false;
        this.arcProgress = 0;
        this.currentQuantity = 1;
        if (this.arcFillGraphics) { this.arcFillGraphics.destroy(); this.arcFillGraphics = null; }
        if (this.quantityNumeral) { this.quantityNumeral.destroy(); this.quantityNumeral = null; }
        this.highlightedSliceIndex = -1;
        this.selectedItem = null;
        this.updateSliceCount();
        this.redrawDial();
        this.scene.events.emit('dial:goBack');
        return;
      }
      // Pointer released outside trigger and center — no-op
      this.dragStartSliceIndex = -1;
      this.lastNonCenterSliceIndex = -1;
      return;
    }

    // Tap scheme: any pointerup that started on a slice confirms it immediately
    if (this.dragStartSliceIndex >= 0) {
      const confirmedSliceIndex = this.lastNonCenterSliceIndex;
      
      const displayItems = this.getDisplayItems();
      
      if (confirmedSliceIndex < displayItems.length) {
        const confirmedItem = displayItems[confirmedSliceIndex];

        if (!this.repairNavMode && this.isLockedNavItem(confirmedItem)) {
          this.selectedItem = null;
          this.highlightedSliceIndex = -1;
          this.redrawDial();
          return;
        }

        if (this.navigationController.isNavigable(confirmedItem)) {
          // Drill down to children
          this.navigationController.drillDown(confirmedItem);
          this.updateSliceCount();
          this.highlightedSliceIndex = -1;
          this.selectedItem = null;
          this.redrawDial();
          this.scene.events.emit('dial:levelChanged', { 
            depth: this.navigationController.getDepth(),
            item: confirmedItem 
          });
        } else {
          // Confirm leaf item selection — include the slice's center angle so the
          // terminal dial can orient its trigger thumb toward the tapping finger.
          const sliceRad = (2 * Math.PI) / this.sliceCount;
          const sliceCenterAngle = -Math.PI / 2 + (confirmedSliceIndex + 0.5) * sliceRad;
          this.scene.events.emit('dial:itemConfirmed', { item: confirmedItem, sliceCenterAngle });
          this.selectedItem = null;
          this.highlightedSliceIndex = -1;
          this.redrawDial();
        }
      }
    } else if (endDistance < this.centerRadius) {
      // Single tap on center (not drag) = go back
      if (this.navigationController.canGoBack()) {
        this.navigationController.goBack();
        this.updateSliceCount();
        this.highlightedSliceIndex = -1;
        this.selectedItem = null;
        this.redrawDial();
        this.scene.events.emit('dial:goBack');
      }
    }

    // Reset gesture state
    this.dragStartSliceIndex = -1;
    this.lastNonCenterSliceIndex = -1;
  }

  private shouldLockNavItem(item: MenuItem): boolean {
    // A-level locked placeholder slots are pre-built in Game.ts — nothing to transform here
    if (this.navigationController.getDepth() < 1) return false;
    // Only nav_*_down_* items can be progression-locked at sub-levels
    const match = item.id.match(/^nav_(.+)_down_(\d+)$/);
    if (!match) return false;
    const categoryId = `nav_${match[1]}_root`;
    const levelN = parseInt(match[2], 10);
    // Lock this nav node if its level number meets or exceeds the unlocked depth
    // e.g. unlockedDepth=1 → nav_*_down_1 (levelN=1) is locked; unlockedDepth=2 → nav_*_down_1 unlocked, nav_*_down_2 locked
    return levelN >= ProgressionManager.getInstance().getUnlockedDepth(categoryId);
  }

  private createLockedNavItem(item: MenuItem): MenuItem {
    return {
      id: `${this.lockedNavItemIdPrefix}${item.id}`,
      name: 'LOCKED',
      icon: 'skill-blocked',
      layers: [
        { texture: 'skill-blocked', depth: 3 },
        { texture: 'frame', depth: 2 }
      ]
    };
  }

  private isLockedNavItem(item: MenuItem): boolean {
    return item.id.startsWith(this.lockedNavItemIdPrefix);
  }

  private getDisplayItems(): MenuItem[] {
    const items = this.navigationController.getCurrentItems();
    // Repair nav mode: all items always visible regardless of progression
    if (this.repairNavMode) return items;
    // At A-level, locked placeholder slots are already in the items list (built in Game.ts)
    if (this.navigationController.getDepth() < 1) {
      return items;
    }
    // At sub-levels, transform nav_*_down_* items into locked placeholders based on progression
    return items.map(item => this.shouldLockNavItem(item) ? this.createLockedNavItem(item) : item);
  }

  private updateSelectedItem(): void {
    const displayItems = this.getDisplayItems();
    
    if (this.highlightedSliceIndex >= 0 && this.highlightedSliceIndex < displayItems.length) {
      this.selectedItem = displayItems[this.highlightedSliceIndex];
    }
  }

  /** Atlas-aware texture setter for the persistent center image. */
  private setCenterTexture(iconKey: string): void {
    const atlasKey = AssetLoader.getAtlasKey(iconKey);
    if (atlasKey) {
      this.centerImage.setTexture(atlasKey, iconKey);
    } else {
      this.centerImage.setTexture(iconKey);
    }
  }

  private redrawDial(): void {
    this.clearSliceObjects();
    const displayItems = this.getDisplayItems();
    const sliceAngle = (Math.PI * 2) / this.sliceCount;
    this.drawDialFrame(sliceAngle);
    this.drawCenterIndicator();
    if (this.repairItem) {
      this.drawRepairFace();
    } else if (this.terminalItem) {
      this.drawQuantityFace();
    } else {
      this.drawAllSlices(displayItems, sliceAngle);
    }
    this.centerGraphic.setDepth(10);
    this.centerImage.setDepth(10);
  }

  /** Destroy all per-frame slice objects and reset their backing arrays. */
  private clearSliceObjects(): void {
    this.sliceGraphics.forEach(g => g.destroy());
    this.sliceTexts.forEach(t => t.destroy());
    this.sliceImages.forEach(i => i.destroy());
    this.sliceGlows.forEach(g => g.destroy());
    this.sliceGraphics = [];
    this.sliceTexts = [];
    this.sliceImages = [];
    this.sliceGlows = [];
  }

  /** Draw the outer HUD frame circle and (when not in terminal mode) the radial divider lines between slices. */
  private drawDialFrame(sliceAngle: number): void {
    this.dialFrameGraphic.clear();
    const frameRadius = this.sliceRadius + 10;
    this.dialFrameGraphic.fillStyle(Colors.PANEL_DARK, 0.65);
    this.dialFrameGraphic.fillCircle(this.dialX, this.dialY, frameRadius);
    this.dialFrameGraphic.lineStyle(2, Colors.BORDER_BLUE, 1.0);
    this.dialFrameGraphic.strokeCircle(this.dialX, this.dialY, frameRadius);
    this.dialFrameGraphic.lineStyle(1, Colors.BORDER_BLUE, 0.7);
    this.dialFrameGraphic.strokeCircle(this.dialX, this.dialY, this.sliceRadius * 0.6);
    // Slice dividers are not drawn in terminal or repair mode
    if (!this.terminalItem && !this.repairItem) {
      this.dialFrameGraphic.beginPath();
      for (let i = 0; i < this.sliceCount; i++) {
        const angle = i * sliceAngle - Math.PI / 2;
        const inner = this.centerRadius + 6;
        const outer = this.sliceRadius + 8;
        this.dialFrameGraphic.moveTo(this.dialX + Math.cos(angle) * inner, this.dialY + Math.sin(angle) * inner);
        this.dialFrameGraphic.lineTo(this.dialX + Math.cos(angle) * outer, this.dialY + Math.sin(angle) * outer);
      }
      this.dialFrameGraphic.strokePath();
    }
  }

  /** Draw the center ring, rotating glow arc, and the center preview image. */
  private drawCenterIndicator(): void {
    this.centerGraphic.clear();
    this.centerGraphic.fillStyle(Colors.PANEL_DARK, 0.35);
    this.centerGraphic.fillCircle(this.dialX, this.dialY, this.centerRadius - 2);

    if (this.repairItem) {
      // Repair mode: tint the center perimeter with the same status colour as the ring
      this.centerGraphic.lineStyle(3, this.getRepairStatusColor(), 0.9);
      this.centerGraphic.strokeCircle(this.dialX, this.dialY, this.centerRadius);
      const repairIconKey = this.repairItem.icon || this.repairItem.id;
      if (AssetLoader.textureExists(this.scene, repairIconKey)) {
        this.setCenterTexture(repairIconKey);
        this.centerImage.setPosition(this.dialX, this.dialY);
        this.centerImage.setAngle(this.repairItemRotationDeg);
        this.centerImage.setVisible(true);
      } else {
        this.centerImage.setVisible(false);
      }
      return;
    }
    if (this.terminalItem) {
      // Quantity-selector mode: show item icon and quantity numeral, no glow animation
      this.centerGraphic.lineStyle(3, Colors.LIGHT_BLUE, 0.7);
      this.centerGraphic.strokeCircle(this.dialX, this.dialY, this.centerRadius);
      const iconKey = this.terminalItem.icon || this.terminalItem.id;
      if (AssetLoader.textureExists(this.scene, iconKey)) {
        this.setCenterTexture(iconKey);
        this.centerImage.setPosition(this.dialX, this.dialY - 8);
        this.centerImage.setVisible(true);
      } else {
        this.centerImage.setVisible(false);
      }
      // Removal zone starts half a slice CW from start (arcProgress < -0.2)
      const isRemoval = this.arcProgress < -0.2;
      // Match arc-fill colour thresholds exactly: 0.2 and 0.6
      const numeralColor = isRemoval ? 0xff2244 : (this.arcProgress < 0.2 ? 0x00cccc : (this.arcProgress < 0.6 ? 0xffd700 : 0xff8800));
      if (this.quantityNumeral) {
        this.quantityNumeral.setText(String(this.currentQuantity));
        this.quantityNumeral.setTint(numeralColor);
      } else {
        this.quantityNumeral = this.scene.add.bitmapText(
          this.dialX, this.dialY + 12, 'clicker', String(this.currentQuantity), 20
        ).setOrigin(0.5).setDepth(11).setTint(numeralColor);
      }
      return;
    }

    const ringColor = this.highlightedSliceIndex === -999 && this.navigationController.getDepth() > 0
      ? Colors.HIGHLIGHT_YELLOW : Colors.LIGHT_BLUE;
    this.centerGraphic.lineStyle(3, ringColor, 0.7);
    this.centerGraphic.strokeCircle(this.dialX, this.dialY, this.centerRadius);

    const glowStart = this.glowAngle;
    this.centerGraphic.lineStyle(4, Colors.HIGHLIGHT_YELLOW_BRIGHT, 0.6);
    this.centerGraphic.beginPath();
    this.centerGraphic.arc(this.dialX, this.dialY, this.centerRadius + 2, glowStart, glowStart + Math.PI / 3);
    this.centerGraphic.strokePath();

    // Show selected item icon, or the default back/nav icon when nothing is selected
    const centerDisplayItem = this.selectedItem;
    if (centerDisplayItem) {
      const textureKey = (centerDisplayItem as any).icon || (centerDisplayItem as any).id;
      if (AssetLoader.textureExists(this.scene, textureKey)) {
        this.setCenterTexture(textureKey);
        this.centerImage.setPosition(this.dialX, this.dialY);
        this.centerImage.setVisible(true);
      } else {
        this.centerImage.setVisible(false);
      }
    } else {
      const defaultKey = (this.terminalItem || this.navigationController.getDepth() > 0) ? 'skill-up' : 'skill-diagram';
      if (AssetLoader.textureExists(this.scene, defaultKey)) {
        this.setCenterTexture(defaultKey);
        this.centerImage.setPosition(this.dialX, this.dialY);
        this.centerImage.setVisible(true);
      } else {
        this.centerImage.setVisible(false);
      }
    }
  }

  /**
   * Draw the quantity-selector arc face (shown instead of slices when terminalItem is set).
   *
   * Arc runs along arcRadius (midpoint between center and outer ring).
   * Right semicircle: 6 o’clock (π/2) counterclockwise to 12 o’clock (−π/2).
   * Three equal 60° zones map to quantities 1, 2, 3.
   * Extending clockwise past 6 o’clock enters the removal zone (qty 0).
   */
  private drawQuantityFace(): void {
    if (this.arcFillGraphics) {
      this.arcFillGraphics.destroy();
      this.arcFillGraphics = null;
    }
    const g = this.scene.add.graphics();
    g.setDepth(1);
    this.arcFillGraphics = g;

    const { dialX, dialY, arcRadius, arcProgress, terminalStartAngle } = this;
    // Arc spans 4 slices total: 2.5 slices CCW (qty 1-3) + 1.5 slices CW (removal).
    // arcProgress ∈ [-0.6, 1.0]; zone centres: qty1→0, qty2→0.4, qty3→0.8.
    const arcSweep = 5 * Math.PI / 6; // CCW portion = 2.5 × (π/3)

    // Dynamic trigger position
    const triggerAngle = terminalStartAngle - arcProgress * arcSweep;
    const triggerX = dialX + Math.cos(triggerAngle) * arcRadius;
    const triggerY = dialY + Math.sin(triggerAngle) * arcRadius;

    // CCW quantity track: 2.5 slices dim
    g.lineStyle(8, 0x223344, 1.0);
    g.beginPath();
    g.arc(dialX, dialY, arcRadius, terminalStartAngle, terminalStartAngle - arcSweep, true);
    g.strokePath();

    // CW removal track: full 1.5 slices dim red from start angle
    g.lineStyle(8, 0x331111, 1.0);
    g.beginPath();
    g.arc(dialX, dialY, arcRadius, terminalStartAngle, terminalStartAngle + Math.PI / 2, false);
    g.strokePath();

    // Fill arc
    if (arcProgress > 0) {
      // Colour by zone: cyan=qty1 (0–0.2), yellow=qty2 (0.2–0.6), orange=qty3 (0.6+)
      const arcColor = arcProgress < 0.2 ? 0x00cccc : (arcProgress < 0.6 ? 0xffd700 : 0xff8800);
      g.lineStyle(8, arcColor, 1.0);
      g.beginPath();
      const fillEndAngle = terminalStartAngle - arcProgress * arcSweep;
      g.arc(dialX, dialY, arcRadius, terminalStartAngle, fillEndAngle, true);
      g.strokePath();
    } else if (arcProgress < 0) {
      // CW fill: cyan up to the half-slice tick (-0.2), red past it (removal zone)
      const fillColor = arcProgress >= -0.2 ? 0x00cccc : 0xff2244;
      const fillEndAngle = terminalStartAngle - arcProgress * arcSweep; // CW: end > start
      g.lineStyle(8, fillColor, 1.0);
      g.beginPath();
      g.arc(dialX, dialY, arcRadius, terminalStartAngle, fillEndAngle, false);
      g.strokePath();
    }

    // Tick marks at absolute slice-divider angles falling inside the CCW sweep.
    // Dividers: -π/2, -π/6, π/6, π/2, 5π/6, -5π/6 (60° apart from 12 o'clock).
    const dividers = Array.from({ length: 6 }, (_, k) => -Math.PI / 2 + k * Math.PI / 3);
    dividers.forEach(d => {
      // CCW travel from terminalStartAngle to this divider, normalised to [0, 2π)
      let t = terminalStartAngle - d;
      while (t < 0)            t += 2 * Math.PI;
      while (t >= 2 * Math.PI) t -= 2 * Math.PI;
      // Draw ticks strictly inside the CCW sweep OR within the CW sweep (π/2 CW from start).
      // CW distance from start = 2π − t; within π/2 CW means t > 2π − π/2 = 3π/2.
      const inCCW = t > 0 && t < arcSweep;
      const inCW  = t > (2 * Math.PI - Math.PI / 2); // within the 1.5-slice CW sweep
      if (!inCCW && !inCW) return;
      const inner = arcRadius - 8;
      const outer = arcRadius + 8;
      g.lineStyle(2, 0xffffff, 0.5);
      g.beginPath();
      g.moveTo(dialX + Math.cos(d) * inner, dialY + Math.sin(d) * inner);
      g.lineTo(dialX + Math.cos(d) * outer, dialY + Math.sin(d) * outer);
      g.strokePath();
    });

    // Trigger button at the current arc-progress position
    g.fillStyle(this.isTriggerActive ? 0xffffff : 0xaaaacc, this.isTriggerActive ? 1.0 : 0.8);
    g.fillCircle(triggerX, triggerY, this.triggerHitRadius);
    if (this.isTriggerActive) {
      g.lineStyle(2, 0xffffff, 0.9);
      g.strokeCircle(triggerX, triggerY, this.triggerHitRadius + 4);
    }
  }

  /** Returns the status colour for the repair ring / center perimeter based on how close the item is to upright (0°). */
  private getRepairStatusColor(): number {
    let normDeg = this.repairItemRotationDeg % 360;
    if (normDeg > 180) normDeg -= 360;
    if (normDeg <= -180) normDeg += 360;
    const absDeg = Math.abs(normDeg);
    return absDeg <= 10 ? 0x44ff88 : (absDeg <= 30 ? 0xffd700 : 0xaaaacc);
  }

  /**
   * Draw the repair-dial face: a full 360° ring with a target tick at 12 o'clock
   * and a draggable indicator dot at the item's current rotation.
   *
   * While dragging (isTriggerActive) the ring wobbles with a sine wave whose phase
   * advances on every pointermove, giving a rippling effect for as long as the
   * finger is sliding. The ring and indicator dot both tint to the same status
   * colour (green ≤10°, yellow ≤30°, muted otherwise).
   */
  private drawRepairFace(): void {
    if (this.repairFillGraphics) {
      this.repairFillGraphics.destroy();
      this.repairFillGraphics = null;
    }
    const g = this.scene.add.graphics();
    g.setDepth(1);
    this.repairFillGraphics = g;

    const { dialX, dialY, arcRadius } = this;
    const statusColor = this.getRepairStatusColor();

    // Ring track — wobbles with a sine wave while dragging, smooth arc at rest
    if (this.isTriggerActive) {
      const AMPL = 6;  // px peak-to-peak wobble amplitude
      const FREQ = 5;  // integer: ensures sin(FREQ*2π)=sin(0) so the ring closes without a seam kink
      const N    = 64; // polygon segment count
      g.lineStyle(8, statusColor, 0.9);
      g.beginPath();
      for (let j = 0; j <= N; j++) {
        const theta = (j / N) * Math.PI * 2;
        const r = arcRadius + AMPL * Math.sin(FREQ * theta + this.repairWobblePhase);
        const px = dialX + Math.cos(theta) * r;
        const py = dialY + Math.sin(theta) * r;
        if (j === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.strokePath();
    } else {
      g.lineStyle(8, statusColor, 0.35);
      g.beginPath();
      g.arc(dialX, dialY, arcRadius, 0, Math.PI * 2, false);
      g.strokePath();
    }

    // Draggable indicator dot: ring position is offset by repairTargetDeg so the
    // green zone appears at a randomized spot. Success is always icon = 0° (upright).
    const currentAngle = (this.repairItemRotationDeg + this.repairTargetDeg) * (Math.PI / 180) - Math.PI / 2;
    const dotX = dialX + Math.cos(currentAngle) * arcRadius;
    const dotY = dialY + Math.sin(currentAngle) * arcRadius;

    g.fillStyle(statusColor, this.isTriggerActive ? 1.0 : 0.8);
    g.fillCircle(dotX, dotY, this.triggerHitRadius);
    if (this.isTriggerActive) {
      g.lineStyle(2, Colors.WHITE, 0.9);
      g.strokeCircle(dotX, dotY, this.triggerHitRadius + 4);
    }
  }

  /** Render every slice: glow, pie wedge, and item icon/label. */
  private drawAllSlices(displayItems: MenuItem[], sliceAngle: number): void {
    for (let i = 0; i < this.sliceCount; i++) {
      const startAngle = i * sliceAngle - Math.PI / 2;
      const endAngle = startAngle + sliceAngle;
      const isHighlighted = i === this.highlightedSliceIndex;
      const sliceItem = displayItems[i];
      const isLockedItem = sliceItem ? this.isLockedNavItem(sliceItem) : false;
      const isALevelLocked = isLockedItem && this.navigationController.getDepth() === 0;
      const color = isHighlighted ? Colors.SLICE_HIGHLIGHTED : (isALevelLocked ? 0x11111a : Colors.SLICE_NORMAL);
      const alpha = isHighlighted ? 0.9 : (isALevelLocked ? 0.5 : 0.8);

      // Neon glow behind highlighted slice
      if (isHighlighted) {
        const glowGraphics = this.scene.add.graphics();
        for (let g = 0; g < 8; g++) {
          const radius = this.sliceRadius + 8 + (g * 3);
          const opacity = Math.pow(1 - (g / 8), 3) * 0.15;
          glowGraphics.fillStyle(Colors.NEON_BLUE, opacity);
          glowGraphics.beginPath();
          glowGraphics.moveTo(this.dialX, this.dialY);
          glowGraphics.lineTo(this.dialX + Math.cos(startAngle) * radius, this.dialY + Math.sin(startAngle) * radius);
          glowGraphics.arc(this.dialX, this.dialY, radius, startAngle, endAngle);
          glowGraphics.lineTo(this.dialX, this.dialY);
          glowGraphics.closePath();
          glowGraphics.fillPath();
        }
        glowGraphics.setDepth(0.25);
        this.sliceGlows.push(glowGraphics);
      }

      // Pie wedge
      const graphics = this.scene.add.graphics();
      graphics.fillStyle(color, alpha);
      graphics.beginPath();
      graphics.moveTo(this.dialX, this.dialY);
      graphics.lineTo(this.dialX + Math.cos(startAngle) * this.sliceRadius, this.dialY + Math.sin(startAngle) * this.sliceRadius);
      graphics.arc(this.dialX, this.dialY, this.sliceRadius, startAngle, endAngle);
      graphics.lineTo(this.dialX, this.dialY);
      graphics.closePath();
      graphics.fillPath();
      graphics.lineStyle(1, Colors.NEON_BLUE, 0.35);
      graphics.beginPath();
      graphics.moveTo(this.dialX, this.dialY);
      graphics.lineTo(this.dialX + Math.cos(startAngle) * this.sliceRadius, this.dialY + Math.sin(startAngle) * this.sliceRadius);
      graphics.arc(this.dialX, this.dialY, this.sliceRadius, startAngle, endAngle);
      graphics.lineTo(this.dialX, this.dialY);
      graphics.closePath();
      graphics.strokePath();
      graphics.setDepth(0);
      this.sliceGraphics.push(graphics);

      if (!sliceItem) continue;

      // Item icon / label
      const midAngle = startAngle + sliceAngle / 2;
      const textX = this.dialX + Math.cos(midAngle) * (this.sliceRadius - 40);
      const textY = this.dialY + Math.sin(midAngle) * (this.sliceRadius - 40);
      const lockedAlpha = isLockedItem ? 0.35 : 1;

      if ('id' in sliceItem) {
        const hasLayers = 'layers' in sliceItem && sliceItem.layers && sliceItem.layers.length > 0;
        if (hasLayers) {
          const baseScale = this.navigationController.getScaleForDepth();
          sliceItem.layers!.forEach((layer, index) => {
            if (AssetLoader.textureExists(this.scene, layer.texture)) {
              const layerImage = AssetLoader.createImage(this.scene, textX, textY, layer.texture);
              layerImage.setScale((layer.scale ?? 1) * baseScale);
              layerImage.setDepth(layer.depth ?? (2 + index));
              layerImage.setAlpha(layer.alpha ?? lockedAlpha);
              if (layer.tint !== undefined) layerImage.setTint(layer.tint);
              this.sliceImages.push(layerImage);
            }
          });
        } else if ('icon' in sliceItem && sliceItem.icon) {
          if (AssetLoader.textureExists(this.scene, sliceItem.icon)) {
            const image = AssetLoader.createImage(this.scene, textX, textY, sliceItem.icon);
            image.setScale(this.navigationController.getScaleForDepth());
            image.setDepth(2);
            image.setAlpha(lockedAlpha);
            this.sliceImages.push(image);
          } else {
            const text = this.scene.add.bitmapText(textX, textY, 'clicker', sliceItem.name.toUpperCase(), this.navigationController.getDepth() === 0 ? 12 : 11)
              .setOrigin(0.5, 0.5).setMaxWidth(80).setDepth(0);
            this.sliceTexts.push(text);
          }
        } else if (AssetLoader.textureExists(this.scene, sliceItem.id)) {
          const image = AssetLoader.createImage(this.scene, textX, textY, sliceItem.id);
          image.setScale(this.navigationController.getScaleForDepth());
          image.setDepth(2);
          this.sliceImages.push(image);
        } else {
          const text = this.scene.add.bitmapText(textX, textY, 'clicker', sliceItem.name.toUpperCase(), this.navigationController.getDepth() === 0 ? 12 : 11)
            .setOrigin(0.5, 0.5).setMaxWidth(80).setDepth(0);
          this.sliceTexts.push(text);
        }
      } else {
        const text = this.scene.add.bitmapText(textX, textY, 'clicker', (sliceItem as any).name.toUpperCase(), 12)
          .setOrigin(0.5, 0.5).setMaxWidth(80).setDepth(0);
        this.sliceTexts.push(text);
        if (this.navigationController.isNavigable(sliceItem)) {
          const badge = this.scene.add.bitmapText(textX + 20, textY - 20, 'clicker', '>', 16)
            .setOrigin(0.5, 0.5).setDepth(5);
          this.sliceTexts.push(badge);
        }
      }
    }
  }

  /** Returns the current navigation depth (0 = root). */
  public getDepth(): number {
    return this.navigationController.getDepth();
  }

  /** Returns the navigation path as an array of node ids from root to current. */
  public getNavigationPath(): string[] {
    return this.navigationController.getPath();
  }

  public reset(): void {
    this.navigationController.reset();
    this.terminalItem = null;
    this.repairItem = null;
    this.repairItemRotationDeg = 0;
    this.repairTargetDeg = 0;
    if (this.repairFillGraphics) { this.repairFillGraphics.destroy(); this.repairFillGraphics = null; }
    this.centerImage.setAngle(0);
    this.isTriggerActive = false;
    this.repairWobblePhase = 0;
    this.repairPointerAngVel = 0;
    if (this.repairWobbleTimer) { this.repairWobbleTimer.remove(); this.repairWobbleTimer = null; }
    this.arcProgress = 0;
    this.currentQuantity = 1;
    if (this.arcFillGraphics) { this.arcFillGraphics.destroy(); this.arcFillGraphics = null; }
    if (this.quantityNumeral) { this.quantityNumeral.destroy(); this.quantityNumeral = null; }
    if (this.glowTimer) this.glowTimer.paused = false;
    this.terminalStartAngle = Math.PI / 2;
    this.highlightedSliceIndex = -1;
    this.selectedItem = null;
    this.dragStartSliceIndex = -1;
    this.lastNonCenterSliceIndex = -1;
    this.activePointerId = -1;
    // Clean up glow graphics
    this.sliceGlows.forEach(g => g.destroy());
    this.sliceGlows = [];
    this.updateSliceCount();
    this.redrawDial();
  }

  public showTerminalDial(item: MenuItem, existingQty: number = 0, startAngle: number = Math.PI / 2): void {
    this.terminalItem = item;
    this.terminalStartAngle = startAngle;
    this.isTriggerActive = false;
    // Pre-position the trigger at the slice-centre for the existing quantity:
    //   qty 0 or 1 → arcProgress 0    (trigger at startAngle, beneath finger)
    //   qty 2      → arcProgress 0.4  (1 slice CCW, "10 o'clock relative")
    //   qty 3      → arcProgress 0.8  (2 slices CCW, "8 o'clock relative")
    // Zone centres: qty1→0, qty2→0.4, qty3→0.8  (each slice = π/3, sweep = 5π/6)
    this.arcProgress = existingQty > 1 ? (existingQty - 1) / 2.5 : 0;
    this.currentQuantity = Math.max(0, Math.min(3, Math.round(this.arcProgress * 2.5 + 1)));
    // Arc radius = midpoint between center dead-zone and outer slice ring
    this.arcRadius = (this.centerRadius + this.sliceRadius) / 2;
    this.highlightedSliceIndex = -1;
    this.selectedItem = null;
    // Pause the glow animation; redrawDial will drive updates on pointer moves instead
    if (this.glowTimer) this.glowTimer.paused = true;
    this.updateSliceCount();
    this.redrawDial();
  }

  /** Enable/disable repair-nav mode — bypasses progression locks on all nav sub-levels. */
  public setRepairNavMode(enabled: boolean): void {
    this.repairNavMode = enabled;
  }

  public showRepairDial(item: MenuItem, currentRotationDeg: number, targetRotationDeg: number): void {
    this.repairItem = item;
    this.terminalItem = null; // mutually exclusive with quantity-selector mode
    this.repairItemRotationDeg = currentRotationDeg;
    this.repairTargetDeg = targetRotationDeg;
    this.isTriggerActive = false;
    this.arcRadius = (this.centerRadius + this.sliceRadius) / 2;
    this.highlightedSliceIndex = -1;
    this.selectedItem = null;
    if (this.glowTimer) this.glowTimer.paused = true;
    this.updateSliceCount();
    this.redrawDial();
  }

  private updateSliceCount(): void {
    const displayItems = this.getDisplayItems();
    const itemCount = displayItems.length;
    
    this.sliceCount = Math.max(this.minSlices, Math.min(this.maxSlices, itemCount));
  }

  public destroy(): void {
    // Remove scene-level input listeners registered in setUpInputHandlers().
    // Without this, each new RadialDial stacks another set on top of the old
    // ones, causing double-firing on the second shift.
    this.scene.input.off('pointermove', this.handleMouseMove, this);
    this.scene.input.off('pointerdown', this.handlePointerDown, this);
    this.scene.input.off('pointerup',   this.handlePointerUp,   this);

    this.sliceGraphics.forEach(g => g.destroy());
    this.sliceTexts.forEach(t => t.destroy());
    this.sliceImages.forEach(i => i.destroy());
    this.sliceGlows.forEach(g => g.destroy());
    if (this.arcFillGraphics) { this.arcFillGraphics.destroy(); this.arcFillGraphics = null; }
    if (this.quantityNumeral) { this.quantityNumeral.destroy(); this.quantityNumeral = null; }
    if (this.repairFillGraphics) { this.repairFillGraphics.destroy(); this.repairFillGraphics = null; }
    this.dialFrameGraphic.destroy();
    this.centerGraphic.destroy();
    this.centerImage.destroy();
    this.inputZone.destroy();
    if (this.glowTimer) {
      this.glowTimer.remove();
    }
    if (this.repairWobbleTimer) {
      this.repairWobbleTimer.remove();
      this.repairWobbleTimer = null;
    }
  }
}