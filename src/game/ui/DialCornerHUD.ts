import Phaser from 'phaser';
import { AssetLoader } from '../managers/AssetLoader';
import { Colors, toColorString } from '../constants/Colors';
import { labelStyle } from '../constants/FontStyle';
import { SettingsManager } from '../managers/SettingsManager';

export interface CornerHudCallbacks {
  /** Switches to the catalog tab, pre-scrolled to `categoryId`. */
  openCatalog: (categoryId: string) => void;
  /** Returns to the orders tab. */
  closeCatalog: () => void;
  /** Returns the player to the main menu scene. */
  openMenu: () => void;
  /** Called when the recycle (replace) button is tapped while active. */
  onReplaceRequested?: () => void;
}

/**
 * Four persistent corner buttons anchored to the dial's bounding square.
 *
 * Upper-primary  — Recycle:   skill-recycle; visible always, active when ≥1 item
 *                              needs replacement.  Fires onReplaceRequested.
 * Lower-primary  — Catalog:   skill-brain;   active at B-level non-terminal.
 * Upper-secondary — Level badge: depth letter + category icon; always visible.
 * Lower-secondary — Menu:     skill-question; always clickable.
 *
 * "Primary" column = right edge (right-handed) or left edge (left-handed).
 * "Secondary" column = opposite side.
 */
export class DialCornerHUD {
  private readonly scene: Phaser.Scene;
  private readonly callbacks: CornerHudCallbacks;

  // Navigation state
  private currentDepth: number = 0;
  private isTerminal: boolean = false;
  private activeCategoryItem: any = null;
  private catalogOpen: boolean = false;
  /** Number of repair items currently in a failed/requires-replace state. */
  private failedItemCount: number = 0;

  // Cached geometry
  private readonly btnX: number;      // primary column X  (recycle + catalog)
  private readonly menuBtnX: number;  // secondary column X (level badge + menu)
  private readonly upperY: number;
  private readonly lowerY: number;
  private readonly btnSize: number = 40;

  // Recycle button (upper-primary) — active when failedItemCount > 0
  private readonly recycleBg:   Phaser.GameObjects.Graphics;
  private readonly recycleIcon: Phaser.GameObjects.Image;

  // Catalog button (lower-primary)
  private readonly catalogBg:   Phaser.GameObjects.Graphics;
  private readonly catalogIcon: Phaser.GameObjects.Image;

  // Level badge (upper-secondary)
  private readonly levelBg:    Phaser.GameObjects.Graphics;
  private readonly levelIcon:  Phaser.GameObjects.Image;
  private readonly levelLabel: Phaser.GameObjects.Text;

  // Menu button (lower-secondary)
  private readonly menuBg:   Phaser.GameObjects.Graphics;
  private readonly menuIcon: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    dialX: number,
    dialY: number,
    dialRadius: number,
    callbacks: CornerHudCallbacks,
  ) {
    this.scene = scene;
    this.callbacks = callbacks;

    const margin = 6;
    const half = this.btnSize / 2;
    const leftHanded = SettingsManager.getInstance().getHandedness() === 'left';
    // Right-handed: primary buttons (catalog + level) on dialX right edge;
    //               menu + alt-term on the left edge — natural for right thumb reach.
    // Left-handed:  swap so primary buttons sit on the left edge of the dial.
    const primaryX    = leftHanded
      ? dialX - dialRadius + half + margin
      : dialX + dialRadius - half - margin;
    const secondaryX  = leftHanded
      ? dialX + dialRadius - half - margin
      : dialX - dialRadius + half + margin;
    this.btnX     = primaryX;
    this.menuBtnX = secondaryX;
    this.upperY   = dialY - dialRadius + half + margin;
    this.lowerY   = dialY + dialRadius - half - margin;

    const { btnX, menuBtnX, upperY, lowerY, btnSize } = this;

    // ── Recycle button (upper-primary) ───────────────────────────────────
    this.recycleBg   = scene.add.graphics().setDepth(20);
    this.recycleIcon = AssetLoader.createImage(scene, btnX, upperY, 'skill-recycle')
      .setScale(0.85).setDepth(21);

    this.recycleBg.setInteractive(
      new Phaser.Geom.Circle(btnX, upperY, half),
      Phaser.Geom.Circle.Contains,
    );
    this.recycleBg.on('pointerdown', () => this.onRecycleTap());
    this.recycleBg.on('pointerover', () => this.drawRecycleBtn(true));
    this.recycleBg.on('pointerout',  () => this.drawRecycleBtn(false));

    // ── Catalog button (lower-primary) ───────────────────────────────────
    this.catalogBg   = scene.add.graphics().setDepth(20);
    this.catalogIcon = AssetLoader.createImage(scene, btnX, lowerY, 'skill-brain')
      .setScale(0.85).setDepth(21);

    this.catalogBg.setInteractive(
      new Phaser.Geom.Circle(btnX, lowerY, half),
      Phaser.Geom.Circle.Contains,
    );
    this.catalogBg.on('pointerdown', () => this.onCatalogTap());
    this.catalogBg.on('pointerover', () => this.drawCatalogBtn(this.isCatalogActive(), true));
    this.catalogBg.on('pointerout',  () => this.drawCatalogBtn(this.isCatalogActive(), false));

    // ── Level badge (upper-secondary) ───────────────────────────────────
    this.levelBg    = scene.add.graphics().setDepth(20);
    this.levelIcon  = scene.add.image(menuBtnX, upperY, '').setScale(0.9).setDepth(22);
    this.levelLabel = scene.add
      .text(menuBtnX + btnSize / 2 - 7, upperY - btnSize / 2 + 7, 'A', labelStyle(10))
      .setOrigin(0.5)
      .setDepth(23);

    // ── Menu button (lower-secondary) ───────────────────────────────────
    this.menuBg   = scene.add.graphics().setDepth(20);
    this.menuIcon = AssetLoader.createImage(scene, menuBtnX, lowerY, 'skill-question')
      .setScale(0.85).setDepth(21);

    this.menuBg.setInteractive(
      new Phaser.Geom.Circle(menuBtnX, lowerY, half),
      Phaser.Geom.Circle.Contains,
    );
    this.menuBg.on('pointerdown', () => this.callbacks.openMenu());
    this.menuBg.on('pointerover', () => this.drawMenuBtn(true));
    this.menuBg.on('pointerout',  () => this.drawMenuBtn(false));

    this.redraw();
  }

  // ── Public state updaters (called from Game scene events) ────────────────

  onLevelChanged(depth: number, item: any): void {
    this.currentDepth = depth;
    this.isTerminal = false;
    if (depth === 1) this.activeCategoryItem = item;
    this.redraw();
  }

  onItemConfirmed(): void {
    this.isTerminal = true;
    this.redraw();
  }

  onQuantityConfirmed(): void {
    this.currentDepth = 0;
    this.isTerminal = false;
    this.activeCategoryItem = null;
    this.catalogOpen = false;
    this.redraw();
  }

  onGoBack(): void {
    if (this.isTerminal) {
      this.isTerminal = false;
    } else {
      this.currentDepth = Math.max(0, this.currentDepth - 1);
      if (this.currentDepth === 0) this.activeCategoryItem = null;
    }
    this.redraw();
  }

  /** Update the count of items that currently need replacement; redraws recycle btn. */
  onFailedItemCountChanged(count: number): void {
    this.failedItemCount = count;
    this.redraw();
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private isCatalogActive(): boolean {
    return this.currentDepth >= 1 && !this.isTerminal;
  }

  private isRecycleActive(): boolean {
    return this.failedItemCount > 0;
  }

  private onRecycleTap(): void {
    if (!this.isRecycleActive()) return;
    this.callbacks.onReplaceRequested?.();
  }

  private onCatalogTap(): void {
    if (!this.isCatalogActive()) return;
    if (this.catalogOpen) {
      this.catalogOpen = false;
      this.redraw();
      this.callbacks.closeCatalog();
    } else {
      this.catalogOpen = true;
      this.redraw();
      this.callbacks.openCatalog(this.activeCategoryItem?.id ?? '');
    }
  }

  /** Redraws all corner buttons to match current state. */
  private redraw(): void {
    this.drawRecycleBtn(false);
    if (!this.isCatalogActive() && this.catalogOpen) this.catalogOpen = false;
    this.drawCatalogBtn(this.isCatalogActive(), false);
    this.drawLevelBadge();
    this.drawMenuBtn(false);
  }

  private drawRecycleBtn(hovered: boolean): void {
    const { btnX, upperY, btnSize } = this;
    const radius = btnSize / 2;
    const active = this.isRecycleActive();
    this.recycleBg.clear();
    this.recycleBg.fillStyle(
      hovered && active ? Colors.BUTTON_HOVER : Colors.PANEL_DARK,
      active ? 0.9 : 0.45,
    );
    this.recycleBg.fillCircle(btnX, upperY, radius);
    this.recycleBg.lineStyle(
      2,
      active ? Colors.HIGHLIGHT_YELLOW : 0x334455,
      active ? 0.9 : 0.4,
    );
    this.recycleBg.strokeCircle(btnX, upperY, radius);
    this.recycleIcon.setAlpha(active ? 1 : 0.3);
  }

  private drawLevelBadge(): void {
    const { menuBtnX, upperY, btnSize } = this;
    const depth = this.currentDepth;

    this.levelBg.clear();
    this.levelBg.fillStyle(Colors.PANEL_DARK, 0.9);
    this.levelBg.fillCircle(menuBtnX, upperY, btnSize / 2);

    this.levelLabel.setText(String.fromCharCode(65 + depth));
    this.levelLabel.setPosition(menuBtnX + btnSize / 2 - 7, upperY - btnSize / 2 + 7);
    this.levelLabel.setColor(toColorString(Colors.HIGHLIGHT_YELLOW));

    const categoryItem = this.activeCategoryItem;
    const iconKey: string =
      depth === 0 || !categoryItem
        ? 'skill-diagram'
        : (categoryItem.icon ?? categoryItem.id);

    if (AssetLoader.textureExists(this.scene, iconKey)) {
      const atlasKey = AssetLoader.getAtlasKey(iconKey);
      if (atlasKey) {
        this.levelIcon.setTexture(atlasKey, iconKey);
      } else {
        this.levelIcon.setTexture(iconKey);
      }
      this.levelIcon.setPosition(menuBtnX, upperY).setScale(0.9).setAlpha(1);
      this.levelIcon.setVisible(true);
    } else {
      this.levelIcon.setVisible(false);
    }
  }

  private drawCatalogBtn(active: boolean, hovered: boolean): void {
    const { btnX, lowerY, btnSize } = this;
    const radius = btnSize / 2;

    this.catalogBg.clear();
    this.catalogBg.fillStyle(
      hovered && active ? Colors.BUTTON_HOVER : Colors.PANEL_DARK,
      active ? 0.9 : 0.45,
    );
    this.catalogBg.fillCircle(btnX, lowerY, radius);
    this.catalogBg.lineStyle(
      2,
      this.catalogOpen ? Colors.HIGHLIGHT_YELLOW : active ? Colors.BORDER_BLUE : 0x334455,
      active ? 0.9 : 0.4,
    );
    this.catalogBg.strokeCircle(btnX, lowerY, radius);
    this.catalogIcon.setAlpha(active ? 1 : 0.3);
  }

  private drawMenuBtn(hovered: boolean): void {
    const { menuBtnX, lowerY, btnSize } = this;
    const radius = btnSize / 2;
    this.menuBg.clear();
    this.menuBg.fillStyle(hovered ? Colors.BUTTON_HOVER : Colors.PANEL_DARK, 0.9);
    this.menuBg.fillCircle(menuBtnX, lowerY, radius);
    this.menuBg.lineStyle(2, Colors.BORDER_BLUE, 0.9);
    this.menuBg.strokeCircle(menuBtnX, lowerY, radius);
    this.menuIcon.setAlpha(1);
  }
}
