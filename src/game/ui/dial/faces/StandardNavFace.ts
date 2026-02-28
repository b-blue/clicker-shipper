import Phaser from 'phaser';
import { MenuItem } from '../../../types/GameTypes';
import { Colors } from '../../../constants/Colors';
import { NavigationController } from '../../../controllers/NavigationController';
import { AssetLoader } from '../../../managers/AssetLoader';
import { ProgressionManager } from '../../../managers/ProgressionManager';
import { IDialFace } from '../IDialFace';
import { DialContext } from '../DialContext';
import { labelStyle } from '../../../constants/FontStyle';

/**
 * Standard hierarchical navigation face.
 * Renders pie-wedge slices with item icons and handles drill-down/leaf-confirm input.
 * This is the default face used for all nav levels unless a custom sub-dial is registered.
 */
export class StandardNavFace implements IDialFace {
  // ── Navigation ─────────────────────────────────────────────────────────────
  private navigationController: NavigationController;
  private sliceCount: number = 6;
  private readonly minSlices: number = 2;
  private readonly maxSlices: number = 6;
  private readonly lockedNavItemIdPrefix: string = 'locked_';
  repairNavMode: boolean = false;

  // ── Highlight / selection state ────────────────────────────────────────────
  highlightedSliceIndex: number = -1;
  selectedItem: MenuItem | null = null;

  // ── Pointer / gesture state ────────────────────────────────────────────────
  dragStartSliceIndex: number = -1;
  lastNonCenterSliceIndex: number = -1;
  private pointerConsumed: boolean = false;
  public lastTouchEndTime: number = 0;
  private readonly touchSynthesisWindow: number = 500;
  private activePointerId: number = -1;

  // ── Per-frame Phaser objects ──────────────────────────────────────────────
  private sliceGraphics: Phaser.GameObjects.Graphics[] = [];
  private sliceTexts:    Phaser.GameObjects.Text[] = [];
  private sliceImages:   Phaser.GameObjects.Image[] = [];
  private sliceGlows:    Phaser.GameObjects.Graphics[] = [];

  // ── Context reference (set on activate) ───────────────────────────────────
  private ctx: DialContext | null = null;

  constructor(items: MenuItem[], repairNavMode: boolean = false) {
    this.navigationController = new NavigationController(items);
    this.repairNavMode = repairNavMode;
    this.updateSliceCount();
  }

  // ── IDialFace lifecycle ────────────────────────────────────────────────────

  activate(context: DialContext): void {
    this.ctx = context;
    // Reset gesture state every time this face becomes the active one
    this.dragStartSliceIndex = -1;
    this.lastNonCenterSliceIndex = -1;
    this.pointerConsumed = false;
    this.activePointerId = -1;
    this.redraw();
  }

  deactivate(): void {
    // Destroy per-frame slice objects so they don't remain visible when a
    // terminal face is pushed on top.  activate() → redraw() rebuilds them.
    this.clearSliceObjects();
  }

  destroy(): void {
    this.clearSliceObjects();
    this.ctx = null;
  }

  redraw(): void {
    if (!this.ctx) return;
    this.clearSliceObjects();
    const displayItems = this.getDisplayItems();
    const sliceAngle = (Math.PI * 2) / this.sliceCount;
    this.drawDialFrame(sliceAngle);
    this.drawCenterIndicator();
    this.drawAllSlices(displayItems, sliceAngle);
    this.ctx.centerGraphic.setDepth(10);
    this.ctx.centerImage.setDepth(10);
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.ctx) return;
    const { dialX, dialY, sliceRadius, centerRadius } = this.ctx;
    const dx = pointer.x - dialX;
    const dy = pointer.y - dialY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < centerRadius) {
      if (this.highlightedSliceIndex !== -999) {
        this.highlightedSliceIndex = -999;
        this.redraw();
      }
      return;
    }

    if (distance < sliceRadius && distance > centerRadius + 5) {
      const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      const normalizedAngle = (angle + 360) % 360;
      const sliceAngle = 360 / this.sliceCount;
      const sliceIndex = Math.floor(normalizedAngle / sliceAngle);

      if (sliceIndex < this.sliceCount && sliceIndex !== this.highlightedSliceIndex) {
        this.highlightedSliceIndex = sliceIndex;
        this.lastNonCenterSliceIndex = sliceIndex;
        this.updateSelectedItem();
        this.redraw();
      }
    } else {
      if (this.highlightedSliceIndex !== -1 && this.highlightedSliceIndex !== -999) {
        this.highlightedSliceIndex = -1;
        this.selectedItem = null;
        this.redraw();
      }
    }
  }

  onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.ctx) return;
    if (this.activePointerId !== -1 && pointer.pointerId !== this.activePointerId) return;

    const { dialX, dialY, sliceRadius, centerRadius } = this.ctx;
    const dx = pointer.x - dialX;
    const dy = pointer.y - dialY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    this.dragStartSliceIndex = -1;
    this.lastNonCenterSliceIndex = -1;

    const isTouch = pointer.wasTouch || (pointer.event as PointerEvent | undefined)?.pointerType === 'touch';
    if (!isTouch && (Date.now() - this.lastTouchEndTime) < this.touchSynthesisWindow) return;

    this.activePointerId = pointer.pointerId;
    this.pointerConsumed = false;

    if (distance < sliceRadius && distance > centerRadius + 5) {
      const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      const normalizedAngle = (angle + 360) % 360;
      const sliceAngle = 360 / this.sliceCount;
      const sliceIndex = Math.floor(normalizedAngle / sliceAngle);

      if (sliceIndex < this.sliceCount) {
        this.dragStartSliceIndex = sliceIndex;
        this.highlightedSliceIndex = sliceIndex;
        this.lastNonCenterSliceIndex = sliceIndex;
        this.updateSelectedItem();
        this.redraw();
      }
    }
  }

  onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.ctx) return;
    if (this.activePointerId !== -1 && pointer.pointerId !== this.activePointerId) return;
    if (this.pointerConsumed) return;
    this.pointerConsumed = true;
    this.activePointerId = -1;

    const isTouch = pointer.wasTouch || (pointer.event as PointerEvent | undefined)?.pointerType === 'touch';
    if (isTouch) this.lastTouchEndTime = Date.now();

    const { dialX, dialY, centerRadius } = this.ctx;
    const endDx = pointer.x - dialX;
    const endDy = pointer.y - dialY;
    const endDistance = Math.sqrt(endDx * endDx + endDy * endDy);

    if (this.dragStartSliceIndex >= 0) {
      const confirmedIndex = this.lastNonCenterSliceIndex;
      const displayItems = this.getDisplayItems();

      if (confirmedIndex < displayItems.length) {
        const confirmedItem = displayItems[confirmedIndex];

        if (!this.repairNavMode && this.isLockedNavItem(confirmedItem)) {
          this.selectedItem = null;
          this.highlightedSliceIndex = -1;
          this.redraw();
          return;
        }

        if (this.navigationController.isNavigable(confirmedItem)) {
          this.navigationController.drillDown(confirmedItem);
          this.updateSliceCount();
          this.highlightedSliceIndex = -1;
          this.selectedItem = null;
          this.redraw();
          this.ctx.emit({
            type: 'drillDown',
            item: confirmedItem,
          });
        } else {
          const sliceRad = (2 * Math.PI) / this.sliceCount;
          const sliceCenterAngle = -Math.PI / 2 + (confirmedIndex + 0.5) * sliceRad;
          this.selectedItem = null;
          this.highlightedSliceIndex = -1;
          this.redraw();
          this.ctx.emit({
            type: 'itemConfirmed',
            item: confirmedItem,
            sliceCenterAngle,
          });
        }
      }
    } else if (endDistance < centerRadius) {
      if (this.navigationController.canGoBack()) {
        this.navigationController.goBack();
        this.updateSliceCount();
        this.highlightedSliceIndex = -1;
        this.selectedItem = null;
        this.redraw();
        this.ctx.emit({ type: 'goBack' });
      }
    }

    this.dragStartSliceIndex = -1;
    this.lastNonCenterSliceIndex = -1;
  }

  // ── Public navigation helpers (used by RadialDial coordinator) ─────────────

  getDepth(): number { return this.navigationController.getDepth(); }
  getPath(): string[] { return this.navigationController.getPath(); }
  canGoBack(): boolean { return this.navigationController.canGoBack(); }

  reset(): void {
    this.navigationController.reset();
    this.highlightedSliceIndex = -1;
    this.selectedItem = null;
    this.dragStartSliceIndex = -1;
    this.lastNonCenterSliceIndex = -1;
    this.activePointerId = -1;
    this.updateSliceCount();
  }

  // ── Navigation / locking helpers ───────────────────────────────────────────

  private shouldLockNavItem(item: MenuItem): boolean {
    if (this.navigationController.getDepth() < 1) return false;
    const match = item.id.match(/^nav_(.+)_down_(\d+)$/);
    if (!match) return false;
    const categoryId = `nav_${match[1]}_root`;
    const levelN = parseInt(match[2], 10);
    return levelN >= ProgressionManager.getInstance().getUnlockedDepth(categoryId);
  }

  private createLockedNavItem(item: MenuItem): MenuItem {
    return {
      id: `${this.lockedNavItemIdPrefix}${item.id}`,
      name: 'LOCKED',
      icon: 'skill-blocked',
      layers: [
        { texture: 'skill-blocked', depth: 3 },
        { texture: 'frame', depth: 2 },
      ],
    };
  }

  private isLockedNavItem(item: MenuItem): boolean {
    return item.id.startsWith(this.lockedNavItemIdPrefix);
  }

  getDisplayItems(): MenuItem[] {
    const items = this.navigationController.getCurrentItems();
    if (this.repairNavMode) return items;
    if (this.navigationController.getDepth() < 1) return items;
    return items.map(item => this.shouldLockNavItem(item) ? this.createLockedNavItem(item) : item);
  }

  private updateSliceCount(): void {
    const displayItems = this.getDisplayItems();
    this.sliceCount = Math.max(this.minSlices, Math.min(this.maxSlices, displayItems.length));
  }

  private updateSelectedItem(): void {
    const displayItems = this.getDisplayItems();
    if (this.highlightedSliceIndex >= 0 && this.highlightedSliceIndex < displayItems.length) {
      this.selectedItem = displayItems[this.highlightedSliceIndex];
    }
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  private clearSliceObjects(): void {
    this.sliceGraphics.forEach(g => g.destroy());
    this.sliceTexts.forEach(t => t.destroy());
    this.sliceImages.forEach(i => i.destroy());
    this.sliceGlows.forEach(g => g.destroy());
    this.sliceGraphics = [];
    this.sliceTexts    = [];
    this.sliceImages   = [];
    this.sliceGlows    = [];
  }

  private drawDialFrame(sliceAngle: number): void {
    const { dialX, dialY, sliceRadius, dialFrameGraphic } = this.ctx!;
    dialFrameGraphic.clear();
    const frameRadius = sliceRadius + 10;
    dialFrameGraphic.fillStyle(Colors.PANEL_DARK, 0.65);
    dialFrameGraphic.fillCircle(dialX, dialY, frameRadius);
    dialFrameGraphic.lineStyle(2, Colors.BORDER_BLUE, 1.0);
    dialFrameGraphic.strokeCircle(dialX, dialY, frameRadius);
    dialFrameGraphic.lineStyle(1, Colors.BORDER_BLUE, 0.7);
    dialFrameGraphic.strokeCircle(dialX, dialY, sliceRadius * 0.6);
    dialFrameGraphic.beginPath();
    for (let i = 0; i < this.sliceCount; i++) {
      const angle = i * sliceAngle - Math.PI / 2;
      const inner = this.ctx!.centerRadius + 6;
      const outer = sliceRadius + 8;
      dialFrameGraphic.moveTo(dialX + Math.cos(angle) * inner, dialY + Math.sin(angle) * inner);
      dialFrameGraphic.lineTo(dialX + Math.cos(angle) * outer, dialY + Math.sin(angle) * outer);
    }
    dialFrameGraphic.strokePath();
  }

  private drawCenterIndicator(): void {
    if (!this.ctx) return;
    const { dialX, dialY, centerRadius, centerGraphic, centerImage, glowAngle } = this.ctx;
    centerGraphic.clear();
    centerGraphic.fillStyle(Colors.PANEL_DARK, 0.35);
    centerGraphic.fillCircle(dialX, dialY, centerRadius - 2);

    const ringColor = this.highlightedSliceIndex === -999 && this.navigationController.getDepth() > 0
      ? Colors.HIGHLIGHT_YELLOW : Colors.LIGHT_BLUE;
    centerGraphic.lineStyle(3, ringColor, 0.7);
    centerGraphic.strokeCircle(dialX, dialY, centerRadius);

    centerGraphic.lineStyle(4, Colors.HIGHLIGHT_YELLOW_BRIGHT, 0.6);
    centerGraphic.beginPath();
    centerGraphic.arc(dialX, dialY, centerRadius + 2, glowAngle, glowAngle + Math.PI / 3);
    centerGraphic.strokePath();

    const centerDisplayItem = this.selectedItem;
    if (centerDisplayItem) {
      const textureKey = (centerDisplayItem as any).icon || (centerDisplayItem as any).id;
      if (AssetLoader.textureExists(this.ctx.scene, textureKey)) {
        this.setCenterTexture(textureKey);
        centerImage.setPosition(dialX, dialY);
        centerImage.setVisible(true);
      } else {
        centerImage.setVisible(false);
      }
    } else {
      const defaultKey = this.navigationController.getDepth() > 0 ? 'skill-up' : 'skill-diagram';
      if (AssetLoader.textureExists(this.ctx.scene, defaultKey)) {
        this.setCenterTexture(defaultKey);
        centerImage.setPosition(dialX, dialY);
        centerImage.setVisible(true);
      } else {
        centerImage.setVisible(false);
      }
    }
  }

  private setCenterTexture(iconKey: string): void {
    const atlasKey = AssetLoader.getAtlasKey(iconKey);
    if (atlasKey) {
      this.ctx!.centerImage.setTexture(atlasKey, iconKey);
    } else {
      this.ctx!.centerImage.setTexture(iconKey);
    }
  }

  private drawAllSlices(displayItems: MenuItem[], sliceAngle: number): void {
    if (!this.ctx) return;
    const { scene, dialX, dialY, sliceRadius } = this.ctx;
    const scale = this.navigationController.getScaleForDepth();

    for (let i = 0; i < this.sliceCount; i++) {
      const startAngle  = i * sliceAngle - Math.PI / 2;
      const endAngle    = startAngle + sliceAngle;
      const isHighlighted = i === this.highlightedSliceIndex;
      const sliceItem   = displayItems[i];
      const isLockedItem = sliceItem ? this.isLockedNavItem(sliceItem) : false;
      const isALevelLocked = isLockedItem && this.navigationController.getDepth() === 0;
      const color = isHighlighted ? Colors.SLICE_HIGHLIGHTED : (isALevelLocked ? 0x11111a : Colors.SLICE_NORMAL);
      const alpha = isHighlighted ? 0.9 : (isALevelLocked ? 0.5 : 0.8);

      // Neon glow behind highlighted slice
      if (isHighlighted) {
        const glowGraphics = scene.add.graphics();
        for (let g = 0; g < 8; g++) {
          const radius  = sliceRadius + 8 + (g * 3);
          const opacity = Math.pow(1 - (g / 8), 3) * 0.15;
          glowGraphics.fillStyle(Colors.NEON_BLUE, opacity);
          glowGraphics.beginPath();
          glowGraphics.moveTo(dialX, dialY);
          glowGraphics.lineTo(dialX + Math.cos(startAngle) * radius, dialY + Math.sin(startAngle) * radius);
          glowGraphics.arc(dialX, dialY, radius, startAngle, endAngle);
          glowGraphics.lineTo(dialX, dialY);
          glowGraphics.closePath();
          glowGraphics.fillPath();
        }
        glowGraphics.setDepth(0.25);
        this.sliceGlows.push(glowGraphics);
      }

      // Pie wedge
      const graphics = scene.add.graphics();
      graphics.fillStyle(color, alpha);
      graphics.beginPath();
      graphics.moveTo(dialX, dialY);
      graphics.lineTo(dialX + Math.cos(startAngle) * sliceRadius, dialY + Math.sin(startAngle) * sliceRadius);
      graphics.arc(dialX, dialY, sliceRadius, startAngle, endAngle);
      graphics.lineTo(dialX, dialY);
      graphics.closePath();
      graphics.fillPath();
      graphics.lineStyle(1, Colors.NEON_BLUE, 0.35);
      graphics.beginPath();
      graphics.moveTo(dialX, dialY);
      graphics.lineTo(dialX + Math.cos(startAngle) * sliceRadius, dialY + Math.sin(startAngle) * sliceRadius);
      graphics.arc(dialX, dialY, sliceRadius, startAngle, endAngle);
      graphics.lineTo(dialX, dialY);
      graphics.closePath();
      graphics.strokePath();
      graphics.setDepth(0);
      this.sliceGraphics.push(graphics);

      if (!sliceItem) continue;

      const midAngle  = startAngle + sliceAngle / 2;
      const textX     = dialX + Math.cos(midAngle) * (sliceRadius - 40);
      const textY     = dialY + Math.sin(midAngle) * (sliceRadius - 40);
      const lockedAlpha = isLockedItem ? 0.35 : 1;

      if ('id' in sliceItem) {
        const hasLayers = sliceItem.layers && sliceItem.layers.length > 0;
        if (hasLayers) {
          sliceItem.layers!.forEach((layer, index) => {
            if (AssetLoader.textureExists(scene, layer.texture)) {
              const img = AssetLoader.createImage(scene, textX, textY, layer.texture);
              img.setScale((layer.scale ?? 1) * scale);
              img.setDepth(layer.depth ?? (2 + index));
              img.setAlpha(layer.alpha ?? lockedAlpha);
              if (layer.tint !== undefined) img.setTint(layer.tint);
              this.sliceImages.push(img);
            }
          });
        } else if (sliceItem.icon && AssetLoader.textureExists(scene, sliceItem.icon)) {
          const img = AssetLoader.createImage(scene, textX, textY, sliceItem.icon);
          img.setScale(scale);
          img.setDepth(2);
          img.setAlpha(lockedAlpha);
          this.sliceImages.push(img);
        } else if (AssetLoader.textureExists(scene, sliceItem.id)) {
          const img = AssetLoader.createImage(scene, textX, textY, sliceItem.id);
          img.setScale(scale);
          img.setDepth(2);
          this.sliceImages.push(img);
        } else {
          const fontSize = this.navigationController.getDepth() === 0 ? 12 : 11;
          const text = scene.add.text(textX, textY, sliceItem.name.toUpperCase(), labelStyle(fontSize))
            .setOrigin(0.5, 0.5).setWordWrapWidth(80).setDepth(0);
          this.sliceTexts.push(text);
        }
      } else {
        const text = scene.add.text(textX, textY, (sliceItem as any).name.toUpperCase(), labelStyle(12))
          .setOrigin(0.5, 0.5).setWordWrapWidth(80).setDepth(0);
        this.sliceTexts.push(text);
        if (this.navigationController.isNavigable(sliceItem)) {
          const badge = scene.add.text(textX + 20, textY - 20, '>', labelStyle(16))
            .setOrigin(0.5, 0.5).setDepth(5);
          this.sliceTexts.push(badge);
        }
      }
    }
  }
}
