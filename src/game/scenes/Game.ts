import { RadialDial } from '../ui/RadialDial';
import { GameManager } from '../managers/GameManager';
import { SettingsManager } from '../managers/SettingsManager';
import { Colors } from '../constants/Colors';
import { normalizeItems } from '../utils/ItemAdapter';
import { generateOrder as buildOrder } from '../utils/OrderUtils';
import { MenuItem, Order } from '../types/GameTypes';

export class Game extends Phaser.Scene {
  private radialDial: RadialDial | null = null;
  private ordersContainer: Phaser.GameObjects.Container | null = null;
  private fulfillmentSlots: Array<{ x: number; y: number; size: number; slotBg: Phaser.GameObjects.Graphics; expectedIconKey: string }> = [];
  private fulfillmentImages: Array<{ img: Phaser.GameObjects.Image; iconKey: string } | null> = [];
  private fulfillmentOrderIconKeys: Set<string> = new Set();

  constructor() {
    super('Game');
  }

  create() {
    try {
      const gameManager = GameManager.getInstance();
      const items = gameManager.getItems();

      // Calculate dial position based on viewport (responsive)
      const gameWidth = this.cameras.main.width;
      const gameHeight = this.cameras.main.height;
      
      // Load dial position from settings
      const settingsManager = SettingsManager.getInstance();
      const dialSettings = settingsManager.getDialSettings();
      const dialX = gameWidth + dialSettings.offsetX;
      const dialY = gameHeight + dialSettings.offsetY;
      const dialRadius = 150;

      // Background
      this.add.rectangle(gameWidth / 2, gameHeight / 2, gameWidth, gameHeight, Colors.BACKGROUND_DARK);

      // Central display panel (tall, from top to above dial)
      const panelWidth = Math.min(420, gameWidth - 40);
      const panelTop = 20;
      const panelBottom = dialY - dialRadius - 20;
      const panelHeight = panelBottom - panelTop;
      const panelX = gameWidth / 2;
      const panelY = (panelTop + panelBottom) / 2;
      
      const mainPanel = this.add.rectangle(panelX, panelY, panelWidth, panelHeight, Colors.PANEL_DARK, 0.85);
      mainPanel.setStrokeStyle(2, Colors.BORDER_BLUE, 0.8);

      // Panel title
      const titleY = panelTop + 16;
      const panelTitle = this.add.bitmapText(panelX, titleY, 'clicker', 'ORDERS', 14)
        .setOrigin(0.5);

      // Tabbed panel controls (right-hand vertical tabs)
      const tabWidth = 42;
      const tabHeight = 32;
      const tabSpacing = 6;
      const tabX = panelX + panelWidth / 2 + tabWidth / 2 + 6;
      const tabStartY = panelTop + tabHeight / 2 + 4;
      const tabKeys = ['ORDERS', 'SETTINGS', 'CATALOG'] as const;
      let activeTab: typeof tabKeys[number] = 'ORDERS';

      // Content containers for each tab
      this.ordersContainer = this.add.container(0, 0);
      const settingsContainer = this.add.container(0, 0);
      const catalogContainer = this.add.container(0, 0);
      
      const containers = {
        ORDERS: this.ordersContainer,
        SETTINGS: settingsContainer,
        CATALOG: catalogContainer
      };

      // Generate and display current order
      const currentOrder = buildOrder(items);
      this.fulfillmentSlots = this.buildOrderContent(this.ordersContainer, panelX, panelTop + 36, panelWidth - 20, panelHeight - 50, currentOrder);
      this.fulfillmentImages = new Array(this.fulfillmentSlots.length).fill(null);
      this.fulfillmentOrderIconKeys = new Set(currentOrder.requirements.map(r => r.iconKey));

      // Placeholder content for settings
      this.buildSettingsContent(settingsContainer, panelX, panelTop + 36, panelWidth - 20, panelHeight - 50);
      settingsContainer.setVisible(false);
      this.buildCatalogContent(catalogContainer, panelX, panelTop + 36, panelWidth - 20, panelHeight - 50, items);
      catalogContainer.setVisible(false);

      const updateTabDisplay = (label: typeof tabKeys[number]) => {
        activeTab = label;
        panelTitle.setText(label);
        Object.keys(containers).forEach(key => {
          containers[key as typeof activeTab].setVisible(key === label);
        });
      };

      tabKeys.forEach((label, index) => {
        const tabY = tabStartY + index * (tabHeight + tabSpacing);
        const tabBg = this.add.rectangle(tabX, tabY, tabWidth, tabHeight, Colors.PANEL_DARK, 0.9);
        tabBg.setStrokeStyle(2, Colors.BORDER_BLUE, 0.8);
        tabBg.setInteractive();
        tabBg.on('pointerdown', () => updateTabDisplay(label));
        tabBg.on('pointerover', () => tabBg.setFillStyle(Colors.BUTTON_HOVER, 0.95));
        tabBg.on('pointerout', () => tabBg.setFillStyle(Colors.PANEL_DARK, 0.9));

        const tabIcon = this.add.bitmapText(tabX, tabY, 'clicker', label[0], 14)
          .setOrigin(0.5);
        tabIcon.setTint(Colors.HIGHLIGHT_YELLOW);
      });

      // Menu button (bottom left)
      const menuX = 80;
      const menuY = gameHeight - 40;
      const menuWidth = 140;
      const menuHeight = 34;
      const menuBg = this.add.rectangle(menuX, menuY, menuWidth, menuHeight, Colors.PANEL_DARK, 0.9);
      menuBg.setStrokeStyle(2, Colors.HIGHLIGHT_YELLOW);
      menuBg.setInteractive();
      menuBg.on('pointerdown', () => this.scene.start('MainMenu'));
      menuBg.on('pointerover', () => menuBg.setFillStyle(Colors.BUTTON_HOVER, 0.95));
      menuBg.on('pointerout', () => menuBg.setFillStyle(Colors.PANEL_DARK, 0.9));
      this.add.bitmapText(menuX, menuY, 'clicker', 'MENU', 13)
        .setOrigin(0.5);
      this.radialDial = new RadialDial(this, dialX, dialY, items);

      // Listen for item confirmation — show terminal action dial
      this.events.on('dial:itemConfirmed', (data: { item: any }) => {
        if (this.radialDial) {
          this.radialDial.showTerminalDial(data.item);
        }
      });

      // Listen for terminal action selection
      this.events.on('dial:actionConfirmed', (data: { action: string; item: any }) => {
        const iconKey: string = data.item.icon || data.item.id;

        if (data.action === 'send' && this.ordersContainer) {
          // Place icon in the first empty slot
          const slotIndex = this.fulfillmentImages.findIndex(s => s === null);
          if (slotIndex !== -1) {
            const slot = this.fulfillmentSlots[slotIndex];
            if (this.textures.exists(iconKey)) {
              const img = this.add.image(slot.x, slot.y, iconKey);
              img.setDisplaySize(slot.size - 6, slot.size - 6);
              this.ordersContainer.add(img);
              this.fulfillmentImages[slotIndex] = { img, iconKey };
            }
            // Color the slot bg: green = correct position, yellow = wrong position but in order
            const isCorrect = slot.expectedIconKey === iconKey;
            const isPresent = this.fulfillmentOrderIconKeys.has(iconKey);
            const bgFill  = isCorrect ? 0x003a1a : isPresent ? 0x3a3000 : Colors.PANEL_MEDIUM;
            const bgStroke = isCorrect ? 0x00e84a : isPresent ? 0xffd700 : Colors.BORDER_BLUE;
            slot.slotBg.clear();
            slot.slotBg.fillStyle(bgFill, 0.85);
            slot.slotBg.fillRect(slot.x - slot.size / 2, slot.y - slot.size / 2, slot.size, slot.size);
            slot.slotBg.lineStyle(2, bgStroke, 0.95);
            slot.slotBg.strokeRect(slot.x - slot.size / 2, slot.y - slot.size / 2, slot.size, slot.size);
          }
        } else if (data.action === 'recall' && this.ordersContainer) {
          // Find the rightmost filled slot containing this icon and remove it
          let lastMatch = -1;
          for (let i = this.fulfillmentImages.length - 1; i >= 0; i--) {
            if (this.fulfillmentImages[i]?.iconKey === iconKey) { lastMatch = i; break; }
          }
          if (lastMatch !== -1) {
            this.fulfillmentImages[lastMatch]?.img.destroy();
            this.fulfillmentImages[lastMatch] = null;
            // Revert slot bg to neutral
            const slot = this.fulfillmentSlots[lastMatch];
            slot.slotBg.clear();
            slot.slotBg.fillStyle(Colors.PANEL_MEDIUM, 0.8);
            slot.slotBg.fillRect(slot.x - slot.size / 2, slot.y - slot.size / 2, slot.size, slot.size);
            slot.slotBg.lineStyle(1, Colors.BORDER_BLUE, 0.7);
            slot.slotBg.strokeRect(slot.x - slot.size / 2, slot.y - slot.size / 2, slot.size, slot.size);
          }
          // If no match, dial already reset to A-level — nothing to do
        }
      });

      // Listen for level changes (when drilling into sub-items)
      this.events.on('dial:levelChanged', (data: { level: number; item: any }) => {
        console.log('Entered submenu for:', data.item.name);
      });

      // Listen for going back (tap center to return to root)
      this.events.on('dial:goBack', () => {
        console.log('Returned to main menu');
      });
    } catch (error) {
      console.error('Error creating Game scene:', error);
      this.add.bitmapText(50, 50, 'clicker', 'ERROR LOADING GAME DATA', 20);
    }
  }

  private buildCatalogContent(container: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number, items: any): void {
    const normalizedItems = normalizeItems(items).slice(0, 6);
    const listLeft = x - width / 2;
    const listTop = y;
    const rowHeight = 60;
    const iconFrameSize = 48;
    const iconScale = 1.3;

    const listContainer = this.add.container(listLeft, listTop);
    const maskGraphic = this.add.graphics();
    maskGraphic.fillStyle(0xffffff, 1);
    maskGraphic.fillRect(listLeft, listTop, width, height);
    listContainer.setMask(maskGraphic.createGeometryMask());
    maskGraphic.setVisible(false);

    const rows: Array<{ item: MenuItem; isChild: boolean }> = [];
    normalizedItems.forEach((item) => {
      rows.push({ item, isChild: false });
      const leaves = this.getLeafItems(item).filter(leaf => leaf.cost !== undefined);
      leaves.forEach(leaf => rows.push({ item: leaf, isChild: true }));
    });

    rows.forEach((row, index) => {
      const rowY = index * rowHeight + rowHeight / 2;
      const bgColor = index % 2 === 0 ? Colors.PANEL_DARK : Colors.PANEL_MEDIUM;

      const bg = this.add.rectangle(width / 2, rowY, width, rowHeight - 8, bgColor, 0.75);
      listContainer.add(bg);

      const iconX = iconFrameSize / 2 + 10;
      const iconY = rowY;

      if (this.textures.exists(row.item.icon)) {
        const iconImage = this.add.image(iconX, iconY, row.item.icon).setScale(iconScale).setDepth(2);
        listContainer.add(iconImage);
      }

      if (row.isChild) {
        const cost = row.item.cost ?? 0;
        const nameText = row.item.name.toUpperCase();
        const nameX = iconX + iconFrameSize / 2 + 20;
        
        const childName = this.add.bitmapText(nameX, rowY, 'clicker', nameText, 10)
          .setOrigin(0, 0.5)
          .setMaxWidth(width - iconFrameSize - 90);
        const childCost = this.add.bitmapText(width - 12, rowY, 'clicker', `${cost}Q`, 10)
          .setOrigin(1, 0.5);
        listContainer.add([childName, childCost]);
      } else {
        const textX = iconX + iconFrameSize / 2 + 20;
        const title = this.add.bitmapText(textX, rowY, 'clicker', row.item.name.toUpperCase(), 11)
          .setOrigin(0, 0.5);
        listContainer.add(title);
      }
    });

    container.add(listContainer);

    const listContentHeight = rows.length * rowHeight;
    let scrollOffset = 0;
    const minOffset = Math.min(0, height - listContentHeight);

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _go: any, _dx: number, dy: number) => {
      if (listContentHeight <= height) return;
      scrollOffset = Math.max(minOffset, Math.min(0, scrollOffset - dy * 0.4));
      listContainer.y = listTop + scrollOffset;
    });
  }

  private getLeafItems(item: MenuItem): MenuItem[] {
    if (!item.children || item.children.length === 0) {
      return [item];
    }
    return item.children.flatMap(child => this.getLeafItems(child));
  }

  private buildSettingsContent(container: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number): void {
    const settingsManager = SettingsManager.getInstance();
    const currentSettings = settingsManager.getDialSettings();
    
    let dialX = currentSettings.offsetX;
    let dialY = currentSettings.offsetY;
    let showOutline = currentSettings.showOutline ?? false;

    const contentX = x - width / 2 + 12;
    const contentStartY = y;
    const lineSpacing = 20;

    // Section: Dial Position
    const dialPosTitle = this.add.bitmapText(contentX, contentStartY, 'clicker', 'DIAL POSITION', 12)
      .setOrigin(0, 0);
    container.add(dialPosTitle);

    // Horizontal controls
    const hLabelY = contentStartY + lineSpacing * 1.5;
    const hLabel = this.add.bitmapText(contentX, hLabelY, 'clicker', 'HORIZONTAL', 11)
      .setOrigin(0, 0.5);
    container.add(hLabel);

    const hValueText = this.add.bitmapText(contentX + 110, hLabelY, 'clicker', `${dialX}`, 11)
      .setOrigin(0, 0.5);
    container.add(hValueText);

    const hLeftBtn = this.add.rectangle(contentX + 80, hLabelY, 18, 16, Colors.PANEL_DARK, 0.8);
    hLeftBtn.setStrokeStyle(1, Colors.BORDER_BLUE);
    hLeftBtn.setInteractive();
    hLeftBtn.on('pointerdown', () => {
      dialX = Math.max(-400, dialX - 10);
      hValueText.setText(`${dialX}`);
    });
    hLeftBtn.on('pointerover', () => hLeftBtn.setFillStyle(Colors.BUTTON_HOVER, 0.9));
    hLeftBtn.on('pointerout', () => hLeftBtn.setFillStyle(Colors.PANEL_DARK, 0.8));
    container.add(hLeftBtn);
    container.add(this.add.bitmapText(contentX + 80, hLabelY, 'clicker', '◀', 8).setOrigin(0.5));

    const hRightBtn = this.add.rectangle(contentX + 135, hLabelY, 18, 16, Colors.PANEL_DARK, 0.8);
    hRightBtn.setStrokeStyle(1, Colors.BORDER_BLUE);
    hRightBtn.setInteractive();
    hRightBtn.on('pointerdown', () => {
      dialX = Math.min(-50, dialX + 10);
      hValueText.setText(`${dialX}`);
    });
    hRightBtn.on('pointerover', () => hRightBtn.setFillStyle(Colors.BUTTON_HOVER, 0.9));
    hRightBtn.on('pointerout', () => hRightBtn.setFillStyle(Colors.PANEL_DARK, 0.8));
    container.add(hRightBtn);
    container.add(this.add.bitmapText(contentX + 135, hLabelY, 'clicker', '▶', 8).setOrigin(0.5));

    // Vertical controls
    const vLabelY = contentStartY + lineSpacing * 3;
    const vLabel = this.add.bitmapText(contentX, vLabelY, 'clicker', 'VERTICAL', 11)
      .setOrigin(0, 0.5);
    container.add(vLabel);

    const vValueText = this.add.bitmapText(contentX + 110, vLabelY, 'clicker', `${dialY}`, 11)
      .setOrigin(0, 0.5);
    container.add(vValueText);

    const vUpBtn = this.add.rectangle(contentX + 80, vLabelY, 18, 16, Colors.PANEL_DARK, 0.8);
    vUpBtn.setStrokeStyle(1, Colors.BORDER_BLUE);
    vUpBtn.setInteractive();
    vUpBtn.on('pointerdown', () => {
      dialY = Math.max(-400, dialY - 10);
      vValueText.setText(`${dialY}`);
    });
    vUpBtn.on('pointerover', () => vUpBtn.setFillStyle(Colors.BUTTON_HOVER, 0.9));
    vUpBtn.on('pointerout', () => vUpBtn.setFillStyle(Colors.PANEL_DARK, 0.8));
    container.add(vUpBtn);
    container.add(this.add.bitmapText(contentX + 80, vLabelY, 'clicker', '▲', 8).setOrigin(0.5));

    const vDnBtn = this.add.rectangle(contentX + 135, vLabelY, 18, 16, Colors.PANEL_DARK, 0.8);
    vDnBtn.setStrokeStyle(1, Colors.BORDER_BLUE);
    vDnBtn.setInteractive();
    vDnBtn.on('pointerdown', () => {
      dialY = Math.min(-50, dialY + 10);
      vValueText.setText(`${dialY}`);
    });
    vDnBtn.on('pointerover', () => vDnBtn.setFillStyle(Colors.BUTTON_HOVER, 0.9));
    vDnBtn.on('pointerout', () => vDnBtn.setFillStyle(Colors.PANEL_DARK, 0.8));
    container.add(vDnBtn);
    container.add(this.add.bitmapText(contentX + 135, vLabelY, 'clicker', '▼', 8).setOrigin(0.5));

    // Show Outline toggle
    const outlineLabelY = contentStartY + lineSpacing * 4.5;
    const outlineLabel = this.add.bitmapText(contentX, outlineLabelY, 'clicker', 'SHOW OUTLINE', 11)
      .setOrigin(0, 0.5);
    container.add(outlineLabel);

    const toggleBtn = this.add.rectangle(contentX + 110, outlineLabelY, 40, 14, showOutline ? Colors.SLICE_HIGHLIGHTED : Colors.PANEL_DARK, 0.8);
    toggleBtn.setStrokeStyle(1, Colors.BORDER_BLUE);
    toggleBtn.setInteractive();
    const toggleText = this.add.bitmapText(contentX + 110, outlineLabelY, 'clicker', showOutline ? 'ON' : 'OFF', 9)
      .setOrigin(0.5);
    container.add(toggleBtn);
    container.add(toggleText);

    toggleBtn.on('pointerdown', () => {
      showOutline = !showOutline;
      toggleBtn.setFillStyle(showOutline ? Colors.SLICE_HIGHLIGHTED : Colors.PANEL_DARK, 0.8);
      toggleText.setText(showOutline ? 'ON' : 'OFF');
    });
    toggleBtn.on('pointerover', () => toggleBtn.setFillStyle(showOutline ? Colors.SLICE_HIGHLIGHTED : Colors.BUTTON_HOVER, 0.9));
    toggleBtn.on('pointerout', () => toggleBtn.setFillStyle(showOutline ? Colors.SLICE_HIGHLIGHTED : Colors.PANEL_DARK, 0.8));

    // Action buttons
    const buttonY = contentStartY + height - 24;
    const resetBtn = this.add.rectangle(contentX + 20, buttonY, 50, 18, Colors.PANEL_DARK, 0.8);
    resetBtn.setStrokeStyle(1, Colors.BORDER_BLUE);
    resetBtn.setInteractive();
    resetBtn.on('pointerdown', () => {
      dialX = -200;
      dialY = -150;
      hValueText.setText(`${dialX}`);
      vValueText.setText(`${dialY}`);
    });
    resetBtn.on('pointerover', () => resetBtn.setFillStyle(Colors.BUTTON_HOVER, 0.9));
    resetBtn.on('pointerout', () => resetBtn.setFillStyle(Colors.PANEL_DARK, 0.8));
    container.add(resetBtn);
    container.add(this.add.bitmapText(contentX + 20, buttonY, 'clicker', 'RESET', 9).setOrigin(0.5));

    const saveBtn = this.add.rectangle(contentX + 85, buttonY, 50, 18, Colors.PANEL_DARK, 0.8);
    saveBtn.setStrokeStyle(1, Colors.BORDER_BLUE);
    saveBtn.setInteractive();
    saveBtn.on('pointerdown', () => {
      settingsManager.updateDialPosition(dialX, dialY);
      settingsManager.updateDialOutline(showOutline);
      try {
        const settings = settingsManager.getSettings();
        localStorage.setItem('clicker-shipper-settings', JSON.stringify(settings));
      } catch (error) {
        console.error('Failed to save settings:', error);
      }
    });
    saveBtn.on('pointerover', () => saveBtn.setFillStyle(Colors.BUTTON_HOVER, 0.9));
    saveBtn.on('pointerout', () => saveBtn.setFillStyle(Colors.PANEL_DARK, 0.8));
    container.add(saveBtn);
    container.add(this.add.bitmapText(contentX + 85, buttonY, 'clicker', 'SAVE', 9).setOrigin(0.5));
  }

  private buildOrderContent(container: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number, order: Order): Array<{ x: number; y: number; size: number; slotBg: Phaser.GameObjects.Graphics; expectedIconKey: string }> {
    const contentX = x - width / 2 + 12;
    const rightEdge = x + width / 2 - 12;
    const contentBottom = y + height;

    // Build expected sequence: expand each requirement into individual icon slots
    const expectedSequence: string[] = [];
    order.requirements.forEach(req => {
      for (let i = 0; i < req.quantity; i++) expectedSequence.push(req.iconKey);
    });

    // ── Fulfillment box row (bottom of panel) ──────────────────────────────
    const totalQty = order.requirements.reduce((sum, req) => sum + req.quantity, 0);
    const boxRowHeight = 52;
    const boxGap = 5;
    const boxSize = Math.min(40, Math.floor((width - 16 - (totalQty - 1) * boxGap) / totalQty));
    const rowTotalWidth = totalQty * boxSize + (totalQty - 1) * boxGap;
    const boxRowTop = contentBottom - boxRowHeight;
    const boxRowCenterY = boxRowTop + boxRowHeight / 2;
    const boxStartX = x - rowTotalWidth / 2;

    // Row background strip
    const rowStripBg = this.add.graphics();
    rowStripBg.fillStyle(0x071428, 0.9);
    rowStripBg.fillRect(x - width / 2 + 4, boxRowTop, width - 8, boxRowHeight);
    rowStripBg.lineStyle(1, Colors.BORDER_BLUE, 0.6);
    rowStripBg.strokeRect(x - width / 2 + 4, boxRowTop, width - 8, boxRowHeight);
    container.add(rowStripBg);

    // One box per total quantity unit
    const slots: Array<{ x: number; y: number; size: number; slotBg: Phaser.GameObjects.Graphics; expectedIconKey: string }> = [];
    for (let i = 0; i < totalQty; i++) {
      const bx = boxStartX + i * (boxSize + boxGap) + boxSize / 2;
      const boxBg = this.add.graphics();
      boxBg.fillStyle(Colors.PANEL_MEDIUM, 0.8);
      boxBg.fillRect(bx - boxSize / 2, boxRowCenterY - boxSize / 2, boxSize, boxSize);
      boxBg.lineStyle(1, Colors.BORDER_BLUE, 0.7);
      boxBg.strokeRect(bx - boxSize / 2, boxRowCenterY - boxSize / 2, boxSize, boxSize);
      container.add(boxBg);
      slots.push({ x: bx, y: boxRowCenterY, size: boxSize, slotBg: boxBg, expectedIconKey: expectedSequence[i] ?? '' });
    }

    // Separator above box row
    const aboveBoxSep = this.add.graphics();
    aboveBoxSep.lineStyle(1, Colors.BORDER_BLUE, 0.7);
    aboveBoxSep.lineBetween(x - width / 2 + 8, boxRowTop, x + width / 2 - 8, boxRowTop);
    container.add(aboveBoxSep);

    // ── Order list: anchored just above the box row ────────────────────────
    const rowHeight = 48;
    const rowPadding = 4;
    const fontSize = 12;
    const detailFontSize = 10;
    const qtyFontSize = Math.round(detailFontSize * (4 / 3)); // ~13
    const budgetLineHeight = 28;
    const orderListHeight = order.requirements.length * rowHeight + budgetLineHeight;
    // Anchor list bottom to just above the box row
    const orderListBottom = boxRowTop - 10;
    const orderListTop = orderListBottom - orderListHeight;

    order.requirements.forEach((req, index) => {
      const rowTop = orderListTop + index * rowHeight;

      // Alternating row background
      const rowBg = this.add.graphics();
      const bgColor = index % 2 === 0 ? 0x112244 : 0x0d1a35;
      rowBg.fillStyle(bgColor, 0.6);
      rowBg.fillRect(x - width / 2 + 4, rowTop + rowPadding / 2, width - 8, rowHeight - rowPadding);
      container.add(rowBg);

      // Line 1: hash-sign bullet + item name
      const nameLine1Y = rowTop + rowPadding + fontSize / 2 + 2;

      if (this.textures.exists('hash-sign')) {
        const bullet = this.add.image(contentX + 4, nameLine1Y, 'hash-sign');
        bullet.setScale(0.45);
        bullet.setOrigin(0, 0.5);
        container.add(bullet);
      }

      const nameText = this.add.bitmapText(contentX + 16, nameLine1Y, 'clicker', req.itemName.toUpperCase(), fontSize)
        .setOrigin(0, 0.5)
        .setMaxWidth(width - 30);
      container.add(nameText);

      // Line 2: qty left, cost right
      const detailY = nameLine1Y + fontSize + 4;

      const qtyText = this.add.bitmapText(contentX + 16, detailY, 'clicker', `X${req.quantity}`, qtyFontSize)
        .setOrigin(0, 0.5)
        .setTint(0xaaaacc);
      container.add(qtyText);

      const itemCost = `${req.cost * req.quantity}Q`;
      const costText = this.add.bitmapText(rightEdge, detailY, 'clicker', itemCost, detailFontSize)
        .setOrigin(1, 0.5)
        .setTint(Colors.HIGHLIGHT_YELLOW);
      container.add(costText);

      // Thin separator between items (not after last)
      if (index < order.requirements.length - 1) {
        const sepY = rowTop + rowHeight - rowPadding / 2;
        const sep = this.add.graphics();
        sep.lineStyle(1, Colors.BORDER_BLUE, 0.3);
        sep.lineBetween(x - width / 2 + 8, sepY, x + width / 2 - 8, sepY);
        container.add(sep);
      }
    });

    // Total budget line directly below requirements, above box row
    const budgetY = orderListTop + order.requirements.length * rowHeight;

    const separatorLine = this.add.graphics();
    separatorLine.lineStyle(1, Colors.BORDER_BLUE, 0.7);
    separatorLine.lineBetween(x - width / 2 + 8, budgetY, x + width / 2 - 8, budgetY);
    container.add(separatorLine);

    const budgetLabel = this.add.bitmapText(contentX, budgetY + budgetLineHeight / 2, 'clicker', 'TOTAL BUDGET', fontSize)
      .setOrigin(0, 0.5);
    container.add(budgetLabel);

    const budgetValue = this.add.bitmapText(rightEdge, budgetY + budgetLineHeight / 2, 'clicker', `${order.budget}Q`, fontSize + 1)
      .setOrigin(1, 0.5)
      .setTint(Colors.HIGHLIGHT_YELLOW_BRIGHT);
    container.add(budgetValue);

    return slots;
  }

  update(_time: number, _delta: number) {
    // Update shift timer display
  }

  onOrderComplete() {
    // Validate order is within budget
    // Load next order
    // Reset dial to first level
    if (this.radialDial) {
      this.radialDial.reset();
    }
    // If no more orders, end shift
  }

  endShift() {
    // this.scene.start('GameOver', { stats });
  }

  shutdown() {
    if (this.radialDial) {
      this.radialDial.destroy();
    }
  }
}