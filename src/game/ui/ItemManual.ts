import Phaser from 'phaser';
import { Item, SubItem } from '../types/GameTypes';
import { GameManager } from '../managers/GameManager';

export class ItemManual extends Phaser.Scene {
  private items: Item[] = [];
  private currentPage: number = 0;
  private itemsPerPage: number = 6;
  private selectedItemId: string | null = null;
  private itemDetailsPanel: Phaser.GameObjects.Zone | null = null;

  constructor() {
    super({ key: 'ItemManual' });
  }

  async create(): Promise<void> {
    const gameManager = GameManager.getInstance();
    this.items = gameManager.getItems();

    this.setupUI();
    this.displayPage(0);
  }

  private setupUI(): void {
    // Get responsive viewport dimensions
    const gameWidth = this.cameras.main.width;
    const gameHeight = this.cameras.main.height;
    const panelWidth = Math.min(gameWidth * 0.9, 900);
    const panelHeight = Math.min(gameHeight * 0.9, 700);

    // Background
    this.add.rectangle(gameWidth / 2, gameHeight / 2, panelWidth, panelHeight, 0x0a1022);

    // Title
    this.add.text(gameWidth / 2, gameHeight * 0.05, 'ITEM MANUAL', {
      fontSize: '32px',
      color: '#ffd54a',
      align: 'center',
      fontFamily: 'Arial',
    }).setOrigin(0.5);

    // Instructions
    this.add.text(gameWidth / 2, gameHeight * 0.1, 'Browse items and their descriptions', {
      fontSize: '12px',
      color: '#8fd4ff',
      align: 'center',
    }).setOrigin(0.5);

    // Close button
    const closeBtn = this.add.rectangle(gameWidth * 0.95, gameHeight * 0.05, 40, 40, 0x102a52);
    closeBtn.setInteractive();
    closeBtn.on('pointerdown', () => this.scene.stop());
    this.add.text(gameWidth * 0.95, gameHeight * 0.05, 'X', {
      fontSize: '20px',
      color: '#ffd54a',
    }).setOrigin(0.5);

    // Setup grid area
    this.createItemGrid();

    // Setup details panel
    this.createDetailsPanel();

    // Navigation buttons
    this.createNavigationButtons();
  }

  private createItemGrid(): void {
    const gridStartY = 100;
    const gridStartX = 50;
    const itemWidth = 110;
    const itemHeight = 140;
    const padding = 10;

    // Create clickable zones for each item slot
    for (let i = 0; i < this.itemsPerPage; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;

      const x = gridStartX + col * (itemWidth + padding);
      const y = gridStartY + row * (itemHeight + padding);

      const itemZone = this.add.zone(x, y, itemWidth, itemHeight);
      itemZone.setInteractive();
      itemZone.setData('itemIndex', i);

      itemZone.on('pointerdown', () => {
        const index = this.currentPage * this.itemsPerPage + i;
        if (index < this.flattenItems().length) {
          const item = this.flattenItems()[index];
          this.selectedItemId = this.getItemId(item);
          this.displayDetails(item);
        }
      });
    }
  }

  private createDetailsPanel(): void {
    // Details panel background
    const panelX = 420;
    const panelY = 200;
    const panelWidth = 350;
    const panelHeight = 350;

    this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x0b1f3a, 0.65);
    this.add.rectangle(panelX, panelY, panelWidth, panelHeight).setStrokeStyle(2, 0xffd54a);

    // Placeholder text
    this.add.text(panelX - panelWidth / 2 + 20, panelY - panelHeight / 2 + 20, 'SELECT AN ITEM', {
      fontSize: '14px',
      color: '#ffd54a',
      wordWrap: { width: panelWidth - 40 },
    });
  }

  private displayPage(pageNum: number): void {
    this.currentPage = pageNum;
    const gridStartY = 100;
    const gridStartX = 50;
    const itemWidth = 110;
    const itemHeight = 140;
    const padding = 10;

    const allItems = this.flattenItems();
    const startIndex = pageNum * this.itemsPerPage;
    const endIndex = Math.min(startIndex + this.itemsPerPage, allItems.length);

    // Clear existing item displays
    this.children.list.forEach(child => {
      if (child instanceof Phaser.GameObjects.Text || child instanceof Phaser.GameObjects.Image) {
        if ((child as any).getData?.('isItemDisplay')) {
          child.destroy();
        }
      }
    });

    // Display items for current page
    for (let i = startIndex; i < endIndex; i++) {
      const item = allItems[i];
      const slotIndex = i - startIndex;
      const row = Math.floor(slotIndex / 3);
      const col = slotIndex % 3;

      const x = gridStartX + col * (itemWidth + padding) + itemWidth / 2;
      const y = gridStartY + row * (itemHeight + padding) + itemHeight / 2;

      // Item background
      const bg = this.add.rectangle(x, y, itemWidth, itemHeight, 0x0f274d, 0.75);
      bg.setData('isItemDisplay', true);

      // Item frame
      this.add.rectangle(x, y, itemWidth, itemHeight)
        .setStrokeStyle(1, this.selectedItemId === this.getItemId(item) ? 0xffd54a : 0x4a6a90)
        .setData('isItemDisplay', true);

      // Item name (abbreviated)
      const name = this.getItemName(item).substring(0, 15);
      const nameText = this.add.text(x, y + itemHeight / 2 - 25, name, {
        fontSize: '10px',
        color: '#cfe7ff',
        align: 'center',
        wordWrap: { width: itemWidth - 10 },
      }).setOrigin(0.5);
      nameText.setData('isItemDisplay', true);

      // Item icon placeholder (would be sprite in real implementation)
      this.add.text(x, y - 10, '📦', {
        fontSize: '24px',
      }).setOrigin(0.5).setData('isItemDisplay', true);

      // Item cost (if subitem)
      if (this.isSubItem(item)) {
        const cost = (item as SubItem).cost;
        this.add.text(x, y + itemHeight / 2 - 5, `$${cost}`, {
          fontSize: '9px',
          color: '#ffd54a',
          align: 'center',
        }).setOrigin(0.5).setData('isItemDisplay', true);
      }
    }

    // Update page indicator
    const totalPages = Math.ceil(allItems.length / this.itemsPerPage);
    this.children.list.forEach(child => {
      if (child instanceof Phaser.GameObjects.Text && (child as any).getData?.('isPageText')) {
        child.destroy();
      }
    });

    const pageText = this.add.text(400, 560, `Page ${pageNum + 1} of ${totalPages}`, {
      fontSize: '12px',
      color: '#8aa6c6',
      align: 'center',
    }).setOrigin(0.5);
    pageText.setData('isPageText', true);
  }

  private displayDetails(item: Item | SubItem): void {
    const panelX = 420;
    const panelY = 200;
    const panelWidth = 350;
    const panelHeight = 350;

    // Clear previous details
    this.children.list.forEach(child => {
      if (child instanceof Phaser.GameObjects.Text && (child as any).getData?.('isDetailsText')) {
        child.destroy();
      }
    });

    const name = this.getItemName(item);
    const description = this.getItemDescription(item);
    const cost = this.isSubItem(item) ? (item as SubItem).cost : null;

    // Name
    const nameText = this.add.text(panelX - panelWidth / 2 + 20, panelY - panelHeight / 2 + 30, name, {
      fontSize: '18px',
      color: '#ffd54a',
      fontStyle: 'bold',
    });
    nameText.setData('isDetailsText', true);

    // Cost (if exists)
    if (cost !== null) {
      const costText = this.add.text(panelX - panelWidth / 2 + 20, panelY - panelHeight / 2 + 60, `Cost: $${cost}`, {
        fontSize: '14px',
        color: '#ffd54a',
      });
      costText.setData('isDetailsText', true);

      // Description (adjusted Y for when cost is present)
      const descText = this.add.text(
        panelX - panelWidth / 2 + 20,
        panelY - panelHeight / 2 + 90,
        description,
        {
          fontSize: '12px',
          color: '#b6c9e6',
          wordWrap: { width: panelWidth - 40 },
        }
      );
      descText.setData('isDetailsText', true);
    } else {
      // Description (no cost)
      const descText = this.add.text(
        panelX - panelWidth / 2 + 20,
        panelY - panelHeight / 2 + 60,
        description,
        {
          fontSize: '12px',
          color: '#b6c9e6',
          wordWrap: { width: panelWidth - 40 },
        }
      );
      descText.setData('isDetailsText', true);
    }
  }

  private createNavigationButtons(): void {
    const allItems = this.flattenItems();
    const totalPages = Math.ceil(allItems.length / this.itemsPerPage);

    // Previous button
    const prevBtn = this.add.rectangle(100, 540, 60, 30, 0x0b1c3a);
    prevBtn.setStrokeStyle(2, 0xffd54a);
    prevBtn.setInteractive();
    prevBtn.on('pointerdown', () => {
      if (this.currentPage > 0) {
        this.displayPage(this.currentPage - 1);
      }
    });
    this.add.text(100, 540, '< PREV', {
      fontSize: '11px',
      color: '#ffd54a',
    }).setOrigin(0.5);

    // Next button
    const nextBtn = this.add.rectangle(700, 540, 60, 30, 0x0b1c3a);
    nextBtn.setStrokeStyle(2, 0xffd54a);
    nextBtn.setInteractive();
    nextBtn.on('pointerdown', () => {
      if (this.currentPage < totalPages - 1) {
        this.displayPage(this.currentPage + 1);
      }
    });
    this.add.text(700, 540, 'NEXT >', {
      fontSize: '11px',
      color: '#ffd54a',
    }).setOrigin(0.5);

    // Close button (bottom)
    const closeBtn2 = this.add.rectangle(400, 580, 100, 30, 0x102a52);
    closeBtn2.setInteractive();
    closeBtn2.on('pointerdown', () => this.scene.stop());
    this.add.text(400, 580, 'CLOSE (ESC)', {
      fontSize: '11px',
      color: '#ffd54a',
    }).setOrigin(0.5);

    // ESC key
    this.input.keyboard?.on('keydown-ESC', () => {
      this.scene.stop();
    });
  }

  private flattenItems(): (Item | SubItem)[] {
    const flattened: (Item | SubItem)[] = [];
    this.items.forEach(category => {
      flattened.push(category);
      flattened.push(...category.subItems);
    });
    return flattened;
  }

  private isSubItem(item: Item | SubItem): boolean {
    return 'cost' in item;
  }

  private getItemId(item: Item | SubItem): string {
    return item.id;
  }

  private getItemName(item: Item | SubItem): string {
    return item.name;
  }

  private getItemDescription(item: Item | SubItem): string {
    return item.description || 'No description available';
  }
}
