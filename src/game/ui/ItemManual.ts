import Phaser from 'phaser';
import { MenuItem } from '../types/GameTypes';
import { GameManager } from '../managers/GameManager';
import { Colors } from '../constants/Colors';
import { normalizeItems } from '../utils/ItemAdapter';
import { AssetLoader } from '../managers/AssetLoader';

export class ItemManual extends Phaser.Scene {
  private items: MenuItem[] = [];

  constructor() {
    super({ key: 'ItemManual' });
  }

  async create(): Promise<void> {
    const gameManager = GameManager.getInstance();
    this.items = normalizeItems(gameManager.getItems() as any).slice(0, 6);

    this.setupUI();
  }

  private setupUI(): void {
    const gameWidth = this.cameras.main.width;
    const gameHeight = this.cameras.main.height;
    const panelWidth = Math.min(gameWidth * 0.9, 900);
    const panelHeight = Math.min(gameHeight * 0.9, 700);
    const panelX = gameWidth / 2;
    const panelY = gameHeight / 2;

    // Background panel
    this.add.rectangle(panelX, panelY, panelWidth, panelHeight, Colors.BACKGROUND_DARK);

    // Title with background
    this.add.rectangle(panelX, gameHeight * 0.06, 400, 48, Colors.PANEL_MEDIUM, 0.9);
    this.add.bitmapText(panelX, gameHeight * 0.06, 'clicker', 'ITEM CATALOG', 32)
      .setOrigin(0.5);

    // Close button
    const closeBtn = this.add.rectangle(gameWidth * 0.95, gameHeight * 0.06, 40, 40, Colors.BUTTON_DARK);
    closeBtn.setInteractive();
    closeBtn.on('pointerdown', () => this.scene.stop());
    this.add.bitmapText(gameWidth * 0.95, gameHeight * 0.06, 'clicker', 'X', 20)
      .setOrigin(0.5);

    // List layout
    const isMobile = gameWidth <= 600;
    const listLeft = panelX - panelWidth / 2 + 30;
    const listTop = gameHeight * 0.14;
    const rowHeight = isMobile ? 60 : 70;
    const rowWidth = panelWidth - 60;
    const iconFrameSize = 54;
    const iconScale = isMobile ? 1.3 : 1.5;
    const indent = isMobile ? 18 : 24;
    const listBottom = panelY + panelHeight / 2 - 30;
    const listViewHeight = Math.max(140, listBottom - listTop);

    const listContainer = this.add.container(listLeft, listTop);
    const maskGraphic = this.add.graphics();
    maskGraphic.fillStyle(0xffffff, 1);
    maskGraphic.fillRect(listLeft, listTop, rowWidth, listViewHeight);
    listContainer.setMask(maskGraphic.createGeometryMask());
    maskGraphic.setVisible(false);

    const rows: Array<{ item: MenuItem; isChild: boolean }> = [];
    this.items.forEach((item) => {
      rows.push({ item, isChild: false });
      const leaves = this.getLeafItems(item).filter(leaf => leaf.cost !== undefined);
      leaves.forEach(leaf => rows.push({ item: leaf, isChild: true }));
    });

    rows.forEach((row, index) => {
      const rowY = index * rowHeight + rowHeight / 2;
      const bgColor = index % 2 === 0 ? Colors.PANEL_DARK : Colors.PANEL_MEDIUM;
      const offsetX = row.isChild ? indent : 0;

      const bg = this.add.rectangle(rowWidth / 2, rowY, rowWidth, rowHeight - 8, bgColor, 0.75);
      listContainer.add(bg);

      const iconX = iconFrameSize / 2 + 10 + offsetX;
      const iconY = rowY;

      if (!row.isChild && AssetLoader.textureExists(this, 'frame')) {
        const frameImage = AssetLoader.createImage(this, iconX, iconY, 'frame').setScale(iconScale).setDepth(1);
        listContainer.add(frameImage);
      }

      if (AssetLoader.textureExists(this, row.item.icon)) {
        const iconImage = AssetLoader.createImage(this, iconX, iconY, row.item.icon).setScale(iconScale).setDepth(2);
        listContainer.add(iconImage);
      } else {
        const fallbackText = this.add.bitmapText(iconX, iconY, 'clicker', '?', 18)
          .setOrigin(0.5);
        listContainer.add(fallbackText);
      }

      if (row.isChild) {
        const cost = row.item.cost ?? 0;
        const nameText = row.item.name.toUpperCase();
        const nameX = iconX + iconFrameSize / 2 + 20;
        const maxNameWidth = rowWidth - iconFrameSize - (isMobile ? 110 : 80);

        if (isMobile) {
          const childName = this.add.bitmapText(nameX, rowY, 'clicker', nameText, 12)
            .setOrigin(0, 0.5)
            .setMaxWidth(maxNameWidth);
          const childCost = this.add.bitmapText(rowWidth - 12, rowY, 'clicker', `Q${cost}`, 12)
            .setOrigin(1, 0.5);
          listContainer.add([childName, childCost]);
        } else {
          const childText = `| Q${cost} | ${nameText}`;
          const childLabel = this.add.bitmapText(nameX, rowY, 'clicker', childText, 12)
            .setOrigin(0, 0.5)
            .setMaxWidth(rowWidth - iconFrameSize - 80);
          listContainer.add(childLabel);
        }
      } else {
        const description = row.item.description || 'NO DESCRIPTION AVAILABLE';
        const maxDescLength = isMobile ? 28 : 42;
        const shortDescription = description.split('. ')[0].slice(0, maxDescLength).trim();
        const displayDescription = shortDescription.length > maxDescLength - 2
          ? `${shortDescription.slice(0, maxDescLength - 2)}...`
          : shortDescription;
        const titleSize = isMobile ? 12 : 14;
        const descSize = isMobile ? 10 : 12;
        const titleOffset = isMobile ? 10 : 12;
        const descOffset = isMobile ? 10 : 12;
        const textX = iconX + iconFrameSize / 2 + 20;
        const maxTextWidth = rowWidth - iconFrameSize - (isMobile ? 90 : 80);

        const title = this.add.bitmapText(textX, rowY - titleOffset, 'clicker', row.item.name.toUpperCase(), titleSize)
          .setOrigin(0, 0.5);
        const desc = this.add.bitmapText(textX, rowY + descOffset, 'clicker', displayDescription.toUpperCase(), descSize)
          .setOrigin(0, 0.5)
          .setMaxWidth(maxTextWidth);
        listContainer.add([title, desc]);
      }
    });

    const listContentHeight = rows.length * rowHeight;
    let scrollOffset = 0;
    const minOffset = Math.min(0, listViewHeight - listContentHeight);
    const maxOffset = 0;

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _go: any, _dx: number, dy: number) => {
      if (listContentHeight <= listViewHeight) {
        return;
      }
      scrollOffset = Math.max(minOffset, Math.min(maxOffset, scrollOffset - dy * 0.4));
      listContainer.y = listTop + scrollOffset;
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      this.scene.stop();
    });
  }

  private getLeafItems(item: MenuItem): MenuItem[] {
    if (!item.children || item.children.length == 0) {
      return [item];
    }
    return item.children.flatMap(child => this.getLeafItems(child));
  }
}
