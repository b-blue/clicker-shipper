import { RadialDial } from "../ui/RadialDial";
import { DialCornerHUD } from "../ui/DialCornerHUD";
import { GameManager } from "../managers/GameManager";
import { SettingsManager } from "../managers/SettingsManager";
import {
  ProgressionManager,
  ALL_CATEGORY_IDS,
  CATEGORY_ICON_KEYS,
} from "../managers/ProgressionManager";
import { AssetLoader } from "../managers/AssetLoader";
import { Colors } from "../constants/Colors";
import {
  generateOrder as buildOrder,
  getCatalogRows,
} from "../utils/OrderUtils";
import { MenuItem, Order } from "../types/GameTypes";

/**
 * A positional fulfillment slot in the order row.
 * Slots start empty (iconKey === null). Items are placed left-to-right.
 * Removing an item collapses the row leftward.
 */
interface OrderSlot {
  iconKey: string | null;  // null = empty slot
  placedQty: number;       // 0 when empty
  x: number;
  y: number;
  size: number;
  slotBg: Phaser.GameObjects.Graphics;
  slotIcon: Phaser.GameObjects.Image | null;
  badgeGraphic: Phaser.GameObjects.Graphics | null;
  badgeText: Phaser.GameObjects.BitmapText | null;
}

/** A single damaged component in a drone repair arrangement. */
interface RepairItem {
  iconKey: string;
  startRotationDeg: number;    // initial wrong angle
  targetRotationDeg: number;   // randomized target — turning green here = success
  currentRotationDeg: number;  // updated live during ring drag
  solved: boolean;
  iconObj: Phaser.GameObjects.Image;
  frameObj: Phaser.GameObjects.Graphics;
}

export class Game extends Phaser.Scene {
  private radialDial: RadialDial | null = null;
  private ordersContainer: Phaser.GameObjects.Container | null = null;
  private orderSlots: OrderSlot[] = [];

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

  // Corner HUD (level badge + catalog shortcut anchored to the dial)
  private cornerHUD: DialCornerHUD | null = null;
  // Persisted for alt-terminal toggle re-invocation
  private lastTerminalItem: any = null;
  private lastTerminalSliceAngle: number = Math.PI / 2;
  private altTerminalModeActive: boolean = false;
  // Drone repair mode
  private activeGameMode: 'repair' | 'orders' = 'repair';
  private droneRepairContainer: Phaser.GameObjects.Container | null = null;
  private droneRepairItems: RepairItem[] = [];
  private droneSprite: Phaser.GameObjects.Sprite | null = null;
  private currentRepairItem: RepairItem | null = null;
  private droneRepairTopBounds: { cx: number; cy: number; w: number; h: number } | null = null;
  private droneRepairBotBounds: { cx: number; cy: number; w: number; h: number } | null = null;
  // Shift timer pause state
  private timerPaused: boolean = false;
  private timerPausedAt: number = 0;
  // Catalog tabs — one scroll-offset per category in ALL_CATEGORY_IDS order.
  // Index mirrors ALL_CATEGORY_IDS: 0=resources, 1=armaments, …
  private catalogTabScrollOffsets: number[] = [];
  private catalogTabContainers: Phaser.GameObjects.Container[] = [];
  private catalogTabMinOffsets: number[] = [];
  private catalogActiveTabIndex: number = 0;
  private catalogPanelWidth: number = 0;
  private catalogTabBarHeight: number = 44;

  constructor() {
    super("Game");
  }

  create() {
    try {
      const gameManager = GameManager.getInstance();
      const items = gameManager.getItems();
      const { width: gameWidth, height: gameHeight } = this.cameras.main;
      const settingsManager = SettingsManager.getInstance();
      const dialSettings = settingsManager.getDialSettings();
      const dialX = gameWidth + dialSettings.offsetX;
      const dialY = gameHeight + dialSettings.offsetY;
      const dialRadius = dialSettings.radius ?? 150;

      this.buildPanelUI(gameWidth, gameHeight, dialY, dialRadius, items);
      this.buildDial(items, dialX, dialY, dialRadius);
      this.wireDialEvents();
      this.events.once("shutdown", this.shutdown, this);
    } catch (error) {
      console.error("Error creating Game scene:", error);
      this.add.bitmapText(50, 50, "clicker", "ERROR LOADING GAME DATA", 20);
    }
  }

  private buildPanelUI(gameWidth: number, gameHeight: number, dialY: number, dialRadius: number, items: any): void {
    const settingsManager = SettingsManager.getInstance();

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
    const panelX = 10 + panelWidth / 2; // left-align with 10px screen margin
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
    const tabKeys = ["REPAIR", "SETTINGS", "CATALOG", "DRONES"] as const;
    // Content containers for each tab
    this.ordersContainer = this.add.container(0, 0); // kept off-screen; order logic retained for future use
    const repairContainer = this.add.container(0, 0);
    const settingsContainer = this.add.container(0, 0);
    const catalogContainer = this.add.container(0, 0);
    const droneContainer = this.add.container(0, 0);
    this.droneRepairContainer = repairContainer;

    const containers = {
      REPAIR: repairContainer,
      SETTINGS: settingsContainer,
      CATALOG: catalogContainer,
      DRONES: droneContainer,
    };

    // Store panel geometry for order rebuilding
    this.ordersPanelX = panelX;
    this.ordersPanelWidth = panelWidth;
    this.ordersPanelTop = panelTop;
    this.ordersPanelHeight = panelHeight;

    // Generate current order silently (orders backgrounded; logic retained for later refactor)
    const currentOrder = buildOrder(items);
    this.currentOrder = currentOrder;
    this.orderSlots = this.buildOrderContent(
      this.ordersContainer,
      panelX,
      panelTop + 62,
      panelWidth - 20,
      panelHeight - 76,
      currentOrder,
    );
    this.ordersContainer.setVisible(false);

    // Repair tab (default)
    this.buildRepairContent(
      repairContainer,
      panelX,
      panelTop + 36,
      panelWidth - 20,
      panelHeight - 50,
    );

    // Settings tab
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
    this.buildDroneContent(
      droneContainer,
      panelX,
      panelTop + 36,
      panelWidth - 20,
      panelHeight - 50,
    );
    droneContainer.setVisible(false);

    const updateTabDisplay = (label: (typeof tabKeys)[number]) => {
      panelTitle.setText(label);
      statsContainer.setVisible(label === "REPAIR");
      if (label === "REPAIR") this.activeGameMode = 'repair';
      this.radialDial?.setRepairNavMode(label === 'REPAIR');
      Object.keys(containers).forEach((key) => {
        containers[key as (typeof tabKeys)[number]].setVisible(key === label);
      });
    };
    // Orders are backgrounded — redirect switchToOrdersTab back to REPAIR
    this.switchToOrdersTab = () => updateTabDisplay("REPAIR");
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
      tabBg.on("pointerover", () => tabBg.setFillStyle(Colors.BUTTON_HOVER, 0.95));
      tabBg.on("pointerout", () => tabBg.setFillStyle(Colors.PANEL_DARK, 0.9));

      const tabIcon = this.add
        .bitmapText(tabX, tabY, "clicker", label[0], 16)
        .setOrigin(0.5);
      tabIcon.setTint(Colors.HIGHLIGHT_YELLOW);
    });

  }

  private buildDial(items: any, dialX: number, dialY: number, dialRadius: number): void {
    const progression = ProgressionManager.getInstance();
    const unlockedCats = progression.getUnlockedCategories();
    const dialRootItems: MenuItem[] = unlockedCats
      .map(({ categoryId }) => {
        const found = (items as any[]).find((it: any) => it.id === categoryId);
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
    this.radialDial.setRepairNavMode(true); // REPAIR is the default active tab
    this.cornerHUD = new DialCornerHUD(this, dialX, dialY, dialRadius, {
      openCatalog: (id) => { this.openCatalogToCategory(id); },
      closeCatalog: () => this.switchToOrdersTab?.(),
      openMenu: () => this.scene.start('MainMenu'),
      onAltTerminalToggle: (altMode) => {
        this.altTerminalModeActive = altMode;
        if (!this.lastTerminalItem || !this.radialDial) return;
        const angle = altMode ? Math.PI / 3 : this.lastTerminalSliceAngle;
        this.radialDial.showTerminalDial(this.lastTerminalItem, 0, angle);
      },
    });
  }

  private wireDialEvents(): void {
    // Purge any stale handlers from a previous shift — scene.events persists
    // across scene restarts, so we clear before re-registering to keep exactly
    // one handler per event regardless of restart count.
    this.events.removeAllListeners("dial:itemConfirmed");
    this.events.removeAllListeners("dial:quantityConfirmed");
    this.events.removeAllListeners("dial:levelChanged");
    this.events.removeAllListeners("dial:goBack");
    this.events.removeAllListeners("catalog:tabActivated");
    this.events.removeAllListeners("dial:repairRotated");
    this.events.removeAllListeners("dial:repairSettled");

    this.events.on("dial:itemConfirmed", (data: { item: any; sliceCenterAngle?: number }) => {
      const iconKey: string = data.item.icon || data.item.id;
      if (this.activeGameMode === 'repair') {
        // Repair mode: look for a matching unsolved item in the arrangement
        const match = this.droneRepairItems.find(r => r.iconKey === iconKey && !r.solved);
        if (!match) {
          // No match — silently reject, return dial to navigation
          this.radialDial?.reset();
          return;
        }
        this.radialDial?.showRepairDial(data.item, match.currentRotationDeg, match.targetRotationDeg);
        this.currentRepairItem = match;
        this.cornerHUD?.onItemConfirmed();
        return;
      }
      // Orders mode — existing quantity-selector path
      const existingQty = this.getCurrentFulfilledQty(iconKey);
      this.lastTerminalItem = data.item;
      this.lastTerminalSliceAngle = data.sliceCenterAngle ?? Math.PI / 2;
      const angle = this.altTerminalModeActive ? Math.PI / 3 : this.lastTerminalSliceAngle;
      if (this.radialDial) this.radialDial.showTerminalDial(data.item, existingQty, angle);
      this.cornerHUD?.onItemConfirmed();
    });

    this.events.on("dial:quantityConfirmed", (data: { item: any; quantity: number }) => {
      const iconKey: string = data.item.icon || data.item.id;
      this.placeItem(iconKey, data.quantity);
      this.cornerHUD?.onQuantityConfirmed();
    });

    this.events.on(
      "dial:levelChanged",
      (data: { depth: number; item: any }) => this.cornerHUD?.onLevelChanged(data.depth, data.item),
    );

    this.events.on("dial:goBack", () => {
      this.currentRepairItem = null;
      this.cornerHUD?.onGoBack();
    });

    this.events.on("dial:repairRotated", (data: { rotation: number }) => {
      if (!this.currentRepairItem) return;
      this.currentRepairItem.currentRotationDeg = data.rotation;
      this.currentRepairItem.iconObj.setAngle(data.rotation);
    });

    this.events.on("dial:repairSettled", (data: { success: boolean }) => {
      if (!this.currentRepairItem) return;
      if (data.success) {
        this.currentRepairItem.currentRotationDeg = 0;
        this.currentRepairItem.iconObj.setAngle(0);
        this.currentRepairItem.solved = true;
        const { iconObj, frameObj } = this.currentRepairItem;
        frameObj.clear();
        frameObj.lineStyle(3, 0x44ff88, 1.0);
        frameObj.strokeCircle(iconObj.x, iconObj.y, 28);
      }
      this.currentRepairItem = null;
      this.cornerHUD?.onGoBack();
      if (this.droneRepairItems.length > 0 && this.droneRepairItems.every(r => r.solved)) {
        this.handleAllRepaired();
      }
    });
  }

  /** Return how many units of iconKey are currently placed in the row. */
  private getCurrentFulfilledQty(iconKey: string): number {
    return this.orderSlots.find((s) => s.iconKey === iconKey)?.placedQty ?? 0;
  }

  /**
   * Evaluate the placement correctness of slot at slotIndex.
   * - 'empty'    : slot has no item
   * - 'correct'  : item belongs in this exact position (matches requirements[slotIndex])
   * - 'misplaced': item is in the order but at the wrong position
   * - 'wrong'    : item is not in the order at all
   */
  private evaluateSlot(slotIndex: number): 'empty' | 'correct' | 'misplaced' | 'wrong' {
    const slot = this.orderSlots[slotIndex];
    if (!slot || slot.iconKey === null) return 'empty';
    if (!this.currentOrder) return 'wrong';
    const inOrder = this.currentOrder.requirements.some((r) => r.iconKey === slot.iconKey);
    if (!inOrder) return 'wrong';
    // Find the requirement for this item by iconKey (position-independent)
    const reqIndex = this.currentOrder.requirements.findIndex((r) => r.iconKey === slot.iconKey);
    if (reqIndex === -1) return 'wrong'; // not in order
    const req = this.currentOrder.requirements[reqIndex];
    // Wrong quantity is always red, regardless of position
    if (slot.placedQty !== req.quantity) return 'wrong';
    // Correct quantity: green if at expected position, yellow if misplaced
    return reqIndex === slotIndex ? 'correct' : 'misplaced';
  }

  /**
   * Redraw the visual for a single slot: background color, item icon, and quantity badge.
   * Must be called after any data change to orderSlots[slotIndex].
   */
  private redrawSlot(slotIndex: number): void {
    if (!this.ordersContainer) return;
    const slot = this.orderSlots[slotIndex];
    if (!slot) return;

    const status = this.evaluateSlot(slotIndex);

    // Background fill + border color keyed to placement status
    slot.slotBg.clear();
    let bgFill: number;
    let bgStroke: number;
    let strokeAlpha: number;
    switch (status) {
      case 'correct':   bgFill = 0x003a1a; bgStroke = 0x00e84a; strokeAlpha = 0.95; break;
      case 'misplaced': bgFill = 0x2a2000; bgStroke = 0xffd700; strokeAlpha = 0.95; break;
      case 'wrong':     bgFill = 0x2a0011; bgStroke = 0xff2244; strokeAlpha = 0.95; break;
      default:          bgFill = Colors.PANEL_MEDIUM; bgStroke = Colors.BORDER_BLUE; strokeAlpha = 0.7; break;
    }
    slot.slotBg.fillStyle(bgFill, 0.85);
    slot.slotBg.fillRect(slot.x - slot.size / 2, slot.y - slot.size / 2, slot.size, slot.size);
    slot.slotBg.lineStyle(2, bgStroke, strokeAlpha);
    slot.slotBg.strokeRect(slot.x - slot.size / 2, slot.y - slot.size / 2, slot.size, slot.size);

    // Item icon — destroy old, create new if slot is filled
    if (slot.slotIcon) { slot.slotIcon.destroy(); slot.slotIcon = null; }
    if (slot.iconKey && AssetLoader.textureExists(this, slot.iconKey)) {
      slot.slotIcon = AssetLoader.createImage(this, slot.x, slot.y, slot.iconKey);
      slot.slotIcon.setDisplaySize(slot.size - 8, slot.size - 8);
      slot.slotIcon.setDepth(3);
      this.ordersContainer.add(slot.slotIcon);
    }

    // Quantity badge — destroy old, create new if slot is filled
    if (slot.badgeGraphic) { slot.badgeGraphic.destroy(); slot.badgeGraphic = null; }
    if (slot.badgeText)    { slot.badgeText.destroy();    slot.badgeText = null; }
    if (slot.iconKey !== null && slot.placedQty > 0) {
      const badgeR = 9;
      const badgeX = slot.x + slot.size / 2 - badgeR + 2;
      const badgeY = slot.y - slot.size / 2 + badgeR - 2;
      const badgeColor = status === 'correct'   ? 0x00e84a
                       : status === 'misplaced' ? 0xffd700
                       : status === 'wrong'     ? 0xff2244
                       : Colors.NEON_BLUE;
      const badgeTint  = status === 'correct'   ? 0x002200
                       : status === 'misplaced' ? 0x221100
                       : status === 'wrong'     ? 0x330011
                       : 0x000033;
      const badgeG = this.add.graphics();
      badgeG.fillStyle(badgeColor, 1);
      badgeG.fillCircle(badgeX, badgeY, badgeR);
      badgeG.setDepth(4);
      this.ordersContainer.add(badgeG);
      const badgeTxt = this.add.bitmapText(badgeX, badgeY, "clicker", String(slot.placedQty), 10)
        .setOrigin(0.5).setTint(badgeTint).setDepth(5);
      this.ordersContainer.add(badgeTxt);
      slot.badgeGraphic = badgeG;
      slot.badgeText = badgeTxt;
    }
  }

  /**
   * Place or update an item in the fulfillment row.
   * - qty > 0 & item not yet placed: fill leftmost empty slot.
   * - qty > 0 & item already placed: update that slot's quantity in place.
   * - qty === 0: remove the item, collapse the row leftward.
   */
  private placeItem(iconKey: string, qty: number): void {
    if (!this.ordersContainer || !this.currentOrder) return;

    const existingIdx = this.orderSlots.findIndex((s) => s.iconKey === iconKey);

    if (qty === 0) {
      // Nothing to remove if item isn't in the row
      if (existingIdx === -1) return;

      // Destroy the icon image at the removed slot before shifting
      for (let i = existingIdx; i < this.orderSlots.length; i++) {
        const s = this.orderSlots[i];
        if (s.slotIcon) { s.slotIcon.destroy(); s.slotIcon = null; }
      }

      // Shift subsequent slot data leftward
      for (let i = existingIdx; i < this.orderSlots.length - 1; i++) {
        this.orderSlots[i].iconKey   = this.orderSlots[i + 1].iconKey;
        this.orderSlots[i].placedQty = this.orderSlots[i + 1].placedQty;
      }
      // Blank the last slot
      const last = this.orderSlots[this.orderSlots.length - 1];
      last.iconKey   = null;
      last.placedQty = 0;

      // Redraw every affected position
      for (let i = existingIdx; i < this.orderSlots.length; i++) {
        this.redrawSlot(i);
      }

    } else if (existingIdx !== -1) {
      // Update quantity in place
      this.orderSlots[existingIdx].placedQty = qty;
      this.redrawSlot(existingIdx);

    } else {
      // Place in leftmost empty slot
      const emptyIdx = this.orderSlots.findIndex((s) => s.iconKey === null);
      if (emptyIdx === -1) return; // row is full
      this.orderSlots[emptyIdx].iconKey   = iconKey;
      this.orderSlots[emptyIdx].placedQty = qty;
      this.redrawSlot(emptyIdx);
    }

    this.switchToOrdersTab?.();
    this.checkOrderComplete();
  }


  update(): void {
    if (!this.shiftArcGraphic || this.shiftDurationMs <= 0) return;
    // Freeze arc visually while timer is paused
    const elapsed = this.timerPaused
      ? (this.timerPausedAt - this.shiftStartTime)
      : (Date.now() - this.shiftStartTime);
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
    const tabBarH = this.catalogTabBarHeight;   // 44 px
    const listAreaTop = y + tabBarH;
    const listAreaH = height - tabBarH;
    const listLeft = x - width / 2;
    const rowHeight = 60;
    const iconFrameSize = 48;
    const iconScale = 1.3;
    const progression = ProgressionManager.getInstance();

    // Store panel width for switchCatalogTab() slide distance
    this.catalogPanelWidth = width;

    // Initialise per-tab state arrays
    this.catalogTabScrollOffsets = ALL_CATEGORY_IDS.map(() => 0);
    this.catalogTabMinOffsets    = ALL_CATEGORY_IDS.map(() => 0);
    this.catalogTabContainers    = [];
    this.catalogActiveTabIndex   = 0;  // resources starts active

    // ── Shared clip mask for the list area ──────────────────────────────
    const maskG = this.add.graphics();
    maskG.fillStyle(0xffffff, 1);
    maskG.fillRect(listLeft, listAreaTop, width, listAreaH);
    maskG.setVisible(false);
    const mask = maskG.createGeometryMask();

    // ── Build one scrollable list per category ───────────────────────────
    // getCatalogRows returns categories with their items.
    const allCatalogCategories = getCatalogRows(items);
    const catMap = new Map(allCatalogCategories.map((c) => [c.category.id, c]));

    ALL_CATEGORY_IDS.forEach((catId, tabIndex) => {
      const isUnlocked = progression.isUnlocked(catId);
      const catData = catMap.get(catId);

      // Per-tab container positioned so listLeft,listAreaTop is its origin
      const listContainer = this.add.container(listLeft, listAreaTop);
      listContainer.setMask(mask);
      listContainer.setVisible(tabIndex === 0); // resources is default
      this.catalogTabContainers.push(listContainer);
      container.add(listContainer);

      if (!isUnlocked || !catData) {
        // Locked tab — show a "locked" placeholder row
        const lockBg = this.add.graphics();
        lockBg.fillStyle(Colors.PANEL_DARK, 0.85);
        lockBg.fillRect(0, 0, width, listAreaH);
        listContainer.add(lockBg);

        if (AssetLoader.textureExists(this, 'skill-blocked')) {
          const lockIcon = AssetLoader.createImage(this, width / 2, listAreaH / 2 - 20, 'skill-blocked')
            .setScale(1.2)
            .setAlpha(0.5);
          listContainer.add(lockIcon);
        }
        const lockLabel = this.add
          .bitmapText(width / 2, listAreaH / 2 + 20, 'clicker', 'LOCKED', 12)
          .setOrigin(0.5)
          .setTint(0x556677);
        listContainer.add(lockLabel);
        return;
      }

      // Build item rows: depth-aware walk, alphabetically sorted, no header
      type CatalogEntry = { item: MenuItem; dialDepth: number };
      const collectEntries = (node: MenuItem, depth: number, unlockedDepth: number): CatalogEntry[] => {
        if (!node.children) return [];
        const result: CatalogEntry[] = [];
        node.children.forEach((child: MenuItem) => {
          const downMatch = child.id.match(/_down_(\d+)$/);
          if (downMatch) {
            const levelN = parseInt(downMatch[1], 10);
            if (levelN < unlockedDepth) {
              result.push(...collectEntries(child, levelN + 1, unlockedDepth));
            }
            return;
          }
          const isNavDown = child.icon === 'skill-down' || child.id.includes('_down_');
          if (!isNavDown && child.cost !== undefined) {
            result.push({ item: child, dialDepth: depth });
          }
        });
        return result;
      };
      const unlockedDepth = progression.getUnlockedDepth(catId);
      const rootNode = catData?.category ?? null;
      const entries: CatalogEntry[] = rootNode
        ? collectEntries(rootNode, 1, unlockedDepth).sort((a, b) => a.item.name.localeCompare(b.item.name))
        : [];

      entries.forEach((entry, index) => {
        const { item, dialDepth } = entry;
        const rowY = index * rowHeight + rowHeight / 2;
        const bgColor = index % 2 === 0 ? Colors.PANEL_DARK : Colors.PANEL_MEDIUM;

        const bg = this.add.rectangle(width / 2, rowY, width, rowHeight - 8, bgColor, 0.75);
        listContainer.add(bg);

        const iconX = iconFrameSize / 2 + 10;
        const iconY = rowY;

        if (AssetLoader.textureExists(this, item.icon)) {
          const iconImage = AssetLoader.createImage(this, iconX, iconY, item.icon).setScale(iconScale).setDepth(2);
          listContainer.add(iconImage);
        }

        const nameX = iconX + iconFrameSize / 2 + 20;
        listContainer.add(
          this.add.bitmapText(nameX, rowY, 'clicker', item.name.toUpperCase(), 10).setOrigin(0, 0.5).setMaxWidth(width - iconFrameSize - 90),
        );

        // Level badge: mini version of the dial's lower-right corner badge
        // Shows the category icon + dial-level letter (B, C, D…)
        const badgeSize = 28;
        const badgeR = badgeSize / 2;
        const badgeX = width - badgeR - 10;
        const badgeY = rowY;
        const catIconKey = CATEGORY_ICON_KEYS[catId] ?? 'skill-diagram';

        const badgeG = this.add.graphics();
        badgeG.fillStyle(Colors.PANEL_MEDIUM, 1);
        badgeG.fillCircle(badgeX, badgeY, badgeR);
        badgeG.lineStyle(1, Colors.BORDER_BLUE, 0.7);
        badgeG.strokeCircle(badgeX, badgeY, badgeR);
        listContainer.add(badgeG);

        if (AssetLoader.textureExists(this, catIconKey)) {
          const catIcon = AssetLoader.createImage(this, badgeX, badgeY, catIconKey)
            .setScale(0.55)
            .setDepth(2);
          listContainer.add(catIcon);
        }

        const levelLetter = String.fromCharCode(65 + dialDepth); // 1→'B', 2→'C', …
        listContainer.add(
          this.add.bitmapText(badgeX + badgeR - 5, badgeY - badgeR + 5, 'clicker', levelLetter, 8)
            .setOrigin(0.5)
            .setDepth(3)
            .setTint(Colors.HIGHLIGHT_YELLOW),
        );
      });

      const contentH = entries.length * rowHeight;
      this.catalogTabMinOffsets[tabIndex] = Math.min(0, listAreaH - contentH);
    });

    // ── Tab icon bar ─────────────────────────────────────────────────────
    const tabCount = ALL_CATEGORY_IDS.length;
    const tabIconSize = 32;
    const tabBarPad   = 4;
    const totalTabW   = tabCount * tabIconSize + (tabCount - 1) * tabBarPad;
    const tabBarStartX = x - totalTabW / 2;
    const tabBarCenterY = y + tabBarH / 2;

    // "CATALOG" label above the tab bar is drawn by existing panel title logic;
    // draw a thin separator under the tab row
    const tabBarSep = this.add.graphics();
    tabBarSep.lineStyle(1, Colors.BORDER_BLUE, 0.45);
    tabBarSep.lineBetween(listLeft, y + tabBarH - 2, listLeft + width, y + tabBarH - 2);
    container.add(tabBarSep);

    // Highlight indicator (slides under active tab)
    const tabHighlight = this.add.graphics();
    container.add(tabHighlight);

    const tabIconImages: Phaser.GameObjects.Image[] = [];
    const tabBgRects: Phaser.GameObjects.Rectangle[] = [];

    const redrawTabHighlight = (activeIdx: number) => {
      tabHighlight.clear();
      const tx = tabBarStartX + activeIdx * (tabIconSize + tabBarPad) + tabIconSize / 2;
      tabHighlight.lineStyle(2, Colors.HIGHLIGHT_YELLOW, 0.9);
      tabHighlight.strokeRect(tx - tabIconSize / 2 - 1, tabBarCenterY - tabIconSize / 2 - 1, tabIconSize + 2, tabIconSize + 2);
    };

    ALL_CATEGORY_IDS.forEach((catId, tabIndex) => {
      const isUnlocked = progression.isUnlocked(catId);
      const iconKey = CATEGORY_ICON_KEYS[catId] ?? 'skill-blocked';
      const tx = tabBarStartX + tabIndex * (tabIconSize + tabBarPad) + tabIconSize / 2;

      // Tab background
      const tabBg = this.add.rectangle(tx, tabBarCenterY, tabIconSize, tabIconSize, Colors.PANEL_MEDIUM, 0.7);
      tabBg.setStrokeStyle(1, Colors.BORDER_BLUE, isUnlocked ? 0.6 : 0.25);
      container.add(tabBg);
      tabBgRects.push(tabBg);

      // Tab icon
      let tabIcon: Phaser.GameObjects.Image | null = null;
      if (AssetLoader.textureExists(this, iconKey)) {
        tabIcon = AssetLoader.createImage(this, tx, tabBarCenterY, iconKey)
          .setScale(0.75)
          .setAlpha(isUnlocked ? 1.0 : 0.25);
        container.add(tabIcon);
      }
      tabIconImages.push(tabIcon as Phaser.GameObjects.Image);

      if (!isUnlocked) return;

      // Interactive — unlocked tabs only
      tabBg.setInteractive();
      tabBg.on('pointerdown', () => this.switchCatalogTab(tabIndex, redrawTabHighlight));
      tabBg.on('pointerover', () => tabBg.setFillStyle(Colors.BUTTON_HOVER, 0.85));
      tabBg.on('pointerout',  () => tabBg.setFillStyle(Colors.PANEL_MEDIUM, 0.7));
    });

    redrawTabHighlight(0);

    // Allow openCatalogToCategory() to update the highlight without a slide animation
    this.events.on('catalog:tabActivated', (idx: number) => redrawTabHighlight(idx));

    // ── Horizontal swipe gesture (unlocked tabs only) ─────────────────────
    let swipeStartX = 0;
    let swipeStartY = 0;
    let isSwipeTracking = false;
    let swipeConsumed = false;

    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (!container.visible) return;
      const inPanel = ptr.x >= listLeft && ptr.x <= listLeft + width
                   && ptr.y >= y       && ptr.y <= y + tabBarH + listAreaH;
      if (!inPanel) return;
      swipeStartX = ptr.x;
      swipeStartY = ptr.y;
      isSwipeTracking = true;
      swipeConsumed = false;
    });
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!container.visible || !isSwipeTracking || swipeConsumed) return;
      const dx = ptr.x - swipeStartX;
      const dy = ptr.y - swipeStartY;
      if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        swipeConsumed = true;
        const direction = dx < 0 ? 1 : -1;
        const cur = this.catalogActiveTabIndex;
        let next = cur + direction;
        // Skip locked tabs
        while (next >= 0 && next < ALL_CATEGORY_IDS.length && !progression.isUnlocked(ALL_CATEGORY_IDS[next])) {
          next += direction;
        }
        if (next >= 0 && next < ALL_CATEGORY_IDS.length && next !== cur) {
          this.switchCatalogTab(next, redrawTabHighlight);
        }
      }
    });
    this.input.on('pointerup', () => { isSwipeTracking = false; });

    // ── Vertical scroll (per-tab) ─────────────────────────────────────────
    // Mouse wheel
    this.input.on('wheel', (_ptr: Phaser.Input.Pointer, _go: any, _dx: number, dy: number) => {
      if (!container.visible) return;
      const ti = this.catalogActiveTabIndex;
      const listC = this.catalogTabContainers[ti];
      if (!listC) return;
      const minOff = this.catalogTabMinOffsets[ti];
      if (minOff >= 0) return; // content fits, no scroll needed
      this.catalogTabScrollOffsets[ti] = Math.max(minOff, Math.min(0, this.catalogTabScrollOffsets[ti] - dy * 0.4));
      listC.y = listAreaTop + this.catalogTabScrollOffsets[ti];
    });

    // Touch scroll
    let touchStartY = 0;
    let isTouchScrolling = false;
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (!container.visible) return;
      if (ptr.x >= listLeft && ptr.x <= listLeft + width && ptr.y >= listAreaTop && ptr.y <= listAreaTop + listAreaH) {
        touchStartY = ptr.y;
        isTouchScrolling = true;
      }
    });
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!container.visible || !isTouchScrolling) return;
      const ti = this.catalogActiveTabIndex;
      const listC = this.catalogTabContainers[ti];
      if (!listC) return;
      const minOff = this.catalogTabMinOffsets[ti];
      if (minOff >= 0) return;
      const ddy = touchStartY - ptr.y;
      touchStartY = ptr.y;
      this.catalogTabScrollOffsets[ti] = Math.max(minOff, Math.min(0, this.catalogTabScrollOffsets[ti] - ddy));
      listC.y = listAreaTop + this.catalogTabScrollOffsets[ti];
    });
    this.input.on('pointerup', () => { isTouchScrolling = false; });
  }

  /** Switch the visible catalog tab, firing a slide animation and updating the highlight. */
  private switchCatalogTab(targetIndex: number, redrawHighlight?: (i: number) => void): void {
    const oldIndex = this.catalogActiveTabIndex;
    if (oldIndex === targetIndex) return;
    const oldContainer = this.catalogTabContainers[oldIndex];
    const newContainer = this.catalogTabContainers[targetIndex];
    if (!oldContainer || !newContainer) return;

    const slideW = this.catalogPanelWidth;
    const direction = targetIndex > oldIndex ? 1 : -1;
    // Use the outgoing container's current x as the canonical "home" position
    // (containers are created at listLeft, not 0).
    const homeX = oldContainer.x;

    // Slide old out, new in
    newContainer.x = homeX + direction * slideW;
    newContainer.setVisible(true);

    this.tweens.add({
      targets: oldContainer,
      x: homeX - direction * slideW,
      duration: 150,
      ease: 'Quad.easeOut',
      onComplete: () => oldContainer.setVisible(false),
    });
    this.tweens.add({
      targets: newContainer,
      x: homeX,
      duration: 150,
      ease: 'Quad.easeOut',
    });

    this.catalogActiveTabIndex = targetIndex;
    if (redrawHighlight) redrawHighlight(targetIndex);
  }

  /**
   * Switch to catalog tab for categoryId and show the catalog panel.
   * The tab's scroll position is preserved (per-shift memory).
   */
  private openCatalogToCategory(categoryId: string): void {
    const tabIndex = ALL_CATEGORY_IDS.indexOf(categoryId);
    if (tabIndex !== -1 && tabIndex !== this.catalogActiveTabIndex) {
      // Switch instantly (no slide) when opening from HUD button
      const old = this.catalogTabContainers[this.catalogActiveTabIndex];
      const homeX = old ? old.x : 0;
      if (old) old.setVisible(false);
      const next = this.catalogTabContainers[tabIndex];
      if (next) { next.x = homeX; next.setVisible(true); }
      this.catalogActiveTabIndex = tabIndex;
      // Redraw highlight — find the graphics object in the catalog container
      // by emitting a custom event that the tab bar listens to
      this.events.emit('catalog:tabActivated', tabIndex);
    }
    this.switchToCatalogTab?.();
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
    const durationLabelY = resetY + 96;
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

    // SHIFT TIMER toggle (inserted between reset and duration presets)
    const timerToggleY = resetY + 44;
    const timerToggleBg = this.add.rectangle(panelX, timerToggleY, btnW, 28, Colors.PANEL_DARK, 0.9);
    timerToggleBg.setStrokeStyle(2, Colors.BORDER_BLUE);
    timerToggleBg.setInteractive();
    const timerToggleLbl = this.add
      .bitmapText(panelX, timerToggleY, 'clicker', 'SHIFT TIMER: ON', 11)
      .setOrigin(0.5);
    const refreshTimerToggle = () => {
      timerToggleLbl.setText(this.timerPaused ? 'SHIFT TIMER: OFF' : 'SHIFT TIMER: ON');
      timerToggleLbl.setTint(this.timerPaused ? Colors.MUTED_BLUE : Colors.HIGHLIGHT_YELLOW);
    };
    timerToggleBg.on('pointerdown', () => {
      if (!this.timerPaused) {
        this.timerPaused = true;
        this.timerPausedAt = Date.now();
        if (this.shiftTimerEvent) this.shiftTimerEvent.paused = true;
      } else {
        // Shift the start-time reference forward so the arc doesn't jump
        this.shiftStartTime += Date.now() - this.timerPausedAt;
        this.timerPaused = false;
        if (this.shiftTimerEvent) this.shiftTimerEvent.paused = false;
      }
      refreshTimerToggle();
    });
    timerToggleBg.on('pointerover', () => timerToggleBg.setFillStyle(Colors.BUTTON_HOVER, 0.95));
    timerToggleBg.on('pointerout',  () => timerToggleBg.setFillStyle(Colors.PANEL_DARK, 0.9));
    container.add([timerToggleBg, timerToggleLbl]);
  }

  private buildOrderContent(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    height: number,
    order: Order,
  ): OrderSlot[] {
    const contentX = x - width / 2 + 12;
    const rightEdge = x + width / 2 - 12;
    const contentBottom = y + height;

    const { slots, boxRowTop } = this.buildFulfillmentSlotRow(
      container, x, width, contentBottom, order.requirements,
    );
    this.buildOrderRequirementRows(container, x, width, boxRowTop, order, contentX, rightEdge);

    return slots;
  }

  /**
   * Renders the bottom strip of fulfillment slots — one per distinct item type.
   * Each slot shows the item icon and a quantity badge when fulfilled > 0.
   */
  private buildFulfillmentSlotRow(
    container: Phaser.GameObjects.Container,
    x: number,
    width: number,
    contentBottom: number,
    requirements: Order["requirements"],
  ): { slots: OrderSlot[]; boxRowTop: number } {
    const totalSlots = requirements.length;
    const boxRowHeight = 64;
    const boxGap = 6;
    const boxSize = Math.min(48, Math.floor((width - 16 - (Math.max(1, totalSlots) - 1) * boxGap) / Math.max(1, totalSlots)));
    const rowTotalWidth = totalSlots * boxSize + (totalSlots - 1) * boxGap;
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

    // Build empty slots — items are placed dynamically, not pre-assigned
    const slots: OrderSlot[] = [];
    for (let i = 0; i < totalSlots; i++) {
      const bx = boxStartX + i * (boxSize + boxGap) + boxSize / 2;
      const by = boxRowCenterY;

      const boxBg = this.add.graphics();
      boxBg.fillStyle(Colors.PANEL_MEDIUM, 0.8);
      boxBg.fillRect(bx - boxSize / 2, by - boxSize / 2, boxSize, boxSize);
      boxBg.lineStyle(1, Colors.BORDER_BLUE, 0.7);
      boxBg.strokeRect(bx - boxSize / 2, by - boxSize / 2, boxSize, boxSize);
      container.add(boxBg);

      slots.push({
        iconKey: null,
        placedQty: 0,
        x: bx,
        y: by,
        size: boxSize,
        slotBg: boxBg,
        slotIcon: null,
        badgeGraphic: null,
        badgeText: null,
      });
    }

    // Separator above box row
    const aboveBoxSep = this.add.graphics();
    aboveBoxSep.lineStyle(1, Colors.BORDER_BLUE, 0.7);
    aboveBoxSep.lineBetween(x - width / 2 + 8, boxRowTop, x + width / 2 - 8, boxRowTop);
    container.add(aboveBoxSep);

    return { slots, boxRowTop };
  }

  /** Renders the scrollable item rows and total budget line above the drop-box strip. */
  private buildOrderRequirementRows(
    container: Phaser.GameObjects.Container,
    x: number,
    width: number,
    boxRowTop: number,
    order: Order,
    contentX: number,
    rightEdge: number,
  ): void {
    const rowHeight = 48;
    const rowPadding = 4;
    const fontSize = 12;
    const detailFontSize = 10;
    const qtyFontSize = Math.round(detailFontSize * (4 / 3)); // ~13
    const budgetLineHeight = 28;
    const orderListHeight = order.requirements.length * rowHeight + budgetLineHeight;
    const orderListTop = (boxRowTop - 10) - orderListHeight;

    order.requirements.forEach((req, index) => {
      const rowTop = orderListTop + index * rowHeight;

      // Alternating row background
      const rowBg = this.add.graphics();
      rowBg.fillStyle(index % 2 === 0 ? 0x112244 : 0x0d1a35, 0.6);
      rowBg.fillRect(x - width / 2 + 4, rowTop + rowPadding / 2, width - 8, rowHeight - rowPadding);
      container.add(rowBg);

      // Line 1: bullet + item name
      const nameLine1Y = rowTop + rowPadding + fontSize / 2 + 2;
      if (AssetLoader.textureExists(this, "hash-sign")) {
        const bullet = AssetLoader.createImage(this, contentX + 4, nameLine1Y, "hash-sign");
        bullet.setScale(0.45);
        bullet.setOrigin(0, 0.5);
        bullet.setTint(0xffffff);
        container.add(bullet);
      }
      container.add(
        this.add.bitmapText(contentX + 22, nameLine1Y, "clicker", req.itemName.toUpperCase(), fontSize)
          .setOrigin(0, 0.5).setMaxWidth(width - 36),
      );

      // Line 2: qty left, cost right
      const detailY = nameLine1Y + fontSize + 4;
      container.add(
        this.add.bitmapText(contentX + 16, detailY, "clicker", `X${req.quantity}`, qtyFontSize)
          .setOrigin(0, 0.5).setTint(0xaaaacc),
      );
      container.add(
        this.add.bitmapText(rightEdge, detailY, "clicker", `Q${req.cost * req.quantity}`, detailFontSize)
          .setOrigin(1, 0.5).setTint(Colors.HIGHLIGHT_YELLOW),
      );

      // Thin separator between items (not after last)
      if (index < order.requirements.length - 1) {
        const sep = this.add.graphics();
        sep.lineStyle(1, Colors.BORDER_BLUE, 0.3);
        sep.lineBetween(x - width / 2 + 8, rowTop + rowHeight - rowPadding / 2, x + width / 2 - 8, rowTop + rowHeight - rowPadding / 2);
        container.add(sep);
      }
    });

    // Total budget line
    const budgetY = orderListTop + order.requirements.length * rowHeight;
    const separatorLine = this.add.graphics();
    separatorLine.lineStyle(1, Colors.BORDER_BLUE, 0.7);
    separatorLine.lineBetween(x - width / 2 + 8, budgetY, x + width / 2 - 8, budgetY);
    container.add(separatorLine);
    container.add(
      this.add.bitmapText(contentX, budgetY + budgetLineHeight / 2, "clicker", "TOTAL BUDGET", fontSize)
        .setOrigin(0, 0.5),
    );
    container.add(
      this.add.bitmapText(rightEdge, budgetY + budgetLineHeight / 2, "clicker", `Q${order.budget}`, fontSize + 1)
        .setOrigin(1, 0.5).setTint(Colors.HIGHLIGHT_YELLOW_BRIGHT),
    );
  }

  private checkOrderComplete(): void {
    if (!this.currentOrder) return;
    // Red (wrong) items block completion
    for (let i = 0; i < this.orderSlots.length; i++) {
      if (this.evaluateSlot(i) === 'wrong') return;
    }
    // Every requirement must be satisfied by a placed item at the exact quantity
    const allMet = this.currentOrder.requirements.every((req) =>
      this.orderSlots.some((s) => s.iconKey === req.iconKey && s.placedQty === req.quantity),
    );
    if (!allMet) return;
    this.switchToOrdersTab?.();
    this.completeOrder();
  }

  private completeOrder(): void {
    if (!this.currentOrder) return;
    const revenue = this.currentOrder.budget;
    this.shiftRevenue += revenue;

    // Accuracy bonus: 50% of order budget when every filled slot is 'correct'
    // (right position AND right quantity — all green, no yellow).
    const filledSlots = this.orderSlots.filter((s) => s.iconKey !== null);
    const allCorrect =
      filledSlots.length > 0 &&
      filledSlots.every((_, i) => this.evaluateSlot(i) === 'correct');
    if (allCorrect) {
      this.shiftBonus += Math.round(revenue * 0.5);
    }

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
    this.orderSlots = [];
    if (this.radialDial) this.radialDial.reset();
    const nextOrder = buildOrder(items);
    this.currentOrder = nextOrder;
    const contentY = this.ordersPanelTop + 62;
    const contentH = this.ordersPanelHeight - 76;
    this.orderSlots = this.buildOrderContent(
      this.ordersContainer!,
      this.ordersPanelX,
      contentY,
      this.ordersPanelWidth - 20,
      contentH,
      nextOrder,
    );
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

  /**
   * Builds the Drones tab: animated sprite viewer with a browse carousel
   * (left/right arrows slide between entries) and a vertical scale slider.
   *
   * To add a new drone animation:
   *  1. Load it as a spritesheet in Preloader.preload() (frameWidth / frameHeight).
   *  2. Push a new entry into DRONE_ANIMS below.
   */
  private buildDroneContent(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    // ── Animation registry ─────────────────────────────────────────────────
    // To add more entries: load the image in Preloader.preload() with a key
    // matching the convention "drone-{id}-{animation}", then push a new row here.
    const DRONE_ANIMS: Array<{ key: string; label: string; frameRate: number }> = [
      { key: 'drone-1-death',    label: '1 · Death',     frameRate: 8  },
      { key: 'drone-1-idle',     label: '1 · Idle',      frameRate: 8  },
      { key: 'drone-1-scan',     label: '1 · Scan',      frameRate: 10 },
      { key: 'drone-1-walk',     label: '1 · Walk',      frameRate: 10 },
      { key: 'drone-1-walkscan', label: '1 · Walk+Scan', frameRate: 10 },
      { key: 'drone-2-bomb',     label: '2 · Bomb',      frameRate: 8  },
      { key: 'drone-2-drop',     label: '2 · Drop',      frameRate: 8  },
      { key: 'drone-3-back',     label: '3 · Back',      frameRate: 10 },
      { key: 'drone-3-death',    label: '3 · Death',     frameRate: 8  },
      { key: 'drone-3-fire1',    label: '3 · Fire 1',    frameRate: 12 },
      { key: 'drone-3-fire2',    label: '3 · Fire 2',    frameRate: 12 },
      { key: 'drone-3-fire3',    label: '3 · Fire 3',    frameRate: 12 },
      { key: 'drone-3-forward',  label: '3 · Forward',   frameRate: 10 },
      { key: 'drone-3-idle',     label: '3 · Idle',      frameRate: 8  },
      { key: 'drone-4-death',    label: '4 · Death',     frameRate: 8  },
      { key: 'drone-4-idle',     label: '4 · Idle',      frameRate: 8  },
      { key: 'drone-4-landing',  label: '4 · Landing',   frameRate: 8  },
      { key: 'drone-4-walk',     label: '4 · Walk',      frameRate: 10 },
      { key: 'drone-5-death',    label: '5 · Death',     frameRate: 8  },
      { key: 'drone-5-idle',     label: '5 · Idle',      frameRate: 8  },
      { key: 'drone-5-walk',     label: '5 · Walk',      frameRate: 10 },
      { key: 'drone-5b-death',   label: '5b · Death',    frameRate: 8  },
      { key: 'drone-5b-idle',    label: '5b · Idle',     frameRate: 8  },
      { key: 'drone-5b-walk',    label: '5b · Walk',     frameRate: 10 },
      { key: 'drone-6-capsule',  label: '6 · Capsule',   frameRate: 8  },
      { key: 'drone-6-drop',     label: '6 · Drop',      frameRate: 8  },
      { key: 'drone-6-walk',     label: '6 · Walk',      frameRate: 10 },
      { key: 'drone-6-walk2',    label: '6 · Walk 2',    frameRate: 10 },
    ];

    // Register Phaser animations (idempotent — skipped if already created).
    // Images were loaded as plain textures; slice them into numbered frames here
    // by assuming square frames: frameWidth = textureHeight.
    for (const entry of DRONE_ANIMS) {
      if (!this.anims.exists(entry.key)) {
        const tex = this.textures.get(entry.key);
        const src = tex.source[0];
        const frameH     = src.height;
        const frameCount = Math.max(1, Math.floor(src.width / frameH));
        for (let i = 0; i < frameCount; i++) {
          if (!tex.has(String(i))) tex.add(String(i), 0, i * frameH, 0, frameH, frameH);
        }
        const frames = Array.from({ length: frameCount }, (_, i) => ({ key: entry.key, frame: String(i) }));
        this.anims.create({ key: entry.key, frames, frameRate: entry.frameRate, repeat: -1 });
      }
    }

    // ── Layout ─────────────────────────────────────────────────────────────
    const left   = x - width / 2;
    const right  = x + width / 2;
    const top    = y;
    const bottom = y + height;

    // Right-hand slider strip
    const sliderStripW = 32;
    const trackX      = right - sliderStripW / 2;
    const trackTopY   = top    + 24;
    const trackBotY   = bottom - 28;
    const trackH      = trackBotY - trackTopY;
    const thumbW = 18;
    const thumbH = 26;
    const minScale = 0.5;
    const maxScale = 6;
    let thumbT       = 0.4;  // 0 = top (largest), 1 = bottom (smallest)
    let currentScale = maxScale - thumbT * (maxScale - minScale); // ≈ 3.3

    // Display viewport (everything left of the slider)
    const arrowAreaH = 40;
    const displayW   = width - sliderStripW - 16;
    const displayCX  = left + displayW / 2;
    const displayCY  = top + (height - arrowAreaH) / 2;
    const arrowY     = bottom - arrowAreaH / 2;

    // Geometry mask — clips sprites to the display viewport during transitions
    const maskGfx = this.add.graphics();
    maskGfx.fillStyle(0xffffff, 1);
    maskGfx.fillRect(left, top, displayW, height - arrowAreaH);
    maskGfx.setVisible(false);
    const viewportMask = maskGfx.createGeometryMask();

    // ── Slider ─────────────────────────────────────────────────────────────
    const sliderG = this.add.graphics();

    const drawSlider = (t: number, dragging = false): void => {
      sliderG.clear();
      sliderG.lineStyle(2, Colors.BORDER_BLUE, 0.55);
      sliderG.lineBetween(trackX, trackTopY, trackX, trackBotY);
      // Quarter-ticks
      for (let i = 0; i <= 4; i++) {
        const ty = trackTopY + (trackH * i) / 4;
        sliderG.lineStyle(1, Colors.BORDER_BLUE, 0.3);
        sliderG.lineBetween(trackX - 5, ty, trackX + 5, ty);
      }
      // Thumb
      const ty = trackTopY + t * trackH;
      sliderG.fillStyle(dragging ? Colors.BUTTON_HOVER : Colors.PANEL_MEDIUM, 1);
      sliderG.fillRoundedRect(trackX - thumbW / 2, ty - thumbH / 2, thumbW, thumbH, 4);
      sliderG.lineStyle(1, dragging ? Colors.HIGHLIGHT_YELLOW : Colors.BORDER_LIGHT_BLUE, 0.9);
      sliderG.strokeRoundedRect(trackX - thumbW / 2, ty - thumbH / 2, thumbW, thumbH, 4);
    };
    drawSlider(thumbT);
    container.add(sliderG);

    // Scale readout below the track
    const scaleLbl = this.add
      .bitmapText(trackX, trackBotY + 14, 'clicker', `x${currentScale.toFixed(1)}`, 10)
      .setOrigin(0.5)
      .setTint(Colors.TEXT_MUTED_BLUE);
    container.add(scaleLbl);

    // Slider state
    let isDraggingSlider = false;
    let currentSprite: Phaser.GameObjects.Sprite | null = null;

    const applyScale = (): void => { currentSprite?.setScale(currentScale); };

    const sliderZone = this.add
      .zone(trackX, (trackTopY + trackBotY) / 2, sliderStripW + 8, trackH + thumbH)
      .setInteractive();

    sliderZone.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      isDraggingSlider = true;
      thumbT       = Phaser.Math.Clamp((ptr.y - trackTopY) / trackH, 0, 1);
      currentScale = maxScale - thumbT * (maxScale - minScale);
      applyScale();
      drawSlider(thumbT, true);
      scaleLbl.setText(`x${currentScale.toFixed(1)}`);
    });
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!isDraggingSlider) return;
      thumbT       = Phaser.Math.Clamp((ptr.y - trackTopY) / trackH, 0, 1);
      currentScale = maxScale - thumbT * (maxScale - minScale);
      applyScale();
      drawSlider(thumbT, true);
      scaleLbl.setText(`x${currentScale.toFixed(1)}`);
    });
    this.input.on('pointerup', () => {
      if (!isDraggingSlider) return;
      isDraggingSlider = false;
      drawSlider(thumbT);
    });
    container.add(sliderZone);

    // ── Carousel ───────────────────────────────────────────────────────────
    let currentIndex = 0;
    let isTransitioning = false;

    const spawnSprite = (index: number, startX: number = displayCX): Phaser.GameObjects.Sprite => {
      const spr = this.add
        .sprite(startX, displayCY, DRONE_ANIMS[index].key)
        .setScale(currentScale)
        .setMask(viewportMask);
      spr.play(DRONE_ANIMS[index].key);
      container.add(spr);
      return spr;
    };
    currentSprite = spawnSprite(0);

    // Entry name label
    const nameLabel = this.add
      .bitmapText(displayCX, top + 14, 'clicker', DRONE_ANIMS[0].label, 12)
      .setOrigin(0.5)
      .setTint(Colors.HIGHLIGHT_YELLOW);
    container.add(nameLabel);

    // Navigate slides the current sprite out and the next one in
    const navigate = (dir: 1 | -1): void => {
      if (isTransitioning || DRONE_ANIMS.length <= 1) return;
      isTransitioning = true;
      const nextIndex = (currentIndex + dir + DRONE_ANIMS.length) % DRONE_ANIMS.length;
      const outX    = displayCX - dir * (displayW + 40);
      const startX  = displayCX + dir * (displayW + 40);
      const oldSprite = currentSprite!;
      const newSprite = spawnSprite(nextIndex, startX);
      currentSprite = newSprite;
      currentIndex  = nextIndex;
      nameLabel.setText(DRONE_ANIMS[nextIndex].label);
      this.tweens.add({
        targets: oldSprite,
        x: outX,
        duration: 220,
        ease: 'Cubic.easeIn',
        onComplete: () => oldSprite.destroy(),
      });
      this.tweens.add({
        targets: newSprite,
        x: displayCX,
        duration: 220,
        ease: 'Cubic.easeOut',
        onComplete: () => { isTransitioning = false; },
      });
    };

    // ── Arrow buttons ──────────────────────────────────────────────────────
    const multiEntry = DRONE_ANIMS.length > 1;
    const makeArrow = (label: string, ax: number, dir: 1 | -1): void => {
      const bg = this.add
        .rectangle(ax, arrowY, 44, 28, Colors.PANEL_MEDIUM, multiEntry ? 0.85 : 0.3)
        .setStrokeStyle(1, Colors.BORDER_BLUE, multiEntry ? 0.8 : 0.25);
      const lbl = this.add
        .bitmapText(ax, arrowY, 'clicker', label, 14)
        .setOrigin(0.5)
        .setTint(multiEntry ? Colors.HIGHLIGHT_YELLOW : Colors.BORDER_BLUE);
      if (multiEntry) {
        bg.setInteractive();
        bg.on('pointerdown', () => navigate(dir));
        bg.on('pointerover', () => bg.setFillStyle(Colors.BUTTON_HOVER, 0.95));
        bg.on('pointerout',  () => bg.setFillStyle(Colors.PANEL_MEDIUM, 0.85));
      }
      container.add([bg, lbl]);
    };
    makeArrow('<', displayCX - 52, -1);
    makeArrow('>', displayCX + 52, 1);
  }

  // ── Drone Repair ──────────────────────────────────────────────────────────

  /** Splits the panel area into two halves and builds the repair screen. */
  private buildRepairContent(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const halfH = height / 2;
    const topCX = x;
    const topCY = y + halfH / 2;
    const botCX = x;
    const botCY = y + halfH + halfH / 2;

    this.droneRepairTopBounds = { cx: topCX, cy: topCY, w: width, h: halfH };
    this.droneRepairBotBounds = { cx: botCX, cy: botCY, w: width, h: halfH };

    // Top half — drone screen
    const topBg = this.add.rectangle(topCX, topCY, width, halfH, Colors.PANEL_DARK, 0.6);
    topBg.setStrokeStyle(1, Colors.BORDER_BLUE, 0.45);

    // Bottom half — item arrangement area
    const botBg = this.add.rectangle(botCX, botCY, width, halfH, Colors.PANEL_DARK, 0.3);
    botBg.setStrokeStyle(1, Colors.BORDER_BLUE, 0.2);

    container.add([topBg, botBg]);

    this.spawnNextDrone(container);
    this.buildRepairArrangement(container);
  }

  /**
   * Recursively collects leaf items (no children) from nav_resources_root.
   * These are the only items used in drone repair arrangements.
   */
  private getResourceLeafItems(): any[] {
    const allItems = GameManager.getInstance().getItems() as any[];
    const root = allItems.find((it: any) => it.id === 'nav_resources_root');
    if (!root) return [];
    const leaves: any[] = [];
    const collect = (items: any[]) => {
      for (const item of items) {
        if (item.children && item.children.length > 0) {
          collect(item.children);
        } else {
          leaves.push(item);
        }
      }
    };
    collect(root.children ?? []);
    return leaves;
  }

  /** Picks a random drone idle animation and tweens it in from the left. */
  private spawnNextDrone(container: Phaser.GameObjects.Container): void {
    if (!this.droneRepairTopBounds) return;
    const { cx, cy, w } = this.droneRepairTopBounds;

    const idleKeys = [
      'drone-1-idle', 'drone-3-idle', 'drone-4-idle',
      'drone-5-idle', 'drone-5b-idle',
    ];
    const key = idleKeys[Math.floor(Math.random() * idleKeys.length)];

    // Register animation if not yet created (same logic as buildDroneContent)
    if (!this.anims.exists(key)) {
      const tex = this.textures.get(key);
      const src = tex.source[0];
      const frameH = src.height;
      const frameCount = Math.max(1, Math.floor(src.width / frameH));
      for (let i = 0; i < frameCount; i++) {
        if (!tex.has(String(i))) tex.add(String(i), 0, i * frameH, 0, frameH, frameH);
      }
      const frames = Array.from({ length: frameCount }, (_, i) => ({ key, frame: String(i) }));
      this.anims.create({ key, frames, frameRate: 8, repeat: -1 });
    }

    const startX = cx - w / 2 - 80;
    const sprite = this.add.sprite(startX, cy, key).setScale(3).setDepth(5);
    sprite.play(key);
    container.add(sprite);
    this.droneSprite = sprite;

    this.tweens.add({ targets: sprite, x: cx, duration: 600, ease: 'Cubic.easeOut' });
  }

  /**
   * Destroys any existing repair items and builds a fresh polygon arrangement
   * of 2–6 random resource-type icons with randomised wrong rotations.
   */
  private buildRepairArrangement(container: Phaser.GameObjects.Container): void {
    // Clean up previous items
    for (const ri of this.droneRepairItems) {
      ri.iconObj.destroy();
      ri.frameObj.destroy();
    }
    this.droneRepairItems = [];

    if (!this.droneRepairBotBounds) return;
    const { cx, cy, w, h } = this.droneRepairBotBounds;

    const pool = this.getResourceLeafItems();
    if (pool.length === 0) return;

    const n = 2 + Math.floor(Math.random() * 5); // 2-6
    const count = Math.min(n, pool.length);
    const chosen = [...pool].sort(() => Math.random() - 0.5).slice(0, count);

    // Guaranteed-wrong starting angles: multiples of 30° excluding 0° / ±360°
    const rotOptions = [30, 60, 90, 120, 135, 150, 180, 210, 240, 270, 300, 330];
    const polygonRadius = Math.min(w, h) * 0.32;

    for (let i = 0; i < chosen.length; i++) {
      const item = chosen[i];
      const angle = -Math.PI / 2 + (i / chosen.length) * 2 * Math.PI;
      const vx = cx + Math.cos(angle) * polygonRadius;
      const vy = cy + Math.sin(angle) * polygonRadius;
      const startRot = rotOptions[Math.floor(Math.random() * rotOptions.length)];
      // Pick a target distinct from startRot so the item starts in the wrong position
      let targetRot = rotOptions[Math.floor(Math.random() * rotOptions.length)];
      while (targetRot === startRot) targetRot = rotOptions[Math.floor(Math.random() * rotOptions.length)];

      // Frame circle
      const frameG = this.add.graphics();
      frameG.lineStyle(2, Colors.BORDER_BLUE, 0.8);
      frameG.strokeCircle(vx, vy, 28);
      frameG.setDepth(4);
      container.add(frameG);

      // Icon
      const iconKey: string = item.icon || item.id;
      let iconObj: Phaser.GameObjects.Image;
      if (AssetLoader.textureExists(this, iconKey)) {
        iconObj = AssetLoader.createImage(this, vx, vy, iconKey);
      } else {
        iconObj = this.add.image(vx, vy, '').setVisible(false);
      }
      iconObj.setAngle(startRot).setScale(0.9).setDepth(5);
      container.add(iconObj);

      this.droneRepairItems.push({
        iconKey,
        startRotationDeg: startRot,
        targetRotationDeg: targetRot,
        currentRotationDeg: startRot,
        solved: false,
        iconObj,
        frameObj: frameG,
      });
    }
  }

  /** Called when every item in the current arrangement has been correctly oriented. */
  private handleAllRepaired(): void {
    const earned = this.droneRepairItems.length * 10;
    this.shiftRevenue += earned;
    this.revenueText?.setText(`Q${this.shiftRevenue}`);

    if (!this.droneSprite || !this.droneRepairTopBounds) return;
    const exitX = this.droneRepairTopBounds.cx + this.droneRepairTopBounds.w / 2 + 80;
    this.tweens.add({
      targets: this.droneSprite,
      x: exitX,
      duration: 500,
      ease: 'Cubic.easeIn',
      onComplete: () => { this.droneSprite?.destroy(); this.droneSprite = null; },
    });

    this.time.delayedCall(700, () => {
      if (!this.droneRepairContainer) return;
      this.buildRepairArrangement(this.droneRepairContainer);
      this.spawnNextDrone(this.droneRepairContainer);
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
}
