import Phaser from 'phaser';
import { MenuItem } from '../types/GameTypes';
import { GameManager } from '../managers/GameManager';
import { Colors, toColorString } from '../constants/Colors';
import { normalizeItems } from '../utils/ItemAdapter';

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

    // Title
    this.add.text(panelX, gameHeight * 0.06, 'ITEM CATALOG', {
      fontSize: '32px',
      color: toColorString(Colors.HIGHLIGHT_YELLOW),
      align: 'center',
      fontFamily: 'Arial',
    }).setOrigin(0.5);

    // Close button
    const closeBtn = this.add.rectangle(gameWidth * 0.95, gameHeight * 0.06, 40, 40, Colors.BUTTON_DARK);
    closeBtn.setInteractive();
    closeBtn.on('pointerdown', () => this.scene.stop());
    this.add.text(gameWidth * 0.95, gameHeight * 0.06, 'X', {
      fontSize: '20px',
      color: toColorString(Colors.HIGHLIGHT_YELLOW),
    }).setOrigin(0.5);

    // List layout
    const listLeft = panelX - panelWidth / 2 + 30;
    const listTop = gameHeight * 0.14;
    const rowHeight = 70;
    const rowWidth = panelWidth - 60;
    const iconFrameSize = 54;
    const iconScale = 1.5;
    const indent = 24;
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

      if (!row.isChild && this.textures.exists('frame')) {
        const frameImage = this.add.image(iconX, iconY, 'frame').setScale(iconScale).setDepth(1);
        listContainer.add(frameImage);
      }

      if (this.textures.exists(row.item.icon)) {
        const iconImage = this.add.image(iconX, iconY, row.item.icon).setScale(iconScale).setDepth(2);
        listContainer.add(iconImage);
      } else {
        const fallbackText = this.add.text(iconX, iconY, '?', {
          fontSize: '18px',
          color: toColorString(Colors.HIGHLIGHT_YELLOW),
        }).setOrigin(0.5);
        listContainer.add(fallbackText);
      }

      if (row.isChild) {
        const cost = row.item.cost ?? 0;
        const childText = `| ${cost}Q | ${row.item.name}`;
        const childLabel = this.add.text(iconX + iconFrameSize / 2 + 20, rowY, childText, {
          fontSize: '12px',
          color: toColorString(Colors.PALE_BLUE_2),
          wordWrap: { width: rowWidth - iconFrameSize - 80 },
        }).setOrigin(0, 0.5);
        listContainer.add(childLabel);
      } else {
        const description = row.item.description || 'No description available.';
        const title = this.add.text(iconX + iconFrameSize / 2 + 20, rowY - 12, row.item.name, {
          fontSize: '14px',
          color: toColorString(Colors.HIGHLIGHT_YELLOW),
          fontStyle: 'bold',
        }).setOrigin(0, 0.5);
        const desc = this.add.text(iconX + iconFrameSize / 2 + 20, rowY + 12, description, {
          fontSize: '12px',
          color: toColorString(Colors.PALE_BLUE_2),
          wordWrap: { width: rowWidth - iconFrameSize - 80 },
        }).setOrigin(0, 0.5);
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
