import Phaser from 'phaser';
import {
  ProgressionManager,
  ALL_CATEGORY_IDS,
  CATEGORY_ICON_KEYS,
} from '../../managers/ProgressionManager';
import { AssetLoader } from '../../managers/AssetLoader';
import { Colors } from '../../constants/Colors';
import { labelStyle, readoutStyle } from '../../constants/FontStyle';
import { getCatalogRows } from '../../utils/OrderUtils';
import { MenuItem } from '../../types/GameTypes';

/** Public callback surface exposed by buildContent(). */
export interface CatalogPanelHandles {
  /** Jump directly to the tab for a given category id, sliding without animation. */
  openToCategory(categoryId: string): void;
  /** Exposes the raw switchTab so other panels can force a slide (e.g. dial HUD). */
  switchTab(index: number): void;
}

/**
 * Builds the CATALOG tab content and manages all scroll / swipe / tab state.
 */
export class CatalogPanel {
  private scene: Phaser.Scene;

  // ── State fields (set during build) ────────────────────────────────────
  private tabBarHeight       = 44;
  private panelWidth         = 0;
  private activeTabIndex     = 0;
  private tabScrollOffsets:  number[]                              = [];
  private tabMinOffsets:     number[]                              = [];
  private tabContainers:     Phaser.GameObjects.Container[]        = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Returns handles needed by Game.ts after building. */
  build(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    height: number,
    items: any,
    onSwitchToCatalogTab?: () => void,
  ): CatalogPanelHandles {
    const tabBarH    = this.tabBarHeight;
    const listAreaTop = y + tabBarH;
    const listAreaH  = height - tabBarH;
    const listLeft   = x - width / 2;
    const rowHeight  = 60;
    const iconFrameSize = 48;
    const iconScale  = 1.3;
    const progression = ProgressionManager.getInstance();

    this.panelWidth = width;
    this.tabScrollOffsets   = ALL_CATEGORY_IDS.map(() => 0);
    this.tabMinOffsets      = ALL_CATEGORY_IDS.map(() => 0);
    this.tabContainers      = [];
    this.activeTabIndex     = 0;

    // ── Shared clip mask ─────────────────────────────────────────────────
    const maskG = this.scene.add.graphics();
    maskG.fillStyle(0xffffff, 1);
    maskG.fillRect(listLeft, listAreaTop, width, listAreaH);
    maskG.setVisible(false);
    const mask = maskG.createGeometryMask();

    // ── One scrollable list per category ────────────────────────────────
    const allCatalogCategories = getCatalogRows(items);
    const catMap = new Map(allCatalogCategories.map((c: any) => [c.category.id, c]));

    ALL_CATEGORY_IDS.forEach((catId: string, tabIndex: number) => {
      const isUnlocked = progression.isUnlocked(catId);
      const catData    = catMap.get(catId);

      const listContainer = this.scene.add.container(listLeft, listAreaTop);
      listContainer.setMask(mask);
      listContainer.setVisible(tabIndex === 0);
      this.tabContainers.push(listContainer);
      container.add(listContainer);

      if (!isUnlocked || !catData) {
        const lockBg = this.scene.add.graphics();
        lockBg.fillStyle(Colors.PANEL_DARK, 0.85);
        lockBg.fillRect(0, 0, width, listAreaH);
        listContainer.add(lockBg);
        if (AssetLoader.textureExists(this.scene, 'skill-blocked')) {
          const lockIcon = AssetLoader.createImage(this.scene, width / 2, listAreaH / 2 - 20, 'skill-blocked')
            .setScale(1.2).setAlpha(0.5);
          listContainer.add(lockIcon);
        }
        const lockLabel = this.scene.add.text(width / 2, listAreaH / 2 + 20, 'LOCKED', labelStyle(12, 0x556677))
          .setOrigin(0.5);
        listContainer.add(lockLabel);
        return;
      }

      type CatalogEntry = { item: MenuItem; dialDepth: number };
      const collectEntries = (node: MenuItem, depth: number, unlockedDepth: number): CatalogEntry[] => {
        if (!node.children) return [];
        const result: CatalogEntry[] = [];
        node.children.forEach((child: MenuItem) => {
          const downMatch = child.id.match(/_down_(\d+)$/);
          if (downMatch) {
            const levelN = parseInt(downMatch[1], 10);
            if (levelN < unlockedDepth) result.push(...collectEntries(child, levelN + 1, unlockedDepth));
            return;
          }
          const isNavDown = child.icon === 'skill-down' || child.id.includes('_down_');
          if (!isNavDown && child.cost !== undefined) result.push({ item: child, dialDepth: depth });
        });
        return result;
      };

      const unlockedDepth = progression.getUnlockedDepth(catId);
      const rootNode      = (catData as any)?.category ?? null;
      const entries: CatalogEntry[] = rootNode
        ? collectEntries(rootNode, 1, unlockedDepth).sort((a, b) => a.item.name.localeCompare(b.item.name))
        : [];

      entries.forEach((entry, index) => {
        const { item, dialDepth } = entry;
        const rowY    = index * rowHeight + rowHeight / 2;
        const bgColor = index % 2 === 0 ? Colors.PANEL_DARK : Colors.PANEL_MEDIUM;
        const bg = this.scene.add.rectangle(width / 2, rowY, width, rowHeight - 8, bgColor, 0.75);
        listContainer.add(bg);

        const iconX = iconFrameSize / 2 + 10;
        if (AssetLoader.textureExists(this.scene, item.icon)) {
          listContainer.add(
            AssetLoader.createImage(this.scene, iconX, rowY, item.icon).setScale(iconScale).setDepth(2),
          );
        }

        const nameX = iconX + iconFrameSize / 2 + 20;
        listContainer.add(
          this.scene.add.text(nameX, rowY, item.name.toUpperCase(), labelStyle(10))
            .setOrigin(0, 0.5).setWordWrapWidth(width - iconFrameSize - 90),
        );

        const badgeSize = 28;
        const badgeR    = badgeSize / 2;
        const badgeX    = width - badgeR - 10;
        const badgeY    = rowY;
        const catIconKey = CATEGORY_ICON_KEYS[catId] ?? 'skill-diagram';
        const badgeG = this.scene.add.graphics();
        badgeG.fillStyle(Colors.PANEL_MEDIUM, 1);
        badgeG.fillCircle(badgeX, badgeY, badgeR);
        badgeG.lineStyle(1, Colors.BORDER_BLUE, 0.7);
        badgeG.strokeCircle(badgeX, badgeY, badgeR);
        listContainer.add(badgeG);

        if (AssetLoader.textureExists(this.scene, catIconKey)) {
          listContainer.add(
            AssetLoader.createImage(this.scene, badgeX, badgeY, catIconKey).setScale(0.55).setDepth(2),
          );
        }

        const levelLetter = String.fromCharCode(65 + dialDepth);
        listContainer.add(
          this.scene.add.text(badgeX + badgeR - 5, badgeY - badgeR + 5, levelLetter, readoutStyle(8, Colors.HIGHLIGHT_YELLOW))
            .setOrigin(0.5).setDepth(3),
        );
      });

      const contentH = entries.length * rowHeight;
      this.tabMinOffsets[tabIndex] = Math.min(0, listAreaH - contentH);
    });

    // ── Tab icon bar ─────────────────────────────────────────────────────
    const tabCount     = ALL_CATEGORY_IDS.length;
    const tabIconSize  = 32;
    const tabBarPad    = 4;
    const totalTabW    = tabCount * tabIconSize + (tabCount - 1) * tabBarPad;
    const tabBarStartX = x - totalTabW / 2;
    const tabBarCenterY = y + tabBarH / 2;

    const tabBarSep = this.scene.add.graphics();
    tabBarSep.lineStyle(1, Colors.BORDER_BLUE, 0.45);
    tabBarSep.lineBetween(listLeft, y + tabBarH - 2, listLeft + width, y + tabBarH - 2);
    container.add(tabBarSep);

    const tabHighlight = this.scene.add.graphics();
    container.add(tabHighlight);

    const redrawTabHighlight = (activeIdx: number) => {
      tabHighlight.clear();
      const tx = tabBarStartX + activeIdx * (tabIconSize + tabBarPad) + tabIconSize / 2;
      tabHighlight.lineStyle(2, Colors.HIGHLIGHT_YELLOW, 0.9);
      tabHighlight.strokeRect(tx - tabIconSize / 2 - 1, tabBarCenterY - tabIconSize / 2 - 1, tabIconSize + 2, tabIconSize + 2);
    };

    // ── switchTab closure ────────────────────────────────────────────────
    const switchTab = (targetIndex: number, redrawHl?: (i: number) => void): void => {
      const oldIndex     = this.activeTabIndex;
      if (oldIndex === targetIndex) return;
      const oldContainer = this.tabContainers[oldIndex];
      const newContainer = this.tabContainers[targetIndex];
      if (!oldContainer || !newContainer) return;

      const slideW    = this.panelWidth;
      const direction = targetIndex > oldIndex ? 1 : -1;
      const homeX     = oldContainer.x;

      newContainer.x = homeX + direction * slideW;
      newContainer.setVisible(true);
      this.scene.tweens.add({
        targets: oldContainer,
        x: homeX - direction * slideW,
        duration: 150,
        ease: 'Quad.easeOut',
        onComplete: () => oldContainer.setVisible(false),
      });
      this.scene.tweens.add({
        targets: newContainer,
        x: homeX,
        duration: 150,
        ease: 'Quad.easeOut',
      });
      this.activeTabIndex = targetIndex;
      (redrawHl ?? redrawTabHighlight)(targetIndex);
    };
    ALL_CATEGORY_IDS.forEach((catId: string, tabIndex: number) => {
      const isUnlocked = progression.isUnlocked(catId);
      const iconKey    = CATEGORY_ICON_KEYS[catId] ?? 'skill-blocked';
      const tx         = tabBarStartX + tabIndex * (tabIconSize + tabBarPad) + tabIconSize / 2;

      const tabBg = this.scene.add.rectangle(tx, tabBarCenterY, tabIconSize, tabIconSize, Colors.PANEL_MEDIUM, 0.7);
      tabBg.setStrokeStyle(1, Colors.BORDER_BLUE, isUnlocked ? 0.6 : 0.25);
      container.add(tabBg);

      if (AssetLoader.textureExists(this.scene, iconKey)) {
        const tabIcon = AssetLoader.createImage(this.scene, tx, tabBarCenterY, iconKey)
          .setScale(0.75).setAlpha(isUnlocked ? 1.0 : 0.25);
        container.add(tabIcon);
      }

      if (!isUnlocked) return;
      tabBg.setInteractive();
      tabBg.on('pointerdown', () => switchTab(tabIndex, redrawTabHighlight));
      tabBg.on('pointerover', () => tabBg.setFillStyle(Colors.BUTTON_HOVER, 0.85));
      tabBg.on('pointerout',  () => tabBg.setFillStyle(Colors.PANEL_MEDIUM, 0.7));
    });

    redrawTabHighlight(0);
    this.scene.events.on('catalog:tabActivated', (idx: number) => redrawTabHighlight(idx));

    // ── Horizontal swipe ─────────────────────────────────────────────────
    let swipeStartX        = 0;
    let swipeStartY        = 0;
    let isSwipeTracking    = false;
    let swipeConsumed      = false;

    this.scene.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (!container.visible) return;
      const inPanel = ptr.x >= listLeft && ptr.x <= listLeft + width
                   && ptr.y >= y        && ptr.y <= y + tabBarH + listAreaH;
      if (!inPanel) return;
      swipeStartX    = ptr.x;
      swipeStartY    = ptr.y;
      isSwipeTracking = true;
      swipeConsumed  = false;
    });
    this.scene.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!container.visible || !isSwipeTracking || swipeConsumed) return;
      const dx = ptr.x - swipeStartX;
      const dy = ptr.y - swipeStartY;
      if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        swipeConsumed = true;
        const direction = dx < 0 ? 1 : -1;
        const cur = this.activeTabIndex;
        let next = cur + direction;
        while (next >= 0 && next < ALL_CATEGORY_IDS.length && !progression.isUnlocked(ALL_CATEGORY_IDS[next])) {
          next += direction;
        }
        if (next >= 0 && next < ALL_CATEGORY_IDS.length && next !== cur) {
          switchTab(next, redrawTabHighlight);
        }
      }
    });
    this.scene.input.on('pointerup', () => { isSwipeTracking = false; });

    // ── Vertical scroll ───────────────────────────────────────────────────
    this.scene.input.on('wheel', (_ptr: Phaser.Input.Pointer, _go: any, _dx: number, dy: number) => {
      if (!container.visible) return;
      const ti   = this.activeTabIndex;
      const listC = this.tabContainers[ti];
      if (!listC) return;
      const minOff = this.tabMinOffsets[ti];
      if (minOff >= 0) return;
      this.tabScrollOffsets[ti] = Math.max(minOff, Math.min(0, this.tabScrollOffsets[ti] - dy * 0.4));
      listC.y = listAreaTop + this.tabScrollOffsets[ti];
    });

    let touchStartY     = 0;
    let isTouchScrolling = false;
    this.scene.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (!container.visible) return;
      if (ptr.x >= listLeft && ptr.x <= listLeft + width && ptr.y >= listAreaTop && ptr.y <= listAreaTop + listAreaH) {
        touchStartY      = ptr.y;
        isTouchScrolling = true;
      }
    });
    this.scene.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!container.visible || !isTouchScrolling) return;
      const ti   = this.activeTabIndex;
      const listC = this.tabContainers[ti];
      if (!listC) return;
      const minOff = this.tabMinOffsets[ti];
      if (minOff >= 0) return;
      const ddy    = touchStartY - ptr.y;
      touchStartY  = ptr.y;
      this.tabScrollOffsets[ti] = Math.max(minOff, Math.min(0, this.tabScrollOffsets[ti] - ddy));
      listC.y = listAreaTop + this.tabScrollOffsets[ti];
    });
    this.scene.input.on('pointerup', () => { isTouchScrolling = false; });

    // ── Return public handles ────────────────────────────────────────────
    return {
      openToCategory: (categoryId: string) => {
        const tabIndex = ALL_CATEGORY_IDS.indexOf(categoryId);
        if (tabIndex !== -1 && tabIndex !== this.activeTabIndex) {
          const old    = this.tabContainers[this.activeTabIndex];
          const homeX  = old ? old.x : 0;
          if (old) old.setVisible(false);
          const next   = this.tabContainers[tabIndex];
          if (next) { next.x = homeX; next.setVisible(true); }
          this.activeTabIndex = tabIndex;
          this.scene.events.emit('catalog:tabActivated', tabIndex);
        }
        onSwitchToCatalogTab?.();
      },
      switchTab: (index: number) => switchTab(index, redrawTabHighlight),
    };
  }
}
