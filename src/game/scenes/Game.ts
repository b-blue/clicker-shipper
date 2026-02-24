import { RadialDial } from "../ui/RadialDial";
import { GameManager } from "../managers/GameManager";
import { SettingsManager } from "../managers/SettingsManager";
import {
  ProgressionManager,
  ALL_CATEGORY_IDS,
} from "../managers/ProgressionManager";
import { AssetLoader } from "../managers/AssetLoader";
import { Colors } from "../constants/Colors";
import {
  generateOrder as buildOrder,
  getCatalogRows,
} from "../utils/OrderUtils";
import { MenuItem, Order } from "../types/GameTypes";

export class Game extends Phaser.Scene {
  private radialDial: RadialDial | null = null;
  private ordersContainer: Phaser.GameObjects.Container | null = null;
  private fulfillmentSlots: Array<{
    x: number;
    y: number;
    size: number;
    slotBg: Phaser.GameObjects.Graphics;
    expectedIconKey: string;
  }> = [];
  private fulfillmentImages: Array<{
    img: Phaser.GameObjects.Image | null;
    iconKey: string;
  } | null> = [];
  private fulfillmentOrderIconCounts: Map<string, number> = new Map();
  private shiftRevenue: number = 0;
  private shiftBonus: number = 0;
  private currentOrder: Order | null = null;
  private ordersPanelX: number = 0;
  private ordersPanelWidth: number = 0;
  private ordersPanelTop: number = 0;
  private ordersPanelHeight: number = 0;
  private revenueText: Phaser.GameObjects.BitmapText | null = null;
  private bonusText: Phaser.GameObjects.BitmapText | null = null;
  private switchToOrdersTab: (() => void) | null = null;
  private switchToCatalogTab: (() => void) | null = null;
  private shiftArcGraphic: Phaser.GameObjects.Graphics | null = null;
  private shiftTimerEvent: Phaser.Time.TimerEvent | null = null;
  private shiftStartTime: number = 0;
  private shiftDurationMs: number = 300000;
  private shiftTimerX: number = 0;
  private shiftTimerY: number = 0;
  private readonly shiftTimerRadius: number = 12;

  // Corner button state
  private cornerCurrentDepth: number = 0;
  private cornerIsTerminal: boolean = false;
  private cornerActiveCategoryItem: any = null;
  // Corner badge (lower-right): level indicator
  private cornerLevelBg: Phaser.GameObjects.Graphics | null = null;
  private cornerLevelIcon: Phaser.GameObjects.Image | null = null;
  private cornerLevelLabel: Phaser.GameObjects.BitmapText | null = null;
  // Corner catalog button (upper-right)
  private cornerCatalogBg: Phaser.GameObjects.Graphics | null = null;
  private cornerCatalogLabel: Phaser.GameObjects.BitmapText | null = null;
  // Catalog scroll state (populated inside buildCatalogContent)
  private catalogListContainer: Phaser.GameObjects.Container | null = null;
  private catalogListTop: number = 0;
  private catalogPanelHeight: number = 0;
  private catalogRowHeight: number = 60;
  private catalogListContentHeight: number = 0;
  private catalogRowCategoryIds: string[] = [];

  constructor() {
    super("Game");
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
      const dialRadius = dialSettings.radius ?? 150;

      // Background
      this.add.rectangle(
        gameWidth / 2,
        gameHeight / 2,
        gameWidth,
        gameHeight,
        Colors.BACKGROUND_DARK,
      );

      // Tab dimensions — computed first so panel width can account for them
      const tabWidth = 52;
      const tabHeight = 40;
      const tabSpacing = 6;
      const tabGap = 8; // gap between panel right edge and tabs

      // Central display panel (tall, from top to above dial)
      // Reserve space for tabs so they're never clipped on narrow screens
      const panelWidth = Math.min(420, gameWidth - tabWidth - tabGap - 20);
      const panelTop = 20;
      const panelBottom = dialY - dialRadius - 20;
      const panelHeight = panelBottom - panelTop;
      const panelX = 10 + panelWidth / 2; // left-align with menu button left edge
      const panelY = (panelTop + panelBottom) / 2;

      const mainPanel = this.add.rectangle(
        panelX,
        panelY,
        panelWidth,
        panelHeight,
        Colors.PANEL_DARK,
        0.85,
      );
      mainPanel.setStrokeStyle(2, Colors.BORDER_BLUE, 0.8);

      // Panel title — vertically centered in the header bar (panelTop → panelTop+42)
      const titleY = panelTop + 21;
      const panelTitle = this.add
        .bitmapText(panelX, titleY, "clicker", "ORDERS", 14)
        .setOrigin(0.5);

      // Shift timer arc — left side of the header bar, vertically centered with title
      const timerR = this.shiftTimerRadius;
      const timerX = panelX - panelWidth / 2 + timerR + 8;
      const timerY = titleY;
      this.shiftTimerX = timerX;
      this.shiftTimerY = timerY;
      this.shiftDurationMs = settingsManager.getShiftDurationMs();
      const timerBg = this.add.graphics();
      timerBg.fillStyle(Colors.PANEL_MEDIUM, 1);
      timerBg.fillCircle(timerX, timerY, timerR);
      timerBg.lineStyle(1, Colors.BORDER_BLUE, 0.7);
      timerBg.strokeCircle(timerX, timerY, timerR);
      this.shiftArcGraphic = this.add.graphics();
      this.shiftStartTime = Date.now();
      this.shiftTimerEvent = this.time.addEvent({
        delay: this.shiftDurationMs,
        callback: this.endShift,
        callbackScope: this,
      });

      // Stats bar — persistent revenue & bonus tallies across orders
      const statsContainer = this.add.container(0, 0);
      const statsBarDivTop = this.add.graphics();
      statsBarDivTop.lineStyle(1, Colors.BORDER_BLUE, 0.45);
      statsBarDivTop.lineBetween(
        panelX - panelWidth / 2 + 8,
        panelTop + 42,
        panelX + panelWidth / 2 - 8,
        panelTop + 42,
      );
      const statsY = panelTop + 54;
      const statsLeft = panelX - panelWidth / 2 + 14;
      const revLabel = this.add
        .bitmapText(statsLeft, statsY, "clicker", "REV", 12)
        .setOrigin(0, 0.5)
        .setTint(0xaaaacc);
      this.revenueText = this.add
        .bitmapText(statsLeft + 38, statsY, "clicker", "Q0", 12)
        .setOrigin(0, 0.5)
        .setTint(Colors.HIGHLIGHT_YELLOW_BRIGHT);
      const bonusLabel = this.add
        .bitmapText(panelX + 4, statsY, "clicker", "BONUS", 12)
        .setOrigin(0, 0.5)
        .setTint(0xaaaacc);
      this.bonusText = this.add
        .bitmapText(panelX + 68, statsY, "clicker", "Q0", 12)
        .setOrigin(0, 0.5)
        .setTint(Colors.HIGHLIGHT_YELLOW);
      const statsBarDivBot = this.add.graphics();
      statsBarDivBot.lineStyle(1, Colors.BORDER_BLUE, 0.45);
      statsBarDivBot.lineBetween(
        panelX - panelWidth / 2 + 8,
        panelTop + 66,
        panelX + panelWidth / 2 - 8,
        panelTop + 66,
      );
      statsContainer.add([
        statsBarDivTop,
        revLabel,
        this.revenueText,
        bonusLabel,
        this.bonusText,
        statsBarDivBot,
      ]);

      // Tabbed panel controls (right-hand vertical tabs)
      const tabX = panelX + panelWidth / 2 + tabGap + tabWidth / 2;
      const tabStartY = panelTop + tabHeight / 2 + 4;
      const tabKeys = ["ORDERS", "SETTINGS", "CATALOG"] as const;
      // Content containers for each tab
      this.ordersContainer = this.add.container(0, 0);
      const settingsContainer = this.add.container(0, 0);
      const catalogContainer = this.add.container(0, 0);

      const containers = {
        ORDERS: this.ordersContainer,
        SETTINGS: settingsContainer,
        CATALOG: catalogContainer,
      };

      // Store panel geometry for order rebuilding
      this.ordersPanelX = panelX;
      this.ordersPanelWidth = panelWidth;
      this.ordersPanelTop = panelTop;
      this.ordersPanelHeight = panelHeight;

      // Generate and display current order
      const currentOrder = buildOrder(items);
      this.currentOrder = currentOrder;
      this.fulfillmentSlots = this.buildOrderContent(
        this.ordersContainer,
        panelX,
        panelTop + 62,
        panelWidth - 20,
        panelHeight - 76,
        currentOrder,
      );
      this.fulfillmentImages = new Array(this.fulfillmentSlots.length).fill(
        null,
      );
      this.fulfillmentOrderIconCounts = new Map<string, number>();
      currentOrder.requirements.forEach((r) => {
        this.fulfillmentOrderIconCounts.set(
          r.iconKey,
          (this.fulfillmentOrderIconCounts.get(r.iconKey) ?? 0) + r.quantity,
        );
      });

      // Settings tab: button to launch DialCalibration scene
      this.buildSettingsContent(settingsContainer, panelX, panelWidth);
      settingsContainer.setVisible(false);
      this.buildCatalogContent(
        catalogContainer,
        panelX,
        panelTop + 36,
        panelWidth - 20,
        panelHeight - 50,
        items,
      );
      catalogContainer.setVisible(false);

      const updateTabDisplay = (label: (typeof tabKeys)[number]) => {
        panelTitle.setText(label);
        statsContainer.setVisible(label === "ORDERS");
        Object.keys(containers).forEach((key) => {
          containers[key as (typeof tabKeys)[number]].setVisible(key === label);
        });
      };
      this.switchToOrdersTab = () => updateTabDisplay("ORDERS");
      this.switchToCatalogTab = () => updateTabDisplay("CATALOG");

      tabKeys.forEach((label, index) => {
        const tabY = tabStartY + index * (tabHeight + tabSpacing);
        const tabBg = this.add.rectangle(
          tabX,
          tabY,
          tabWidth,
          tabHeight,
          Colors.PANEL_DARK,
          0.9,
        );
        tabBg.setStrokeStyle(2, Colors.BORDER_BLUE, 0.8);
        tabBg.setInteractive();
        tabBg.on("pointerdown", () => updateTabDisplay(label));
        tabBg.on("pointerover", () =>
          tabBg.setFillStyle(Colors.BUTTON_HOVER, 0.95),
        );
        tabBg.on("pointerout", () =>
          tabBg.setFillStyle(Colors.PANEL_DARK, 0.9),
        );

        const tabIcon = this.add
          .bitmapText(tabX, tabY, "clicker", label[0], 16)
          .setOrigin(0.5);
        tabIcon.setTint(Colors.HIGHLIGHT_YELLOW);
      });

      // Menu button (bottom left)
      const menuX = 80;
      const menuY = gameHeight - 40;
      const menuWidth = 140;
      const menuHeight = 34;
      const menuBg = this.add.rectangle(
        menuX,
        menuY,
        menuWidth,
        menuHeight,
        Colors.PANEL_DARK,
        0.9,
      );
      menuBg.setStrokeStyle(2, Colors.HIGHLIGHT_YELLOW);
      menuBg.setInteractive();
      menuBg.on("pointerdown", () => this.scene.start("MainMenu"));
      menuBg.on("pointerover", () =>
        menuBg.setFillStyle(Colors.BUTTON_HOVER, 0.95),
      );
      menuBg.on("pointerout", () =>
        menuBg.setFillStyle(Colors.PANEL_DARK, 0.9),
      );
      this.add.bitmapText(menuX, menuY, "clicker", "MENU", 13).setOrigin(0.5);

      // Build 6-slot A-level dial: unlocked categories in unlock order, padded with locked placeholders
      const progression = ProgressionManager.getInstance();
      const unlockedCats = progression.getUnlockedCategories();
      const dialRootItems: MenuItem[] = unlockedCats
        .map(({ categoryId }) => {
          const found = (items as any[]).find(
            (it: any) => it.id === categoryId,
          );
          return found as MenuItem;
        })
        .filter(Boolean) as MenuItem[];

      // Pad remaining slots (up to 6) with locked placeholders
      const totalDialSlots = ALL_CATEGORY_IDS.length;
      const lockedSlotCount = totalDialSlots - dialRootItems.length;
      for (let i = 0; i < lockedSlotCount; i++) {
        dialRootItems.push({
          id: `locked_slot_${i}`,
          name: "LOCKED",
          icon: "skill-blocked",
          layers: [
            { texture: "skill-blocked", depth: 3 },
            { texture: "frame", depth: 2 },
          ],
        });
      }

      this.radialDial = new RadialDial(this, dialX, dialY, dialRootItems);
      this.createCornerButtons(dialX, dialY, dialRadius);

      // ── Purge any stale handlers from a previous shift ──────────────────────
      // Phaser 3 never calls the user-defined shutdown() method — it only calls
      // init(), preload(), create(), and update() directly. Because scene.events
      // is the same EventEmitter instance across scene restarts, every call to
      // create() stacks a new anonymous handler on top of any surviving ones.
      // Clearing before re-registering makes the handler count exactly 1
      // regardless of how many times the scene has been started.
      this.events.removeAllListeners("dial:itemConfirmed");
      this.events.removeAllListeners("dial:actionConfirmed");
      this.events.removeAllListeners("dial:levelChanged");
      this.events.removeAllListeners("dial:goBack");

      // Listen for item confirmation — show terminal action dial
      this.events.on("dial:itemConfirmed", (data: { item: any }) => {
        if (this.radialDial) {
          this.radialDial.showTerminalDial(data.item);
        }
        // Hide catalog button while terminal dial is active (badge stays)
        this.cornerIsTerminal = true;
        this.updateCornerButtons();
      });

      // Listen for terminal action selection
      this.events.on(
        "dial:actionConfirmed",
        (data: { action: string; item: any }) => {
          const iconKey: string = data.item.icon || data.item.id;

          if (data.action === "send" && this.ordersContainer) {
            // Place icon in the first empty slot
            const slotIndex = this.fulfillmentImages.findIndex(
              (s) => s === null,
            );
            if (slotIndex !== -1) {
              const slot = this.fulfillmentSlots[slotIndex];
              let img: Phaser.GameObjects.Image | null = null;
              if (AssetLoader.textureExists(this, iconKey)) {
                img = AssetLoader.createImage(this, slot.x, slot.y, iconKey);
                img.setDisplaySize(slot.size - 6, slot.size - 6);
                this.ordersContainer.add(img);
              }
              // Always record the slot as occupied so the next send picks the next slot
              this.fulfillmentImages[slotIndex] = { img, iconKey };
              // Color the slot bg: green = correct position, yellow = wrong position but in order
              const isCorrect = slot.expectedIconKey === iconKey;
              // Count how many of this icon were already placed before this slot
              const alreadySent = this.fulfillmentImages.filter(
                (e, i) => i !== slotIndex && e?.iconKey === iconKey,
              ).length;
              const isPresent =
                alreadySent <
                (this.fulfillmentOrderIconCounts.get(iconKey) ?? 0);
              const bgFill = isCorrect
                ? 0x003a1a
                : isPresent
                  ? 0x3a3000
                  : 0x3a0008;
              const bgStroke = isCorrect
                ? 0x00e84a
                : isPresent
                  ? 0xffd700
                  : 0xff2244;
              slot.slotBg.clear();
              slot.slotBg.fillStyle(bgFill, 0.85);
              slot.slotBg.fillRect(
                slot.x - slot.size / 2,
                slot.y - slot.size / 2,
                slot.size,
                slot.size,
              );
              slot.slotBg.lineStyle(2, bgStroke, 0.95);
              slot.slotBg.strokeRect(
                slot.x - slot.size / 2,
                slot.y - slot.size / 2,
                slot.size,
                slot.size,
              );
            }
            this.checkOrderComplete();
          } else if (data.action === "recall" && this.ordersContainer) {
            // Find the rightmost filled slot containing this icon and remove it
            let lastMatch = -1;
            for (let i = this.fulfillmentImages.length - 1; i >= 0; i--) {
              if (this.fulfillmentImages[i]?.iconKey === iconKey) {
                lastMatch = i;
                break;
              }
            }
            if (lastMatch !== -1) {
              this.fulfillmentImages[lastMatch]?.img?.destroy();
              this.fulfillmentImages[lastMatch] = null;
              // Revert slot bg to neutral
              const slot = this.fulfillmentSlots[lastMatch];
              slot.slotBg.clear();
              slot.slotBg.fillStyle(Colors.PANEL_MEDIUM, 0.8);
              slot.slotBg.fillRect(
                slot.x - slot.size / 2,
                slot.y - slot.size / 2,
                slot.size,
                slot.size,
              );
              slot.slotBg.lineStyle(1, Colors.BORDER_BLUE, 0.7);
              slot.slotBg.strokeRect(
                slot.x - slot.size / 2,
                slot.y - slot.size / 2,
                slot.size,
                slot.size,
              );
            }
            // If no match, dial already reset to A-level — nothing to do
          }
          // After an action, RadialDial.reset() returns the dial to A-level
          this.cornerCurrentDepth = 0;
          this.cornerIsTerminal = false;
          this.cornerActiveCategoryItem = null;
          this.updateCornerButtons();
        },
      );

      // Listen for level changes (when drilling into sub-items)
      // Note: RadialDial emits { depth, item } (not 'level')
      this.events.on(
        "dial:levelChanged",
        (data: { depth: number; item: any }) => {
          this.cornerCurrentDepth = data.depth;
          this.cornerIsTerminal = false;
          // Only store the category item at B-level (depth 1) so the badge
          // always shows the root-category icon regardless of drill depth.
          if (data.depth === 1) {
            this.cornerActiveCategoryItem = data.item;
          }
          this.updateCornerButtons();
        },
      );

      // Listen for going back (tap center to return to root)
      this.events.on("dial:goBack", () => {
        if (this.cornerIsTerminal) {
          // Returning from terminal dial — still at the same depth (not A)
          this.cornerIsTerminal = false;
        } else {
          this.cornerCurrentDepth = Math.max(0, this.cornerCurrentDepth - 1);
          if (this.cornerCurrentDepth === 0) this.cornerActiveCategoryItem = null;
        }
        this.updateCornerButtons();
      });

      // Wire up shutdown() so the timer and radialDial are actually cleaned up.
      // Phaser emits a 'shutdown' event on scene.events when stopping a scene;
      // without registering here, shutdown() is never invoked.
      this.events.once("shutdown", this.shutdown, this);
    } catch (error) {
      console.error("Error creating Game scene:", error);
      this.add.bitmapText(50, 50, "clicker", "ERROR LOADING GAME DATA", 20);
    }
  }

  update(): void {
    if (!this.shiftArcGraphic || this.shiftDurationMs <= 0) return;
    const elapsed = Date.now() - this.shiftStartTime;
    const fraction = Math.min(1, elapsed / this.shiftDurationMs);
    const r = this.shiftTimerRadius;
    this.shiftArcGraphic.clear();
    if (fraction > 0) {
      this.shiftArcGraphic.fillStyle(0x00e84a, 0.85);
      this.shiftArcGraphic.slice(
        this.shiftTimerX,
        this.shiftTimerY,
        r,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * fraction,
        false,
      );
      this.shiftArcGraphic.fillPath();
    }
  }

  private buildCatalogContent(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    height: number,
    items: any,
  ): void {
    const catalogCategories = getCatalogRows(items);
    const listLeft = x - width / 2;
    const listTop = y;
    const rowHeight = 60;
    const iconFrameSize = 48;
    const iconScale = 1.3;

    // Store scroll state on the instance so scrollCatalogToCategory() can use it
    this.catalogListTop = listTop;
    this.catalogRowHeight = rowHeight;
    this.catalogPanelHeight = height;

    const listContainer = this.add.container(listLeft, listTop);
    this.catalogListContainer = listContainer;
    const maskGraphic = this.add.graphics();
    maskGraphic.fillStyle(0xffffff, 1);
    maskGraphic.fillRect(listLeft, listTop, width, height);
    listContainer.setMask(maskGraphic.createGeometryMask());
    maskGraphic.setVisible(false);

    // Flatten categories into display rows: header row then one row per item
    type DisplayRow = { item: MenuItem; isHeader: boolean };
    const rows: DisplayRow[] = [];
    const rowCatIds: string[] = [];
    catalogCategories.forEach(({ category, items: catItems }) => {
      rows.push({ item: category, isHeader: true });
      rowCatIds.push(category.id);
      catItems.forEach((item) => {
        rows.push({ item, isHeader: false });
        rowCatIds.push(category.id);
      });
    });
    this.catalogRowCategoryIds = rowCatIds;

    rows.forEach((row, index) => {
      const rowY = index * rowHeight + rowHeight / 2;
      const bgColor = index % 2 === 0 ? Colors.PANEL_DARK : Colors.PANEL_MEDIUM;

      const bg = this.add.rectangle(
        width / 2,
        rowY,
        width,
        rowHeight - 8,
        bgColor,
        0.75,
      );
      listContainer.add(bg);

      const iconX = iconFrameSize / 2 + 10;
      const iconY = rowY;

      // Draw icon frame background (all rows) then icon on top
      if (row.isHeader) {
        const frameBg = this.add.graphics();
        frameBg.fillStyle(Colors.PANEL_MEDIUM, 1);
        frameBg.fillRect(
          iconX - iconFrameSize / 2 + 2,
          iconY - iconFrameSize / 2 + 2,
          iconFrameSize - 4,
          iconFrameSize - 4,
        );
        frameBg.lineStyle(2, Colors.BORDER_BLUE, 0.9);
        frameBg.strokeRect(
          iconX - iconFrameSize / 2 + 2,
          iconY - iconFrameSize / 2 + 2,
          iconFrameSize - 4,
          iconFrameSize - 4,
        );
        listContainer.add(frameBg);
      }

      if (AssetLoader.textureExists(this, row.item.icon)) {
        const iconImage = AssetLoader.createImage(this, iconX, iconY, row.item.icon)
          .setScale(iconScale)
          .setDepth(2);
        listContainer.add(iconImage);
      }

      if (!row.isHeader) {
        const cost = row.item.cost ?? 0;
        const nameText = row.item.name.toUpperCase();
        const nameX = iconX + iconFrameSize / 2 + 20;

        const childName = this.add
          .bitmapText(nameX, rowY, "clicker", nameText, 10)
          .setOrigin(0, 0.5)
          .setMaxWidth(width - iconFrameSize - 90);
        const childCost = this.add
          .bitmapText(width - 12, rowY, "clicker", `Q${cost}`, 10)
          .setOrigin(1, 0.5);
        listContainer.add([childName, childCost]);
      } else {
        const textX = iconX + iconFrameSize / 2 + 20;
        const title = this.add
          .bitmapText(textX, rowY, "clicker", row.item.name.toUpperCase(), 11)
          .setOrigin(0, 0.5);
        listContainer.add(title);
      }
    });

    container.add(listContainer);

    const listContentHeight = rows.length * rowHeight;
    this.catalogListContentHeight = listContentHeight;
    let scrollOffset = 0;
    const minOffset = Math.min(0, height - listContentHeight);

    // Mouse wheel scroll
    this.input.on(
      "wheel",
      (_pointer: Phaser.Input.Pointer, _go: any, _dx: number, dy: number) => {
        if (!container.visible || listContentHeight <= height) return;
        scrollOffset = Math.max(
          minOffset,
          Math.min(0, scrollOffset - dy * 0.4),
        );
        listContainer.y = listTop + scrollOffset;
      },
    );

    // Touch / pointer drag scroll
    let touchStartY = 0;
    let isTouchScrolling = false;
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!container.visible) return;
      const px = pointer.x,
        py = pointer.y;
      if (
        px >= listLeft &&
        px <= listLeft + width &&
        py >= listTop &&
        py <= listTop + height
      ) {
        touchStartY = py;
        isTouchScrolling = true;
      }
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (
        !container.visible ||
        !isTouchScrolling ||
        listContentHeight <= height
      )
        return;
      const dy = touchStartY - pointer.y;
      touchStartY = pointer.y;
      scrollOffset = Math.max(minOffset, Math.min(0, scrollOffset - dy));
      listContainer.y = listTop + scrollOffset;
    });
    this.input.on("pointerup", () => {
      isTouchScrolling = false;
    });
  }

  private buildSettingsContent(
    container: Phaser.GameObjects.Container,
    panelX: number,
    panelWidth: number,
  ): void {
    const btnW = panelWidth - 60;

    // CALIBRATE DIAL button
    const calibrateY = 120;
    const btn = this.add.rectangle(
      panelX,
      calibrateY,
      btnW,
      28,
      Colors.PANEL_DARK,
      0.9,
    );
    btn.setStrokeStyle(2, Colors.BORDER_BLUE);
    btn.setInteractive();
    btn.on("pointerdown", () => this.scene.start("DialCalibration"));
    btn.on("pointerover", () => btn.setFillStyle(Colors.BUTTON_HOVER, 0.95));
    btn.on("pointerout", () => btn.setFillStyle(Colors.PANEL_DARK, 0.9));
    const btnLabel = this.add
      .bitmapText(panelX, calibrateY, "clicker", "CALIBRATE DIAL", 11)
      .setOrigin(0.5);

    // RESET PROGRESSION button (two-tap confirmation)
    const resetY = calibrateY + 44;
    const resetBtn = this.add.rectangle(
      panelX,
      resetY,
      btnW,
      28,
      Colors.PANEL_DARK,
      0.9,
    );
    resetBtn.setStrokeStyle(2, 0xff2244);
    resetBtn.setInteractive();
    const resetLabel = this.add
      .bitmapText(panelX, resetY, "clicker", "RESET PROGRESS", 11)
      .setOrigin(0.5)
      .setTint(0xff2244);
    let resetPending = false;
    let resetTimer: Phaser.Time.TimerEvent | null = null;
    resetBtn.on("pointerdown", () => {
      if (!resetPending) {
        // First tap — enter confirmation state
        resetPending = true;
        resetLabel.setText("CONFIRM?");
        resetBtn.setFillStyle(0x3a0008, 0.95);
        resetTimer = this.time.addEvent({
          delay: 3000,
          callback: () => {
            resetPending = false;
            resetLabel.setText("RESET PROGRESS");
            resetBtn.setFillStyle(Colors.PANEL_DARK, 0.9);
          },
        });
      } else {
        // Second tap — execute reset
        resetTimer?.remove();
        ProgressionManager.getInstance().reset();
        this.scene.restart();
      }
    });
    resetBtn.on("pointerover", () =>
      resetBtn.setFillStyle(resetPending ? 0x5a0010 : 0x1a0008, 0.95),
    );
    resetBtn.on("pointerout", () =>
      resetBtn.setFillStyle(resetPending ? 0x3a0008 : Colors.PANEL_DARK, 0.9),
    );

    // Shift duration presets
    const sm = SettingsManager.getInstance();
    const durationLabelY = resetY + 52;
    const durationLbl = this.add
      .bitmapText(
        panelX - btnW / 2,
        durationLabelY,
        "clicker",
        "SHIFT DURATION",
        10,
      )
      .setOrigin(0, 0.5)
      .setTint(0xaaaacc);
    const durationPresets = [
      { label: "30 SEC", ms: 30000 },
      { label: "1 MIN", ms: 60000 },
      { label: "2 MIN", ms: 120000 },
      { label: "5 MIN", ms: 300000 },
    ];
    const presetBtnW = (btnW - 12) / 4;
    const presetY = durationLabelY + 28;
    const presetBgRefs: Array<{
      bg: Phaser.GameObjects.Rectangle;
      ms: number;
    }> = [];

    const refreshPresetStyles = () => {
      const cur = sm.getShiftDurationMs();
      for (const p of presetBgRefs) {
        const active = p.ms === cur;
        p.bg.setStrokeStyle(
          2,
          active ? Colors.NEON_BLUE : Colors.BORDER_BLUE,
          active ? 1 : 0.5,
        );
        p.bg.setFillStyle(active ? 0x0a1f3a : Colors.PANEL_DARK, 0.9);
      }
    };

    durationPresets.forEach((preset, i) => {
      const bx = panelX - btnW / 2 + i * (presetBtnW + 4) + presetBtnW / 2;
      const isActive = preset.ms === sm.getShiftDurationMs();
      const presetBg = this.add.rectangle(
        bx,
        presetY,
        presetBtnW,
        26,
        isActive ? 0x0a1f3a : Colors.PANEL_DARK,
        0.9,
      );
      presetBg.setStrokeStyle(
        2,
        isActive ? Colors.NEON_BLUE : Colors.BORDER_BLUE,
        isActive ? 1 : 0.5,
      );
      presetBg.setInteractive();
      presetBg.on("pointerdown", () => {
        sm.updateShiftDuration(preset.ms);
        this.shiftDurationMs = preset.ms;
        // Restart the running timer from now with the new duration
        this.shiftTimerEvent?.remove();
        this.shiftStartTime = Date.now();
        this.shiftTimerEvent = this.time.addEvent({
          delay: this.shiftDurationMs,
          callback: this.endShift,
          callbackScope: this,
        });
        refreshPresetStyles();
      });
      presetBg.on("pointerover", () => {
        if (preset.ms !== sm.getShiftDurationMs())
          presetBg.setFillStyle(Colors.BUTTON_HOVER, 0.6);
      });
      presetBg.on("pointerout", () => refreshPresetStyles());
      const presetLbl = this.add
        .bitmapText(bx, presetY, "clicker", preset.label, 9)
        .setOrigin(0.5);
      presetBgRefs.push({ bg: presetBg, ms: preset.ms });
      container.add([presetBg, presetLbl]);
    });

    container.add([btn, btnLabel, resetBtn, resetLabel, durationLbl]);
  }

  private buildOrderContent(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    height: number,
    order: Order,
  ): Array<{
    x: number;
    y: number;
    size: number;
    slotBg: Phaser.GameObjects.Graphics;
    expectedIconKey: string;
  }> {
    const contentX = x - width / 2 + 12;
    const rightEdge = x + width / 2 - 12;
    const contentBottom = y + height;

    // Build expected sequence: expand each requirement into individual icon slots
    const expectedSequence: string[] = [];
    order.requirements.forEach((req) => {
      for (let i = 0; i < req.quantity; i++) expectedSequence.push(req.iconKey);
    });

    // ── Fulfillment box row (bottom of panel) ──────────────────────────────
    const totalQty = order.requirements.reduce(
      (sum, req) => sum + req.quantity,
      0,
    );
    const boxRowHeight = 52;
    const boxGap = 5;
    const boxSize = Math.min(
      40,
      Math.floor((width - 16 - (totalQty - 1) * boxGap) / totalQty),
    );
    const rowTotalWidth = totalQty * boxSize + (totalQty - 1) * boxGap;
    const boxRowTop = contentBottom - boxRowHeight;
    const boxRowCenterY = boxRowTop + boxRowHeight / 2;
    const boxStartX = x - rowTotalWidth / 2;

    // Row background strip
    const rowStripBg = this.add.graphics();
    rowStripBg.fillStyle(0x071428, 0.9);
    rowStripBg.fillRect(x - width / 2 + 4, boxRowTop, width - 8, boxRowHeight);
    rowStripBg.lineStyle(1, Colors.BORDER_BLUE, 0.6);
    rowStripBg.strokeRect(
      x - width / 2 + 4,
      boxRowTop,
      width - 8,
      boxRowHeight,
    );
    container.add(rowStripBg);

    // One box per total quantity unit
    const slots: Array<{
      x: number;
      y: number;
      size: number;
      slotBg: Phaser.GameObjects.Graphics;
      expectedIconKey: string;
    }> = [];
    for (let i = 0; i < totalQty; i++) {
      const bx = boxStartX + i * (boxSize + boxGap) + boxSize / 2;
      const boxBg = this.add.graphics();
      boxBg.fillStyle(Colors.PANEL_MEDIUM, 0.8);
      boxBg.fillRect(
        bx - boxSize / 2,
        boxRowCenterY - boxSize / 2,
        boxSize,
        boxSize,
      );
      boxBg.lineStyle(1, Colors.BORDER_BLUE, 0.7);
      boxBg.strokeRect(
        bx - boxSize / 2,
        boxRowCenterY - boxSize / 2,
        boxSize,
        boxSize,
      );
      container.add(boxBg);
      slots.push({
        x: bx,
        y: boxRowCenterY,
        size: boxSize,
        slotBg: boxBg,
        expectedIconKey: expectedSequence[i] ?? "",
      });
    }

    // Separator above box row
    const aboveBoxSep = this.add.graphics();
    aboveBoxSep.lineStyle(1, Colors.BORDER_BLUE, 0.7);
    aboveBoxSep.lineBetween(
      x - width / 2 + 8,
      boxRowTop,
      x + width / 2 - 8,
      boxRowTop,
    );
    container.add(aboveBoxSep);

    // ── Order list: anchored just above the box row ────────────────────────
    const rowHeight = 48;
    const rowPadding = 4;
    const fontSize = 12;
    const detailFontSize = 10;
    const qtyFontSize = Math.round(detailFontSize * (4 / 3)); // ~13
    const budgetLineHeight = 28;
    const orderListHeight =
      order.requirements.length * rowHeight + budgetLineHeight;
    // Anchor list bottom to just above the box row
    const orderListBottom = boxRowTop - 10;
    const orderListTop = orderListBottom - orderListHeight;

    order.requirements.forEach((req, index) => {
      const rowTop = orderListTop + index * rowHeight;

      // Alternating row background
      const rowBg = this.add.graphics();
      const bgColor = index % 2 === 0 ? 0x112244 : 0x0d1a35;
      rowBg.fillStyle(bgColor, 0.6);
      rowBg.fillRect(
        x - width / 2 + 4,
        rowTop + rowPadding / 2,
        width - 8,
        rowHeight - rowPadding,
      );
      container.add(rowBg);

      // Line 1: hash-sign bullet + item name
      const nameLine1Y = rowTop + rowPadding + fontSize / 2 + 2;

      if (AssetLoader.textureExists(this, "hash-sign")) {
        const bullet = AssetLoader.createImage(this, contentX + 4, nameLine1Y, "hash-sign");
        bullet.setScale(0.45);
        bullet.setOrigin(0, 0.5);
        container.add(bullet);
      }

      const nameText = this.add
        .bitmapText(
          contentX + 16,
          nameLine1Y,
          "clicker",
          req.itemName.toUpperCase(),
          fontSize,
        )
        .setOrigin(0, 0.5)
        .setMaxWidth(width - 30);
      container.add(nameText);

      // Line 2: qty left, cost right
      const detailY = nameLine1Y + fontSize + 4;

      const qtyText = this.add
        .bitmapText(
          contentX + 16,
          detailY,
          "clicker",
          `X${req.quantity}`,
          qtyFontSize,
        )
        .setOrigin(0, 0.5)
        .setTint(0xaaaacc);
      container.add(qtyText);

      const itemCost = `Q${req.cost * req.quantity}`;
      const costText = this.add
        .bitmapText(rightEdge, detailY, "clicker", itemCost, detailFontSize)
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
    separatorLine.lineBetween(
      x - width / 2 + 8,
      budgetY,
      x + width / 2 - 8,
      budgetY,
    );
    container.add(separatorLine);

    const budgetLabel = this.add
      .bitmapText(
        contentX,
        budgetY + budgetLineHeight / 2,
        "clicker",
        "TOTAL BUDGET",
        fontSize,
      )
      .setOrigin(0, 0.5);
    container.add(budgetLabel);

    const budgetValue = this.add
      .bitmapText(
        rightEdge,
        budgetY + budgetLineHeight / 2,
        "clicker",
        `Q${order.budget}`,
        fontSize + 1,
      )
      .setOrigin(1, 0.5)
      .setTint(Colors.HIGHLIGHT_YELLOW_BRIGHT);
    container.add(budgetValue);

    return slots;
  }

  private checkOrderComplete(): void {
    // All slots must be filled
    if (this.fulfillmentImages.some((s) => s === null)) return;
    // Tally what was actually sent
    const sentCounts = new Map<string, number>();
    for (const entry of this.fulfillmentImages) {
      if (!entry) return;
      sentCounts.set(entry.iconKey, (sentCounts.get(entry.iconKey) ?? 0) + 1);
    }
    // Sent counts must exactly match required counts — right items, right quantities
    if (sentCounts.size !== this.fulfillmentOrderIconCounts.size) return;
    for (const [iconKey, count] of this.fulfillmentOrderIconCounts) {
      if (sentCounts.get(iconKey) !== count) return;
    }
    // Switch to ORDERS tab if the player was on a different tab
    this.switchToOrdersTab?.();
    this.completeOrder();
  }

  private completeOrder(): void {
    if (!this.currentOrder) return;
    // Count green slots (correctly positioned)
    let greenCount = 0;
    for (let i = 0; i < this.fulfillmentSlots.length; i++) {
      const entry = this.fulfillmentImages[i];
      if (entry && entry.iconKey === this.fulfillmentSlots[i].expectedIconKey)
        greenCount++;
    }
    const revenue = this.currentOrder.budget;
    const bonus = greenCount * Math.round(this.currentOrder.budget * 0.1);
    this.shiftRevenue += revenue;
    this.shiftBonus += bonus;
    this.revenueText?.setText(`Q${this.shiftRevenue}`);
    this.bonusText?.setText(`Q${this.shiftBonus}`);
    this.flashAndTransition();
  }

  private flashAndTransition(): void {
    const {
      ordersPanelX: px,
      ordersPanelWidth: pw,
      ordersPanelTop: pt,
      ordersPanelHeight: ph,
    } = this;
    // White flash overlay drawn over the content area
    const flash = this.add.rectangle(
      px,
      pt + ph / 2 + 10,
      pw - 8,
      ph - 70,
      0xffffff,
      0,
    );
    flash.setDepth(50);
    this.tweens.add({
      targets: flash,
      alpha: { from: 0, to: 0.3 },
      duration: 120,
      yoyo: true,
      ease: "Quad.easeOut",
      onComplete: () => {
        // "ORDER ACCEPTED" label fades out over the panel
        const acceptLabel = this.add
          .bitmapText(px, pt + ph / 2 - 10, "clicker", "ORDER ACCEPTED", 16)
          .setOrigin(0.5)
          .setTint(0x00ff88)
          .setDepth(51);
        this.tweens.add({
          targets: acceptLabel,
          alpha: { from: 1, to: 0 },
          duration: 800,
          delay: 350,
          ease: "Quad.easeIn",
          onComplete: () => {
            acceptLabel.destroy();
            flash.destroy();
            const gameManager = GameManager.getInstance();
            this.loadNextOrder(gameManager.getItems());
          },
        });
        // Pulse the revenue and bonus counters
        [this.revenueText, this.bonusText].forEach((text) => {
          if (!text) return;
          this.tweens.add({
            targets: text,
            scaleX: { from: 1, to: 1.4 },
            scaleY: { from: 1, to: 1.4 },
            duration: 180,
            yoyo: true,
            ease: "Back.easeOut",
          });
        });
      },
    });
  }

  private loadNextOrder(items: any[]): void {
    if (this.ordersContainer) {
      this.ordersContainer.removeAll(true);
    }
    this.fulfillmentImages = [];
    this.fulfillmentSlots = [];
    this.fulfillmentOrderIconCounts = new Map<string, number>();
    if (this.radialDial) this.radialDial.reset();
    const nextOrder = buildOrder(items);
    this.currentOrder = nextOrder;
    const contentY = this.ordersPanelTop + 62;
    const contentH = this.ordersPanelHeight - 76;
    this.fulfillmentSlots = this.buildOrderContent(
      this.ordersContainer!,
      this.ordersPanelX,
      contentY,
      this.ordersPanelWidth - 20,
      contentH,
      nextOrder,
    );
    this.fulfillmentImages = new Array(this.fulfillmentSlots.length).fill(null);
    nextOrder.requirements.forEach((r) => {
      this.fulfillmentOrderIconCounts.set(
        r.iconKey,
        (this.fulfillmentOrderIconCounts.get(r.iconKey) ?? 0) + r.quantity,
      );
    });
  }

  endShift() {
    const progression = ProgressionManager.getInstance();
    progression.addQuanta(this.shiftBonus);
    progression.recordShiftComplete();
    this.scene.start("EndShift", {
      revenue: this.shiftRevenue,
      bonus: this.shiftBonus,
      shiftsCompleted: progression.getShiftsCompleted(),
    });
  }

  shutdown() {
    // Called via this.events.once('shutdown', this.shutdown, this) registered
    // at the end of create(). Cleans up resources that Phaser won't auto-free.
    this.shiftTimerEvent?.remove();
    if (this.radialDial) {
      this.radialDial.destroy();
    }
  }

  // ── Corner buttons ─────────────────────────────────────────────────────────

  /** Build the two corner button GameObjects (hidden on creation). */
  private createCornerButtons(
    dialX: number,
    dialY: number,
    dialRadius: number,
  ): void {
    const btnSize = 40;
    const margin = 6;
    const btnX = dialX + dialRadius - btnSize / 2 - margin;
    const upperY = dialY - dialRadius + btnSize / 2 + margin;
    const lowerY = dialY + dialRadius - btnSize / 2 - margin;

    // ── Catalog button (upper-right) ─────────────────────────────────────
    this.cornerCatalogBg = this.add.graphics();
    this.cornerCatalogBg.setDepth(20);
    this.cornerCatalogBg.setVisible(false);

    this.cornerCatalogLabel = this.add
      .bitmapText(btnX, upperY, "clicker", "CAT", 10)
      .setOrigin(0.5)
      .setDepth(21)
      .setVisible(false);

    this.cornerCatalogBg.setInteractive(
      new Phaser.Geom.Rectangle(
        btnX - btnSize / 2,
        upperY - btnSize / 2,
        btnSize,
        btnSize,
      ),
      Phaser.Geom.Rectangle.Contains,
    );
    this.cornerCatalogBg.on("pointerdown", () => {
      this.scrollCatalogToCategory(this.cornerActiveCategoryItem?.id ?? "");
      this.switchToCatalogTab?.();
    });
    this.cornerCatalogBg.on("pointerover", () => this.drawCatalogBtn(btnX, upperY, btnSize, true));
    this.cornerCatalogBg.on("pointerout", () => this.drawCatalogBtn(btnX, upperY, btnSize, false));

    // ── Level badge (lower-right) ─────────────────────────────────────────
    this.cornerLevelBg = this.add.graphics();
    this.cornerLevelBg.setDepth(20);
    this.cornerLevelBg.setVisible(false);

    // Placeholder image — will be replaced with real texture in updateCornerButtons
    this.cornerLevelIcon = this.add
      .image(btnX, lowerY, "")
      .setScale(0.9)
      .setDepth(22)
      .setVisible(false);

    this.cornerLevelLabel = this.add
      .bitmapText(btnX + btnSize / 2 - 7, lowerY - btnSize / 2 + 7, "clicker", "A", 10)
      .setOrigin(0.5)
      .setDepth(23)
      .setVisible(false);

    // Store positions for redraw
    (this.cornerLevelBg as any)._btnX = btnX;
    (this.cornerLevelBg as any)._lowerY = lowerY;
    (this.cornerLevelBg as any)._btnSize = btnSize;
    (this.cornerCatalogBg as any)._btnX = btnX;
    (this.cornerCatalogBg as any)._upperY = upperY;
    (this.cornerCatalogBg as any)._btnSize = btnSize;
  }

  /** Redraw the catalog button background (hover-aware). */
  private drawCatalogBtn(
    btnX: number,
    upperY: number,
    btnSize: number,
    hovered: boolean,
  ): void {
    if (!this.cornerCatalogBg) return;
    this.cornerCatalogBg.clear();
    this.cornerCatalogBg.fillStyle(
      hovered ? Colors.BUTTON_HOVER : Colors.PANEL_DARK,
      0.9,
    );
    this.cornerCatalogBg.fillRect(
      btnX - btnSize / 2,
      upperY - btnSize / 2,
      btnSize,
      btnSize,
    );
    this.cornerCatalogBg.lineStyle(2, Colors.BORDER_BLUE, 0.9);
    this.cornerCatalogBg.strokeRect(
      btnX - btnSize / 2,
      upperY - btnSize / 2,
      btnSize,
      btnSize,
    );
  }

  /** Sync corner button visibility and content to current dial state. */
  private updateCornerButtons(): void {
    if (!this.cornerLevelBg || !this.cornerCatalogBg) return;

    const bgData = this.cornerLevelBg as any;
    const catData = this.cornerCatalogBg as any;
    const btnX: number = bgData._btnX;
    const lowerY: number = bgData._lowerY;
    const btnSize: number = bgData._btnSize;
    const upperY: number = catData._upperY;

    const depth = this.cornerCurrentDepth;
    const isTerminal = this.cornerIsTerminal;
    const showBadge = depth >= 1;
    const showCatalog = depth === 1 && !isTerminal;

    // ── Level badge ───────────────────────────────────────────────────────
    this.cornerLevelBg.setVisible(showBadge);
    this.cornerLevelIcon?.setVisible(showBadge);
    this.cornerLevelLabel?.setVisible(showBadge);

    if (showBadge) {
      // Draw badge background
      this.cornerLevelBg.clear();
      this.cornerLevelBg.fillStyle(Colors.PANEL_DARK, 0.9);
      this.cornerLevelBg.fillCircle(btnX, lowerY, btnSize / 2);
      this.cornerLevelBg.lineStyle(2, Colors.NEON_BLUE, 0.9);
      this.cornerLevelBg.strokeCircle(btnX, lowerY, btnSize / 2);

      // Update level letter (A=0, B=1, C=2 …)
      const letter = String.fromCharCode(65 + depth);
      this.cornerLevelLabel?.setText(letter);
      this.cornerLevelLabel?.setPosition(
        btnX + btnSize / 2 - 7,
        lowerY - btnSize / 2 + 7,
      );
      this.cornerLevelLabel?.setTint(Colors.HIGHLIGHT_YELLOW);

      // Update category icon — use the B-level (depth-1) category root icon
      // so the badge always shows which category we entered, regardless of
      // how deep we have drilled (C, D, …).
      const categoryItem = this.cornerActiveCategoryItem;
      if (categoryItem && this.cornerLevelIcon) {
        const iconKey: string = categoryItem.icon ?? categoryItem.id;
        if (AssetLoader.textureExists(this, iconKey)) {
          const atlasKey = AssetLoader.getAtlasKey(iconKey);
          if (atlasKey) {
            this.cornerLevelIcon.setTexture(atlasKey, iconKey);
          } else {
            this.cornerLevelIcon.setTexture(iconKey);
          }
          this.cornerLevelIcon.setPosition(btnX, lowerY);
          this.cornerLevelIcon.setScale(0.9);
          this.cornerLevelIcon.setVisible(true);
        } else {
          this.cornerLevelIcon.setVisible(false);
        }
      }
    }

    // ── Catalog button ────────────────────────────────────────────────────
    this.cornerCatalogBg.setVisible(showCatalog);
    this.cornerCatalogLabel?.setVisible(showCatalog);

    if (showCatalog) {
      this.drawCatalogBtn(btnX, upperY, btnSize, false);

      // Show category icon or fallback "CAT" text
      if (this.cornerActiveCategoryItem) {
        this.cornerCatalogLabel?.setText("CAT").setTint(Colors.HIGHLIGHT_YELLOW_BRIGHT);
      }
    }
  }

  /** Scroll the catalog list so the given category header appears at the top. */
  private scrollCatalogToCategory(categoryId: string): void {
    if (!this.catalogListContainer || !categoryId) return;

    const rowIndex = this.catalogRowCategoryIds.findIndex(
      (id) => id === categoryId,
    );
    if (rowIndex === -1) return;

    const targetOffset = -(rowIndex * this.catalogRowHeight);
    const minOffset = Math.min(
      0,
      this.catalogPanelHeight - this.catalogListContentHeight,
    );
    const clampedOffset = Math.max(minOffset, Math.min(0, targetOffset));
    this.catalogListContainer.y = this.catalogListTop + clampedOffset;
  }
}
