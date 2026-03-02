import Phaser from 'phaser';
import {
  ProgressionManager,
} from '../../managers/ProgressionManager';
import { GameManager } from '../../managers/GameManager';
import { RadDialConfig } from '../../types/RadDialTypes';
import { AssetLoader } from '../../managers/AssetLoader';
import { Colors } from '../../constants/Colors';
import { labelStyle, readoutStyle } from '../../constants/FontStyle';
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
    _items: any,
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

    // Build action list from the rad-dial config — this is the source of truth
    // for what tabs to show.  Fallback to whatever GameManager has loaded if the
    // cache isn't hot yet (shouldn't happen in normal flow).
    const radDial = (this.scene as any)?.cache?.json?.get?.('rad-dial') as RadDialConfig | null;
    const actionIds: string[] = radDial
      ? radDial.actions.map((a) => a.id)
      : GameManager.getInstance().getAllModeStores().map((s) => s.actionId);
    const actionIconMap: Record<string, string> = {};
    if (radDial) radDial.actions.forEach((a) => { actionIconMap[a.id] = a.icon; });

    this.tabScrollOffsets   = actionIds.map(() => 0);
    this.tabMinOffsets      = actionIds.map(() => 0);
    this.tabContainers      = [];
    this.activeTabIndex     = 0;

    // ── Shared clip mask ─────────────────────────────────────────────────
    const maskG = this.scene.add.graphics();
    maskG.fillStyle(0xffffff, 1);
    maskG.fillRect(listLeft, listAreaTop, width, listAreaH);
    maskG.setVisible(false);
    const mask = maskG.createGeometryMask();

    // ── One scrollable list per category ────────────────────────────────
    const gm = GameManager.getInstance();

    actionIds.forEach((catId: string, tabIndex: number) => {
      const isUnlocked = progression.isUnlocked(catId);

      const listContainer = this.scene.add.container(listLeft, listAreaTop);
      listContainer.setMask(mask);
      listContainer.setVisible(tabIndex === 0);
      this.tabContainers.push(listContainer);
      container.add(listContainer);

      if (!isUnlocked) {
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

      // Source items directly from the mode store — flat item arrays (e.g. the
      // reorient items.json) have no nav-tree children so getCatalogRows would
      // always return [] for them.  Querying the store directly ensures icons show.
      const storeItems = gm.getModeStore(catId)?.flat ?? [];
      const entries: CatalogEntry[] = storeItems
        .map((item: MenuItem) => ({ item, dialDepth: 1 }))
        .sort((a: CatalogEntry, b: CatalogEntry) => a.item.name.localeCompare(b.item.name));

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
        const catIconKey = actionIconMap[catId] ?? 'skill-diagram';
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
    const tabCount     = actionIds.length;
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
    actionIds.forEach((catId: string, tabIndex: number) => {
      const isUnlocked = progression.isUnlocked(catId);
      const iconKey    = actionIconMap[catId] ?? 'skill-blocked';
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
        while (next >= 0 && next < actionIds.length && !progression.isUnlocked(actionIds[next])) {
          next += direction;
        }
        if (next >= 0 && next < actionIds.length && next !== cur) {
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
        const tabIndex = actionIds.indexOf(categoryId);
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
