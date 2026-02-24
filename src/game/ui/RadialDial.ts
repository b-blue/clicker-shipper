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
  private readonly ACTION_ITEMS: MenuItem[] = [
    { id: 'action:send',    name: 'SEND',    icon: 'skill-send'    },
    { id: 'action:break',   name: 'BREAK',   icon: 'skill-break'   },
    { id: 'action:combine', name: 'COMBINE', icon: 'skill-nodes'   },
    { id: 'action:recall',  name: 'RECALL',  icon: 'skill-blocked' },
  ];

  // Tap-to-confirm properties
  private dragStartSliceIndex: number = -1; // Index of slice where tap started
  private lastPointerX: number = 0;
  private lastPointerY: number = 0;
  private lastNonCenterSliceIndex: number = -1;
  private pointerConsumed: boolean = false; // guard against duplicate pointerup (touch + synthesized mouse)
  private lastTouchEndTime: number = 0;     // timestamp of last real touch-end, used to suppress synthesized mouse events
  private readonly touchSynthesisWindow: number = 500; // ms within which mouse events after a touch are ignored
  private lastActionTime: number = 0;       // timestamp of last confirmed terminal action, used to debounce rapid double-sends
  private readonly actionDebounceWindow: number = 150; // ms to block a rapid double-tap on the terminal dial
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
    this.centerImage = scene.add.image(x, y, '').setScale(1.2).setOrigin(0.5);
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
    this.lastPointerX = pointer.x;
    this.lastPointerY = pointer.y;
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
    if (distance < this.sliceRadius + 50 && distance > this.centerRadius + 5) {
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

    this.lastPointerX = pointer.x;
    this.lastPointerY = pointer.y;
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

    // Check if started on a slice
    if (distance < this.sliceRadius + 50 && distance > this.centerRadius + 5) {
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

    // Tap scheme: any pointerup that started on a slice confirms it immediately
    if (this.dragStartSliceIndex >= 0) {
      const confirmedSliceIndex = this.lastNonCenterSliceIndex;
      
      const displayItems = this.getDisplayItems();
      
      if (confirmedSliceIndex < displayItems.length) {
        const confirmedItem = displayItems[confirmedSliceIndex];

        // Terminal dial: an action (send/break/combine) is being confirmed
        if (this.terminalItem) {
          // Debounce: ignore rapid double-taps within the action window
          if (Date.now() - this.lastActionTime < this.actionDebounceWindow) {
            this.dragStartSliceIndex = -1;
            this.lastNonCenterSliceIndex = -1;
            return;
          }
          const action = confirmedItem.id.replace('action:', '');
          const targetItem = this.terminalItem;
          this.terminalItem = null;
          this.lastActionTime = Date.now();
          this.dragStartSliceIndex = -1;
          this.lastNonCenterSliceIndex = -1;
          this.scene.events.emit('dial:actionConfirmed', { action, item: targetItem });
          this.reset(); // Returns dial to level A
          return;
        }

        if (this.isLockedNavItem(confirmedItem)) {
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
          // Confirm leaf item selection
          this.scene.events.emit('dial:itemConfirmed', { item: confirmedItem });
          this.selectedItem = null;
          this.highlightedSliceIndex = -1;
          this.redrawDial();
        }
      }
    } else if (endDistance < this.centerRadius) {
      // In terminal mode, tapping center goes back to the previous level (B-level)
      if (this.terminalItem) {
        this.terminalItem = null;
        this.highlightedSliceIndex = -1;
        this.selectedItem = null;
        this.updateSliceCount();
        this.redrawDial();
        this.scene.events.emit('dial:goBack');
        return;
      }
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
    if (this.terminalItem) {
      return this.ACTION_ITEMS;
    }
    const items = this.navigationController.getCurrentItems();
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

  private redrawDial(): void {
    // Clear previous graphics and texts
    this.sliceGraphics.forEach(g => g.destroy());
    this.sliceTexts.forEach(t => t.destroy());
    this.sliceImages.forEach(i => i.destroy());
    this.sliceGlows.forEach(g => g.destroy());
    this.sliceGraphics = [];
    this.sliceTexts = [];
    this.sliceImages = [];
    this.sliceGlows = [];

    this.dialFrameGraphic.clear();

    const displayItems = this.getDisplayItems();
    const sliceAngle = (Math.PI * 2) / this.sliceCount;

    // Draw glassy HUD frame
    const frameRadius = this.sliceRadius + 10;
    this.dialFrameGraphic.fillStyle(Colors.PANEL_DARK, 0.65);
    this.dialFrameGraphic.fillCircle(this.dialX, this.dialY, frameRadius);
    this.dialFrameGraphic.lineStyle(2, Colors.BORDER_BLUE, 1.0);
    this.dialFrameGraphic.strokeCircle(this.dialX, this.dialY, frameRadius);
    this.dialFrameGraphic.lineStyle(1, Colors.BORDER_BLUE, 0.7);
    this.dialFrameGraphic.strokeCircle(this.dialX, this.dialY, this.sliceRadius * 0.6);
    this.dialFrameGraphic.beginPath();
    for (let i = 0; i < this.sliceCount; i++) {
      const angle = i * sliceAngle - Math.PI / 2;
      const inner = this.centerRadius + 6;
      const outer = this.sliceRadius + 8;
      this.dialFrameGraphic.moveTo(
        this.dialX + Math.cos(angle) * inner,
        this.dialY + Math.sin(angle) * inner
      );
      this.dialFrameGraphic.lineTo(
        this.dialX + Math.cos(angle) * outer,
        this.dialY + Math.sin(angle) * outer
      );
    }
    this.dialFrameGraphic.strokePath();

    // Draw center ring
    this.centerGraphic.clear();

    this.centerGraphic.fillStyle(Colors.PANEL_DARK, 0.35);
    this.centerGraphic.fillCircle(this.dialX, this.dialY, this.centerRadius - 2);

    const ringColor = this.highlightedSliceIndex === -999 && this.navigationController.getDepth() > 0
      ? Colors.HIGHLIGHT_YELLOW
      : Colors.LIGHT_BLUE;
    this.centerGraphic.lineStyle(3, ringColor, 0.7);
    this.centerGraphic.strokeCircle(this.dialX, this.dialY, this.centerRadius);

    const glowStart = this.glowAngle;
    const glowEnd = glowStart + Math.PI / 3;
    this.centerGraphic.lineStyle(4, Colors.HIGHLIGHT_YELLOW_BRIGHT, 0.6);
    this.centerGraphic.beginPath();
    this.centerGraphic.arc(this.dialX, this.dialY, this.centerRadius + 2, glowStart, glowEnd);
    this.centerGraphic.strokePath();

    // Update center display — selected item (hover/drag) takes priority, else default icon
    const centerDisplayItem = this.selectedItem;
    if (centerDisplayItem) {
      const item = centerDisplayItem as any;
      const textureKey = item.icon || item.id;
      if (this.scene.textures.exists(textureKey)) {
        this.centerImage.setTexture(textureKey);
        this.centerImage.setPosition(this.dialX, this.dialY);
        this.centerImage.setVisible(true);
      } else {
        this.centerImage.setVisible(false);
      }
    } else {
      const defaultKey = (this.terminalItem || this.navigationController.getDepth() > 0) ? 'skill-up' : 'skill-diagram';
      if (this.scene.textures.exists(defaultKey)) {
        this.centerImage.setTexture(defaultKey);
        this.centerImage.setPosition(this.dialX, this.dialY);
        this.centerImage.setVisible(true);
      } else if (this.scene.textures.exists('rootDialIcon')) {
        this.centerImage.setTexture('rootDialIcon');
        this.centerImage.setPosition(this.dialX, this.dialY);
        this.centerImage.setVisible(true);
      } else {
        this.centerImage.setVisible(false);
      }
    }

    // Draw slices
    for (let i = 0; i < this.sliceCount; i++) {
      const startAngle = i * sliceAngle - Math.PI / 2;
      const endAngle = startAngle + sliceAngle;
      const isHighlighted = i === this.highlightedSliceIndex;
      const sliceItem = displayItems[i];
      const isLockedItem = sliceItem ? this.isLockedNavItem(sliceItem) : false;
      // A-level locked placeholders get a darkened slice; sub-level locked nav gets normal slice
      const isALevelLocked = isLockedItem && this.navigationController.getDepth() === 0;
      const color = isHighlighted ? Colors.SLICE_HIGHLIGHTED : (isALevelLocked ? 0x11111a : Colors.SLICE_NORMAL);
      const alpha = isHighlighted ? 0.9 : (isALevelLocked ? 0.5 : 0.8);

      // Draw glow for highlighted slice with exponential falloff
      if (isHighlighted) {
        const glowGraphics = this.scene.add.graphics();
        // Create neon glow at slice edges that fades rapidly inward
        // Multiple layers with exponential opacity to create hot edge effect
        for (let i = 0; i < 8; i++) {
          const radius = this.sliceRadius + 8 + (i * 3);
          const opacity = Math.pow(1 - (i / 8), 3) * 0.15; // Rapid exponential falloff
          glowGraphics.fillStyle(Colors.NEON_BLUE, opacity);
          glowGraphics.beginPath();
          glowGraphics.moveTo(this.dialX, this.dialY);
          glowGraphics.lineTo(
            this.dialX + Math.cos(startAngle) * radius,
            this.dialY + Math.sin(startAngle) * radius
          );
          glowGraphics.arc(this.dialX, this.dialY, radius, startAngle, endAngle);
          glowGraphics.lineTo(this.dialX, this.dialY);
          glowGraphics.closePath();
          glowGraphics.fillPath();
        }
        glowGraphics.setDepth(0.25);
        this.sliceGlows.push(glowGraphics);
      }

      // Draw slice
      const graphics = this.scene.add.graphics();
      graphics.fillStyle(color, alpha);
      graphics.beginPath();
      graphics.moveTo(this.dialX, this.dialY);
      graphics.lineTo(
        this.dialX + Math.cos(startAngle) * this.sliceRadius,
        this.dialY + Math.sin(startAngle) * this.sliceRadius
      );
      graphics.arc(this.dialX, this.dialY, this.sliceRadius, startAngle, endAngle);
      graphics.lineTo(this.dialX, this.dialY);
      graphics.closePath();
      graphics.fillPath();
      graphics.lineStyle(1, Colors.NEON_BLUE, 0.35);
      graphics.beginPath();
      graphics.moveTo(this.dialX, this.dialY);
      graphics.lineTo(
        this.dialX + Math.cos(startAngle) * this.sliceRadius,
        this.dialY + Math.sin(startAngle) * this.sliceRadius
      );
      graphics.arc(this.dialX, this.dialY, this.sliceRadius, startAngle, endAngle);
      graphics.lineTo(this.dialX, this.dialY);
      graphics.closePath();
      graphics.strokePath();
      graphics.setDepth(0);

      this.sliceGraphics.push(graphics);

      // Draw icon/text for each item
      const midAngle = startAngle + sliceAngle / 2;
      const textDistance = this.sliceRadius - 40;
      const textX = this.dialX + Math.cos(midAngle) * textDistance;
      const textY = this.dialY + Math.sin(midAngle) * textDistance;
      const item = sliceItem;

      // Skip rendering if no item at this slice (fewer items than slices)
      if (!item) {
        continue;
      }

      // Try to display sprite for items; fall back to text
      if ('id' in item) {
        const itemId = item.id;
        const hasLayers = 'layers' in item && item.layers && item.layers.length > 0;
        // Locked items render at reduced alpha so they look inactive
        const lockedAlpha = isLockedItem ? 0.35 : 1;
        
        if (hasLayers) {
          // Render multi-layer image
          const baseScale = this.navigationController.getScaleForDepth();
          const baseDepth = 2;
          
          item.layers!.forEach((layer, index) => {
            if (AssetLoader.textureExists(this.scene, layer.texture)) {
              const layerImage = AssetLoader.createImage(this.scene, textX, textY, layer.texture);
              layerImage.setScale((layer.scale ?? 1) * baseScale);
              layerImage.setDepth(layer.depth ?? (baseDepth + index));
              layerImage.setAlpha(layer.alpha ?? lockedAlpha);
              
              if (layer.tint !== undefined) {
                layerImage.setTint(layer.tint);
              }
              
              this.sliceImages.push(layerImage);
            }
          });
        } else if ('icon' in item && item.icon) {
          // Use item.icon as texture key (MenuItem format)
          const textureKey = item.icon;
          if (AssetLoader.textureExists(this.scene, textureKey)) {
            const image = AssetLoader.createImage(this.scene, textX, textY, textureKey);
            image.setScale(this.navigationController.getScaleForDepth());
            image.setDepth(2);
            image.setAlpha(lockedAlpha);
            this.sliceImages.push(image);
          } else {
            // Icon texture not loaded, fall back to text
            const text = this.scene.add.bitmapText(textX, textY, 'clicker', item.name.toUpperCase(), this.navigationController.getDepth() === 0 ? 12 : 11)
              .setOrigin(0.5, 0.5)
              .setMaxWidth(80)
              .setDepth(0);
            this.sliceTexts.push(text);
          }
        } else if (AssetLoader.textureExists(this.scene, itemId)) {
          // Create single image using itemId (legacy behavior)
          const image = AssetLoader.createImage(this.scene, textX, textY, itemId);
          image.setScale(this.navigationController.getScaleForDepth());
          image.setDepth(2);
          this.sliceImages.push(image);
        } else {
          // Texture doesn't exist, fall back to text
          const text = this.scene.add.bitmapText(textX, textY, 'clicker', item.name.toUpperCase(), this.navigationController.getDepth() === 0 ? 12 : 11)
            .setOrigin(0.5, 0.5)
            .setMaxWidth(80)
            .setDepth(0);
          this.sliceTexts.push(text);
        }
      } else {
        // No id property, fall back to text
        const text = this.scene.add.bitmapText(textX, textY, 'clicker', (item as any).name.toUpperCase(), 12)
          .setOrigin(0.5, 0.5)
          .setMaxWidth(80)
          .setDepth(0);
        this.sliceTexts.push(text);

        // Add corner badge indicator for navigable items
        if (this.navigationController.isNavigable(item)) {
          const badgeX = textX + 20;
          const badgeY = textY - 20;
          const badgeText = this.scene.add.bitmapText(badgeX, badgeY, 'clicker', '>', 16);
          badgeText.setOrigin(0.5, 0.5);
          badgeText.setDepth(5);
          this.sliceTexts.push(badgeText);
        }
      }
    }

    // Ensure center graphics and image are on top
    this.centerGraphic.setDepth(10);
    this.centerImage.setDepth(10);
  }

  public reset(): void {
    this.navigationController.reset();
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

  public showTerminalDial(item: MenuItem): void {
    this.terminalItem = item;
    this.highlightedSliceIndex = -1;
    this.selectedItem = null;
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
    this.dialFrameGraphic.destroy();
    this.centerGraphic.destroy();
    this.centerImage.destroy();
    this.inputZone.destroy();
    if (this.glowTimer) {
      this.glowTimer.remove();
    }
  }
}