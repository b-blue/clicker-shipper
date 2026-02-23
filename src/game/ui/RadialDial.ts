import Phaser from 'phaser';
import { MenuItem, Item } from '../types/GameTypes';
import { Colors } from '../constants/Colors';
import { NavigationController } from '../controllers/NavigationController';
import { normalizeItems } from '../utils/ItemAdapter';

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
  private allowDeepNavigation: boolean = false;
  private readonly lockedNavItemIdPrefix: string = 'locked_';
  private terminalItem: MenuItem | null = null;
  private readonly ACTION_ITEMS: MenuItem[] = [
    { id: 'action:send',    name: 'SEND',    icon: 'skill-send'    },
    { id: 'action:break',   name: 'BREAK',   icon: 'skill-break'   },
    { id: 'action:combine', name: 'COMBINE', icon: 'skill-nodes'   },
    { id: 'action:recall',  name: 'RECALL',  icon: 'skill-blocked' },
  ];

  // Drag-to-confirm properties
  private dragStartSliceIndex: number = -1; // Index of slice where drag started
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private lastPointerX: number = 0;
  private lastPointerY: number = 0;
  private lastNonCenterSliceIndex: number = -1;
  private readonly minDragDistance: number = 20;
  private showDropCue: boolean = false;
  private pointerConsumed: boolean = false; // guard against duplicate pointerup (touch + synthesized mouse)
  private lastTouchEndTime: number = 0;     // timestamp of last real touch-end, used to suppress synthesized mouse events
  private readonly touchSynthesisWindow: number = 500; // ms within which mouse events after a touch are ignored
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
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.handleMouseMove(pointer);
    });

    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handlePointerDown(pointer);
    });

    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.handlePointerUp(pointer);
    });
  }

  private handleMouseMove(pointer: Phaser.Input.Pointer): void {
    this.lastPointerX = pointer.x;
    this.lastPointerY = pointer.y;
    const dx = pointer.x - this.dialX;
    const dy = pointer.y - this.dialY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const dragDx = pointer.x - this.dragStartX;
    const dragDy = pointer.y - this.dragStartY;
    const dragDistance = Math.sqrt(dragDx * dragDx + dragDy * dragDy);

    if (this.dragStartSliceIndex >= 0 && dragDistance >= this.minDragDistance) {
      if (distance < this.centerRadius) {
        this.showDropCue = true;
        if (this.highlightedSliceIndex !== -999) {
          this.highlightedSliceIndex = -999;
          this.redrawDial();
        }
        return;
      }
      this.showDropCue = false;
    }

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
        this.showDropCue = false;
        this.redrawDial();
      }
    }
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    this.lastPointerX = pointer.x;
    this.lastPointerY = pointer.y;
    const dx = pointer.x - this.dialX;
    const dy = pointer.y - this.dialY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Record drag start position and slice
    this.dragStartX = pointer.x;
    this.dragStartY = pointer.y;
    this.dragStartSliceIndex = -1;
    this.lastNonCenterSliceIndex = -1;
    this.showDropCue = false;

    // Suppress synthesized mouse-down events the browser fires ~300ms after a real touch.
    // Without this, the synthesized mousedown resets pointerConsumed and the subsequent
    // mouseup fires a second action on the now-visible terminal dial.
    if (!pointer.wasTouch && (Date.now() - this.lastTouchEndTime) < this.touchSynthesisWindow) {
      return;
    }

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
    // Ignore duplicate pointerup events from the same gesture (e.g. touch + synthesized mouse)
    if (this.pointerConsumed) return;
    this.pointerConsumed = true;

    // Record when a real touch ends so handlePointerDown can suppress the
    // synthesized mouse events the browser fires shortly after.
    if (pointer.wasTouch) {
      this.lastTouchEndTime = Date.now();
    }

    const endX = pointer?.x ?? this.lastPointerX;
    const endY = pointer?.y ?? this.lastPointerY;
    const endDx = endX - this.dialX;
    const endDy = endY - this.dialY;
    const endDistance = Math.sqrt(endDx * endDx + endDy * endDy);
    const dragDx = endX - this.dragStartX;
    const dragDy = endY - this.dragStartY;
    const dragDistance = Math.sqrt(dragDx * dragDx + dragDy * dragDy);

    // Tap scheme: any pointerup that started on a slice confirms it immediately.
    // wasDrag/endDistance are only retained for the center-tap (go back) check.
    const wasDrag = dragDistance >= this.minDragDistance;

    // Tapping or dragging a slice confirms it — no drag-to-center required
    if (this.dragStartSliceIndex >= 0) {
      const confirmedSliceIndex = this.lastNonCenterSliceIndex >= 0 
        ? this.lastNonCenterSliceIndex 
        : this.dragStartSliceIndex;
      
      const displayItems = this.getDisplayItems();
      
      if (confirmedSliceIndex < displayItems.length) {
        const confirmedItem = displayItems[confirmedSliceIndex];

        // Terminal dial: an action (send/break/combine) is being confirmed
        if (this.terminalItem) {
          const action = confirmedItem.id.replace('action:', '');
          const targetItem = this.terminalItem;
          this.terminalItem = null;
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
    } else if (endDistance < this.centerRadius && !wasDrag) {
      // In terminal mode, tapping center goes back to the previous level (B-level)
      if (this.terminalItem) {
        this.terminalItem = null;
        this.highlightedSliceIndex = -1;
        this.selectedItem = null;
        this.dragStartSliceIndex = -1;
        this.showDropCue = false;
        this.lastNonCenterSliceIndex = -1;
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

    // Reset drag state and selection
    this.dragStartSliceIndex = -1;
    this.showDropCue = false;
    this.lastNonCenterSliceIndex = -1;
  }

  private shouldLockNavItem(item: MenuItem): boolean {
    if (this.allowDeepNavigation || this.navigationController.getDepth() < 1) {
      return false;
    }
    if (!item.children || item.children.length === 0) {
      return false;
    }
    return item.icon === 'skill-down' || item.id.includes('_down_');
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
    if (this.allowDeepNavigation || this.navigationController.getDepth() < 1) {
      return items;
    }

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

    const ringColor = this.showDropCue
      ? Colors.HIGHLIGHT_YELLOW
      : this.highlightedSliceIndex === -999 && this.navigationController.getDepth() > 0
        ? Colors.HIGHLIGHT_YELLOW
        : Colors.LIGHT_BLUE;
    const ringAlpha = this.showDropCue ? 1 : 0.7;
    this.centerGraphic.lineStyle(3, ringColor, ringAlpha);
    this.centerGraphic.strokeCircle(this.dialX, this.dialY, this.centerRadius);

    const glowStart = this.glowAngle;
    const glowEnd = glowStart + Math.PI / 3;
    this.centerGraphic.lineStyle(4, Colors.HIGHLIGHT_YELLOW_BRIGHT, this.showDropCue ? 1 : 0.6);
    this.centerGraphic.beginPath();
    this.centerGraphic.arc(this.dialX, this.dialY, this.centerRadius + 2, glowStart, glowEnd);
    this.centerGraphic.strokePath();

    if (this.showDropCue) {
      this.centerGraphic.lineStyle(2, Colors.HIGHLIGHT_YELLOW, 0.6);
      this.centerGraphic.strokeCircle(this.dialX, this.dialY, this.centerRadius + 6);
    }

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
      const color = isHighlighted ? Colors.SLICE_HIGHLIGHTED : Colors.SLICE_NORMAL;
      const alpha = isHighlighted ? 0.9 : 0.8;

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
      const item = displayItems[i];

      // Skip rendering if no item at this slice (fewer items than slices)
      if (!item) {
        continue;
      }

      // Try to display sprite for items; fall back to text
      if ('id' in item) {
        const itemId = item.id;
        const hasLayers = 'layers' in item && item.layers && item.layers.length > 0;
        
        if (hasLayers) {
          // Render multi-layer image
          const baseScale = this.navigationController.getScaleForDepth();
          const baseDepth = 2;
          
          item.layers!.forEach((layer, index) => {
            if (this.scene.textures.exists(layer.texture)) {
              const layerImage = this.scene.add.image(textX, textY, layer.texture);
              layerImage.setScale((layer.scale ?? 1) * baseScale);
              layerImage.setDepth(layer.depth ?? (baseDepth + index));
              
              if (layer.tint !== undefined) {
                layerImage.setTint(layer.tint);
              }
              
              if (layer.alpha !== undefined) {
                layerImage.setAlpha(layer.alpha);
              }
              
              this.sliceImages.push(layerImage);
            }
          });
        } else if ('icon' in item && item.icon) {
          // Use item.icon as texture key (MenuItem format)
          const textureKey = item.icon;
          if (this.scene.textures.exists(textureKey)) {
            const image = this.scene.add.image(textX, textY, textureKey);
            image.setScale(this.navigationController.getScaleForDepth());
            image.setDepth(2);
            this.sliceImages.push(image);
          } else {
            // Icon texture not loaded, fall back to text
            const text = this.scene.add.bitmapText(textX, textY, 'clicker', item.name.toUpperCase(), this.navigationController.getDepth() === 0 ? 12 : 11)
              .setOrigin(0.5, 0.5)
              .setMaxWidth(80)
              .setDepth(0);
            this.sliceTexts.push(text);
          }
        } else if (this.scene.textures.exists(itemId)) {
          // Create single image using itemId (legacy behavior)
          const image = this.scene.add.image(textX, textY, itemId);
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
    this.showDropCue = false;
    this.lastNonCenterSliceIndex = -1;
    // Clean up glow graphics
    this.sliceGlows.forEach(g => g.destroy());
    this.sliceGlows = [];
    this.updateSliceCount();
    this.redrawDial();
  }

  public setDeepNavigationEnabled(enabled: boolean): void {
    this.allowDeepNavigation = enabled;
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