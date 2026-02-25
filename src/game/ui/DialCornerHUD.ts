import Phaser from 'phaser';
import { AssetLoader } from '../managers/AssetLoader';
import { Colors } from '../constants/Colors';

export interface CornerHudCallbacks {
  /** Switches to the catalog tab, pre-scrolled to `categoryId`. */
  openCatalog: (categoryId: string) => void;
  /** Returns to the orders tab. */
  closeCatalog: () => void;
  /** Returns the player to the main menu scene. */
  openMenu: () => void;
}

/**
 * Three persistent corner buttons anchored to the dial's bounding square.
 *
 * Lower-right — Level badge: always visible; shows current nav depth letter
 * and the active category icon.
 *
 * Upper-right — Catalog shortcut: always visible; active (full color, clickable)
 * only at B-level non-terminal; grayed out elsewhere.  First tap opens the
 * catalog; second tap returns to the orders view.
 *
 * Lower-left — Menu button: always visible; tapping returns the player to the
 * main menu scene.
 */
export class DialCornerHUD {
  private readonly scene: Phaser.Scene;
  private readonly callbacks: CornerHudCallbacks;

  // Navigation state
  private currentDepth: number = 0;
  private isTerminal: boolean = false;
  private activeCategoryItem: any = null;
  private catalogOpen: boolean = false;

  // Cached geometry
  private readonly btnX: number;     // right-side X (catalog + level badge)
  private readonly menuBtnX: number; // left-side X (menu button)
  private readonly upperY: number;
  private readonly lowerY: number;
  private readonly btnSize: number = 40;

  // Level badge (lower-right)
  private readonly levelBg: Phaser.GameObjects.Graphics;
  private readonly levelIcon: Phaser.GameObjects.Image;
  private readonly levelLabel: Phaser.GameObjects.BitmapText;

  // Catalog button (upper-right)
  private readonly catalogBg: Phaser.GameObjects.Graphics;
  private readonly catalogIcon: Phaser.GameObjects.Image;

  // Menu button (lower-left)
  private readonly menuBg: Phaser.GameObjects.Graphics;
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
    this.btnX     = dialX + dialRadius - half - margin;
    this.menuBtnX = dialX - dialRadius + half + margin;
    this.upperY   = dialY - dialRadius + half + margin;
    this.lowerY   = dialY + dialRadius - half - margin;

    const { btnX, menuBtnX, upperY, lowerY, btnSize } = this;

    // ── Catalog button (upper-right) ─────────────────────────────────────
    this.catalogBg = scene.add.graphics().setDepth(20);
    this.catalogIcon = AssetLoader.createImage(scene, btnX, upperY, 'skill-brain')
      .setScale(0.85)
      .setDepth(21);

    this.catalogBg.setInteractive(
      new Phaser.Geom.Circle(btnX, upperY, half),
      Phaser.Geom.Circle.Contains,
    );
    this.catalogBg.on('pointerdown', () => this.onCatalogTap());
    this.catalogBg.on('pointerover', () =>
      this.drawCatalogBtn(this.isCatalogActive(), true),
    );
    this.catalogBg.on('pointerout', () =>
      this.drawCatalogBtn(this.isCatalogActive(), false),
    );

    // ── Level badge (lower-right) ─────────────────────────────────────────
    this.levelBg = scene.add.graphics().setDepth(20);
    this.levelIcon = scene.add.image(btnX, lowerY, '').setScale(0.9).setDepth(22);
    this.levelLabel = scene.add
      .bitmapText(btnX + btnSize / 2 - 7, lowerY - btnSize / 2 + 7, 'clicker', 'A', 10)
      .setOrigin(0.5)
      .setDepth(23);

    // ── Menu button (lower-left) ─────────────────────────────────────────
    this.menuBg = scene.add.graphics().setDepth(20);
    this.menuIcon = AssetLoader.createImage(scene, menuBtnX, lowerY, 'skill-question')
      .setScale(0.85)
      .setDepth(21);

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
    // Only capture the category item at B-level so the badge always shows the
    // root-category icon regardless of how deep we subsequently drill (C, D…).
    // Catalog button is now active at any depth >= 1 so the root category
    // must be locked in on the first drill and never overwritten.
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
      // Returning from terminal dial — depth stays the same
      this.isTerminal = false;
    } else {
      this.currentDepth = Math.max(0, this.currentDepth - 1);
      if (this.currentDepth === 0) this.activeCategoryItem = null;
    }
    this.redraw();
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private isCatalogActive(): boolean {
    return this.currentDepth >= 1 && !this.isTerminal;
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

  /** Redraws all corner buttons to match the current navigation state. */
  private redraw(): void {
    this.drawLevelBadge();
    // Reset catalog-open state whenever the button is no longer active
    if (!this.isCatalogActive() && this.catalogOpen) this.catalogOpen = false;
    this.drawCatalogBtn(this.isCatalogActive(), false);
    this.drawMenuBtn(false);
  }

  private drawLevelBadge(): void {
    const { btnX, lowerY, btnSize } = this;
    const depth = this.currentDepth;

    // Level badge is always fully visible — it always reflects a valid nav level.
    this.levelBg.clear();
    this.levelBg.fillStyle(Colors.PANEL_DARK, 0.9);
    this.levelBg.fillCircle(btnX, lowerY, btnSize / 2);

    this.levelLabel.setText(String.fromCharCode(65 + depth));
    this.levelLabel.setPosition(btnX + btnSize / 2 - 7, lowerY - btnSize / 2 + 7);
    this.levelLabel.setTint(Colors.HIGHLIGHT_YELLOW);

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
      this.levelIcon.setPosition(btnX, lowerY).setScale(0.9).setAlpha(1);
      this.levelIcon.setVisible(true);
    } else {
      this.levelIcon.setVisible(false);
    }
  }

  private drawCatalogBtn(active: boolean, hovered: boolean): void {
    const { btnX, upperY, btnSize } = this;
    const radius = btnSize / 2;

    this.catalogBg.clear();
    this.catalogBg.fillStyle(
      hovered && active ? Colors.BUTTON_HOVER : Colors.PANEL_DARK,
      active ? 0.9 : 0.45,
    );
    this.catalogBg.fillCircle(btnX, upperY, radius);
    this.catalogBg.lineStyle(
      2,
      this.catalogOpen ? Colors.HIGHLIGHT_YELLOW : active ? Colors.BORDER_BLUE : 0x334455,
      active ? 0.9 : 0.4,
    );
    this.catalogBg.strokeCircle(btnX, upperY, radius);
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
