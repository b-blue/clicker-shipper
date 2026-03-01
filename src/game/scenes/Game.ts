import { RadialDial } from "../ui/RadialDial";
import { DialCornerHUD } from "../ui/DialCornerHUD";
import { GameManager } from "../managers/GameManager";
import { SettingsManager } from "../managers/SettingsManager";
import { ProgressionManager, ALL_CATEGORY_IDS } from "../managers/ProgressionManager";
import { AssetLoader } from "../managers/AssetLoader";
import { Colors } from "../constants/Colors";
import { labelStyle, readoutStyle } from "../constants/FontStyle";
import { generateOrder as buildOrder } from "../utils/OrderUtils";
import { MenuItem, Order } from "../types/GameTypes";
import { RadDialConfig } from "../types/RadDialTypes";
import { OrderSlot } from "../orders/OrderTypes";
import { RepairPanel } from "../ui/panels/RepairPanel";
import { SettingsPanel } from "../ui/panels/SettingsPanel";
import { CatalogPanel } from "../ui/panels/CatalogPanel";
import { DroneViewPanel } from "../ui/panels/DroneViewPanel";
import { OrdersPanel } from "../ui/panels/OrdersPanel";
import { DroneStage } from "../repair/DroneStage";
import { RepairSession } from "../repair/RepairSession";
import { DeliveryQueue } from "../repair/DeliveryQueue";
import { DeliveryQueueUI } from "../ui/DeliveryQueueUI";

type TabKey = "REPAIR" | "SETTINGS" | "CATALOG" | "DRONES";

export class Game extends Phaser.Scene {
  // ── Dial / HUD ────────────────────────────────────────────────────────────
  private radialDial: RadialDial | null = null;
  private cornerHUD: DialCornerHUD | null = null;
  private activeReplaceItem: string | null = null;
  private deliveryQueue: DeliveryQueue | null = null;
  private deliveryQueueUI: DeliveryQueueUI | null = null;

  // ── Repair modules ────────────────────────────────────────────────────────
  private droneStage:      DroneStage      | null = null;
  private repairSession:   RepairSession   | null = null;
  private repairPanel:     RepairPanel     | null = null;
  private repairContainer: Phaser.GameObjects.Container | null = null;
  private repairPool:      any[]           = [];
  private activeAction:    string | null = null;

  // ── Orders (legacy / backgrounded) ───────────────────────────────────────
  private ordersContainer:  Phaser.GameObjects.Container | null = null;
  private orderSlots:       OrderSlot[] = [];
  private currentOrder:     Order | null = null;
  private ordersPanelX:     number = 0;
  private ordersPanelWidth: number = 0;
  private ordersPanelTop:   number = 0;
  private ordersPanelHeight:number = 0;
  private switchToOrdersTab: (() => void) | null = null;
  private catalogHandles: { openToCategory(id: string): void; switchTab(i: number): void } | null = null;

  constructor() { super("Game"); }

  // ══════════════════════════════════════════════════════════════════════════
  // Lifecycle
  // ══════════════════════════════════════════════════════════════════════════

  create() {
    try {
      const cam     = this.cameras.main;
      const gw      = cam.width;
      const gh      = cam.height;
      const sm       = SettingsManager.getInstance();
      const ds       = sm.getDialSettings();
      const leftHanded = sm.getHandedness() === 'left';
      const dialX   = leftHanded ? -ds.offsetX : gw + ds.offsetX;
      const dialY   = gh + ds.offsetY;
      const dialR   = ds.radius ?? 150;

      this.droneStage   = new DroneStage(this);
      // Pre-select the drone key before buildPanelUI so spawn() and
      // buildArrangement() both reference the same key on the first cycle.
      this.droneStage.pickKey();

      this.buildPanelUI(gw, gh, dialY, dialR, GameManager.getInstance().getItems());
      this.populateRepairPools();
      this.buildDial(dialX, dialY, dialR);
      this.wireDialEvents();
      this.events.once("shutdown", this.shutdown, this);
    } catch (e) {
      console.error("Game create error:", e);
      this.add.text(50, 50, 'ERROR LOADING GAME DATA', labelStyle(20));
    }
  }

  shutdown() {
    this.radialDial?.destroy();
    this.droneStage?.destroy();
    this.repairSession?.destroy();
    this.repairPanel?.destroy();
    this.deliveryQueue?.destroy();
    this.deliveryQueueUI?.destroy();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Panel UI
  // ══════════════════════════════════════════════════════════════════════════

  private buildPanelUI(gw: number, gh: number, dialY: number, dialR: number, items: any): void {
    this.add.rectangle(gw / 2, gh / 2, gw, gh, Colors.BACKGROUND_DARK);

    const tabW   = 52;
    const tabH   = 40;
    const tabSpc = 6;
    const tabGap = 8;

    const panelW    = Math.min(420, gw - tabW - tabGap - 20);
    const panelTop  = 20;
    const panelBot  = dialY - dialR - 20;
    const panelH    = panelBot - panelTop;
    const leftHanded = SettingsManager.getInstance().getHandedness() === 'left';
    const panelX    = leftHanded ? gw - 10 - panelW / 2 : 10 + panelW / 2;
    const panelY    = (panelTop + panelBot) / 2;

    const frame = this.add.rectangle(panelX, panelY, panelW, panelH, Colors.PANEL_DARK, 0.85);
    frame.setStrokeStyle(2, Colors.BORDER_BLUE, 0.8);

    // Containers per tab
    this.ordersContainer = this.add.container(0, 0);
    const repairCtr      = this.add.container(0, 0);
    const settingsCtr    = this.add.container(0, 0);
    const catalogCtr     = this.add.container(0, 0);
    const droneCtr       = this.add.container(0, 0);
    this.repairContainer = repairCtr;

    this.ordersPanelX      = panelX;
    this.ordersPanelWidth  = panelW;
    this.ordersPanelTop    = panelTop;
    this.ordersPanelHeight = panelH;

    const order    = buildOrder(items);
    this.currentOrder = order;
    const oPanel   = new OrdersPanel(this);
    this.orderSlots = oPanel.build(this.ordersContainer!, panelX, panelTop + 10, panelW - 20, panelH - 20, order);
    this.ordersContainer!.setVisible(false);

    const rPanel = new RepairPanel(this, this.droneStage!);
    this.repairPanel = rPanel;
    rPanel.build(repairCtr, panelX, panelTop + 2, panelW - 20, panelH - 10);

    const sPanel = new SettingsPanel(this);
    sPanel.build(settingsCtr, panelX, panelW);
    settingsCtr.setVisible(false);

    const cPanel = new CatalogPanel(this);
    this.catalogHandles = cPanel.build(catalogCtr, panelX, panelTop + 10, panelW - 20, panelH - 20, items);
    catalogCtr.setVisible(false);

    const dPanel = new DroneViewPanel(this);
    dPanel.build(droneCtr, panelX, panelTop + 10, panelW - 20, panelH - 20);
    droneCtr.setVisible(false);

    const containers: Record<TabKey, Phaser.GameObjects.Container> = {
      REPAIR: repairCtr, SETTINGS: settingsCtr, CATALOG: catalogCtr, DRONES: droneCtr,
    };
    const tabKeys: TabKey[] = ["REPAIR", "SETTINGS", "CATALOG", "DRONES"];

    const updateTab = (label: TabKey) => {
      this.radialDial?.setRepairNavMode(label === "REPAIR");
      for (const k of tabKeys) containers[k].setVisible(k === label);
    };

    this.switchToOrdersTab = () => updateTab("REPAIR");
    const switchToCatalog  = () => updateTab("CATALOG");

    this.events.on("catalog:openToCategory", (id: string) => {
      this.catalogHandles?.openToCategory(id);
      switchToCatalog();
    });

    const tabX      = leftHanded
      ? panelX - panelW / 2 - tabGap - tabW / 2
      : panelX + panelW / 2 + tabGap + tabW / 2;
    const tabStartY = panelTop + tabH / 2 + 4;
    tabKeys.forEach((label, i) => {
      const ty  = tabStartY + i * (tabH + tabSpc);
      const bg  = this.add.rectangle(tabX, ty, tabW, tabH, Colors.PANEL_DARK, 0.9);
      bg.setStrokeStyle(2, Colors.BORDER_BLUE, 0.8);
      bg.setInteractive();
      bg.on("pointerdown", () => updateTab(label));
      bg.on("pointerover", () => bg.setFillStyle(Colors.BUTTON_HOVER, 0.95));
      bg.on("pointerout",  () => bg.setFillStyle(Colors.PANEL_DARK, 0.9));
      this.add.text(tabX, ty, label[0], labelStyle(16, Colors.HIGHLIGHT_YELLOW)).setOrigin(0.5);
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Dial
  // ══════════════════════════════════════════════════════════════════════════

  private buildDial(dialX: number, dialY: number, dialR: number): void {
    const cfg  = this.cache.json.get('rad-dial') as RadDialConfig | undefined;
    const gm   = GameManager.getInstance();
    let roots: MenuItem[];

    if (cfg) {
      roots = cfg.actions.map((a): MenuItem => {
        if (!a.enabled) return { id: `locked_${a.id}`, name: a.name, icon: a.icon, layers: a.layers };
        const store = gm.getModeStore(a.id);
        return { id: a.id, name: a.name, icon: a.icon, layers: a.layers, children: store?.navTree ?? [] } as MenuItem;
      });
    } else {
      const p    = ProgressionManager.getInstance();
      const cats = p.getUnlockedCategories();
      roots = cats.map(({ categoryId }) => {
        const store = gm.getModeStore(categoryId);
        return store ? { id: categoryId, name: categoryId, icon: categoryId, children: store.navTree } as MenuItem : undefined;
      }).filter(Boolean) as MenuItem[];
      const needed = ALL_CATEGORY_IDS.length - roots.length;
      for (let i = 0; i < needed; i++) roots.push({ id: `locked_slot_${i}`, name: 'LOCKED', icon: 'skill-blocked' });
    }

    this.radialDial = new RadialDial(this, dialX, dialY, roots);
    this.radialDial.setRepairNavMode(true);

    this.cornerHUD = new DialCornerHUD(this, dialX, dialY, dialR, {
      openCatalog:  (id) => this.events.emit("catalog:openToCategory", id),
      closeCatalog: () => this.switchToOrdersTab?.(),
      openMenu:     () => this.scene.start("MainMenu"),
      onReplaceRequested: () => {
        this.activeAction = 'action_replace';
        const catalog = GameManager.getInstance().getGlobalItemCatalog();
        this.radialDial?.showReplaceCatalog(catalog);
        this.cornerHUD?.onLevelChanged(1, { id: 'action_replace', icon: 'skill-recycle' });
      },
    });

    const sm2  = SettingsManager.getInstance();
    const ds2  = sm2.getDialSettings();
    const leftHanded2 = sm2.getHandedness() === 'left';
    this.deliveryQueue   = new DeliveryQueue();
    this.deliveryQueueUI = new DeliveryQueueUI(this, dialX, dialY, dialR, leftHanded2, ds2);
    this.deliveryQueue.setScene(this);
  }

  private populateRepairPools(): void {
    const cfg = this.cache.json.get('rad-dial') as RadDialConfig | undefined;
    const gm  = GameManager.getInstance();
    let pool: any[] = [];

    if (cfg) {
      const ra = cfg.actions.find(a => a.id === 'action_reorient');
      if (ra) {
        pool = gm.getModeStore('action_reorient')?.flat ?? [];
      }
    }
    if (pool.length === 0) {
      pool = gm.getModeStore('action_reorient')?.flat ?? [];
    }
    this.repairPool = pool;

    // Create the initial RepairSession now that we have a pool and a pre-picked drone key.
    if (this.repairContainer && this.droneStage) {
      const key   = this.droneStage.getCurrentKey() ?? '';
      const count = this.droneStage.iconCountForCurrentKey();
      const session = new RepairSession(this, key);
      session.task.setPool(pool);
      this.repairSession = session;
      this.repairPanel?.setSession(session);
      this.repairPanel?.buildTaskArrangement(count, key || undefined);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Dial events
  // ══════════════════════════════════════════════════════════════════════════

  private wireDialEvents(): void {
    // Only clear the Game-owned dial/repair routing events.
    // Do NOT clear repair:itemFailed or delivery:completed — other objects
    // (RepairPanel) have long-lived subscriptions to those events that must
    // not be wiped when dial events are re-wired.
    ["dial:itemConfirmed","dial:quantityConfirmed","dial:levelChanged",
     "dial:goBack","catalog:tabActivated",
     "repair:showDial","repair:noMatch","repair:itemSolved","repair:allSolved"].forEach(e => this.events.removeAllListeners(e));

    this.events.on("dial:itemConfirmed", (data: { item: any; sliceCenterAngle?: number }) => {
      const depth = this.radialDial?.getDepth() ?? 0;
      if (this.activeAction === 'action_reorient' || depth >= 1) {
        // Replace-catalog path: selecting an item opens the quantity terminal
        if (this.activeAction === 'action_replace') {
          this.activeReplaceItem = data.item.icon || data.item.id;
          // Fixed 5-o'clock position (π/3 = 60° from x-axis) — never varies by item.
          this.radialDial?.showTerminalDial(data.item, 0, Math.PI / 3);
          this.cornerHUD?.onItemConfirmed();
          return;
        }
        this.repairSession?.task.onItemSelected(data.item);
        return;
      }
      const iconKey      = data.item.icon || data.item.id;
      const qty          = this.orderSlots.find(s => s.iconKey === iconKey)?.placedQty ?? 0;
      const sliceAngle   = data.sliceCenterAngle ?? Math.PI / 2;
      this.radialDial?.showTerminalDial(data.item, qty, sliceAngle);
      this.cornerHUD?.onItemConfirmed();
    });

    this.events.on("dial:quantityConfirmed", (data: { item: any; quantity: number }) => {
      // Replace path: quantity = speed tier (1=slow/2=normal/3=fast)
      if (this.activeReplaceItem) {
        const speedTier = Math.min(2, Math.max(0, data.quantity - 1));
        const cfg       = GameManager.getInstance().getConfig();
        const cost      = cfg.deliveryCosts[speedTier];
        const pm        = ProgressionManager.getInstance();
        if (pm.canAfford(cost)) {
          pm.addQuanta(-cost);
          this.deliveryQueue?.enqueue(this.activeReplaceItem, speedTier, cfg, this);
          this.deliveryQueueUI?.addSlot(this.activeReplaceItem, cfg.deliveryDurations[speedTier]);
        }
        this.activeReplaceItem = null;
        this.activeAction      = null;
        this.radialDial?.reset();
        this.cornerHUD?.onQuantityConfirmed();
        this.cornerHUD?.onGoBack();
        return;
      }
      this.placeItem(data.item.icon || data.item.id, data.quantity);
      this.cornerHUD?.onQuantityConfirmed();
    });

    this.events.on("dial:levelChanged", (data: { depth: number; item: any }) => {
      if (data.depth === 1 && data.item?.id)  this.activeAction = data.item.id;
      else if (data.depth === 0)              this.activeAction = null;
      this.cornerHUD?.onLevelChanged(data.depth, data.item);
    });

    this.events.on("dial:goBack", () => {
      this.repairSession?.task.clearCurrent();
      this.cornerHUD?.onGoBack();
    });

    this.events.on("repair:showDial", (data: { item: MenuItem; currentRotationDeg: number; targetRotationDeg: number }) => {
      this.radialDial?.showRepairDial(data.item, data.currentRotationDeg, data.targetRotationDeg);
      this.cornerHUD?.onItemConfirmed();
    });

    this.events.on("repair:noMatch", () => {
      // Capture depth before reset so the CornerHUD badge can be unwound to
      // root. No terminal face is active for noMatch (repair:showDial was never
      // emitted), so each onGoBack call decrements HUD depth by 1.
      const depth = this.radialDial?.getDepth() ?? 0;
      this.radialDial?.reset();
      for (let i = 0; i < depth; i++) {
        this.cornerHUD?.onGoBack();
      }
      this.activeAction = null;
    });

    this.events.on("repair:itemSolved", () => {
      // Two onGoBack calls: terminal → nav level, then nav → root.
      this.cornerHUD?.onGoBack();
      this.radialDial?.reset();
      this.cornerHUD?.onGoBack();
      this.activeAction = null;
    });

    this.events.on("repair:itemFailed", (_data: { iconKey: string }) => {
      // Update the HUD's failed-item count
      const items = this.repairSession?.task.getItems() ?? [];
      const failedCount = items.filter((r: any) => r.requiresReplace && !r.solved).length;
      this.cornerHUD?.onFailedItemCountChanged(failedCount);
      // Reset dial and return to root
      const depth = this.radialDial?.getDepth() ?? 0;
      this.radialDial?.reset();
      for (let i = 0; i < depth; i++) this.cornerHUD?.onGoBack();
      this.activeAction = null;
    });

    this.events.on("delivery:completed", (data: { iconKey: string }) => {
      this.repairSession?.task.resolveItem(data.iconKey);
      const items = this.repairSession?.task.getItems() ?? [];
      const failedCount = items.filter((r: any) => r.requiresReplace && !r.solved).length;
      this.cornerHUD?.onFailedItemCountChanged(failedCount);
      this.deliveryQueueUI?.removeSlot(data.iconKey);
    });

    this.events.on("repair:allSolved", () => {
      this.cornerHUD?.onGoBack();
      this.radialDial?.reset();
      this.cornerHUD?.onGoBack();
      this.activeAction = null;
      // Award quanta for completing a full repair
      ProgressionManager.getInstance().addQuanta(
        GameManager.getInstance().getConfig().quantaPerRepair
      );
      if (this.repairContainer && this.droneStage) {
        this.repairPanel?.dematerialize(() => {
          this.repairSession?.destroy();
          this.repairSession = null;
          this.droneStage?.exit(() => {
            if (!this.repairContainer || !this.droneStage) return;
            this.droneStage.pickKey();
            const key   = this.droneStage.getCurrentKey() ?? undefined;
            const count = this.droneStage.iconCountForCurrentKey();
            const newSession = new RepairSession(this, key ?? '');
            newSession.task.setPool(this.repairPool);
            this.repairSession = newSession;
            this.repairPanel?.setSession(newSession);
            this.repairPanel?.buildTaskArrangement(count, key);
            // mask omitted — DroneStage reuses the stored droneMask automatically
            this.droneStage.spawn(this.repairContainer, () => this.repairPanel?.materialize());
          });
        });
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Order fulfillment (legacy, backgrounded)
  // ══════════════════════════════════════════════════════════════════════════

  private evaluateSlot(i: number): 'empty' | 'correct' | 'misplaced' | 'wrong' {
    const slot = this.orderSlots[i];
    if (!slot || slot.iconKey === null) return 'empty';
    if (!this.currentOrder) return 'wrong';
    const idx = this.currentOrder.requirements.findIndex(r => r.iconKey === slot.iconKey);
    if (idx === -1) return 'wrong';
    const req = this.currentOrder.requirements[idx];
    if (slot.placedQty !== req.quantity) return 'wrong';
    return idx === i ? 'correct' : 'misplaced';
  }

  private redrawSlot(i: number): void {
    if (!this.ordersContainer) return;
    const slot = this.orderSlots[i];
    if (!slot) return;
    const status = this.evaluateSlot(i);
    slot.slotBg.clear();
    let bgFill: number; let bgStr: number; let strA: number;
    switch (status) {
      case 'correct':   bgFill = 0x003a1a; bgStr = 0x00e84a; strA = 0.95; break;
      case 'misplaced': bgFill = 0x2a2000; bgStr = 0xffd700; strA = 0.95; break;
      case 'wrong':     bgFill = 0x2a0011; bgStr = 0xff2244; strA = 0.95; break;
      default:          bgFill = Colors.PANEL_MEDIUM; bgStr = Colors.BORDER_BLUE; strA = 0.7; break;
    }
    slot.slotBg.fillStyle(bgFill, 0.85);
    slot.slotBg.fillRect(slot.x - slot.size / 2, slot.y - slot.size / 2, slot.size, slot.size);
    slot.slotBg.lineStyle(2, bgStr, strA);
    slot.slotBg.strokeRect(slot.x - slot.size / 2, slot.y - slot.size / 2, slot.size, slot.size);
    if (slot.slotIcon)     { slot.slotIcon.destroy();     slot.slotIcon = null; }
    if (slot.iconKey && AssetLoader.textureExists(this, slot.iconKey)) {
      slot.slotIcon = AssetLoader.createImage(this, slot.x, slot.y, slot.iconKey);
      slot.slotIcon.setDisplaySize(slot.size - 8, slot.size - 8).setDepth(3);
      this.ordersContainer!.add(slot.slotIcon);
    }
    if (slot.badgeGraphic) { slot.badgeGraphic.destroy(); slot.badgeGraphic = null; }
    if (slot.badgeText)    { slot.badgeText.destroy();    slot.badgeText = null; }
    if (slot.iconKey !== null && slot.placedQty > 0) {
      const bR = 9;
      const bX = slot.x + slot.size / 2 - bR + 2;
      const bY = slot.y - slot.size / 2 + bR - 2;
      const bC = status === 'correct' ? 0x00e84a : status === 'misplaced' ? 0xffd700 : status === 'wrong' ? 0xff2244 : Colors.NEON_BLUE;
      const bT = status === 'correct' ? 0x002200 : status === 'misplaced' ? 0x221100 : status === 'wrong' ? 0x330011 : 0x000033;
      const bg = this.add.graphics();
      bg.fillStyle(bC, 1); bg.fillCircle(bX, bY, bR); bg.setDepth(4);
      this.ordersContainer!.add(bg);
      const txt = this.add.text(bX, bY, String(slot.placedQty), readoutStyle(10, bT)).setOrigin(0.5).setDepth(5);
      this.ordersContainer!.add(txt);
      slot.badgeGraphic = bg; slot.badgeText = txt;
    }
  }

  private placeItem(iconKey: string, qty: number): void {
    if (!this.ordersContainer || !this.currentOrder) return;
    const ei = this.orderSlots.findIndex(s => s.iconKey === iconKey);
    if (qty === 0) {
      if (ei === -1) return;
      for (let i = ei; i < this.orderSlots.length; i++) { const s = this.orderSlots[i]; if (s.slotIcon) { s.slotIcon.destroy(); s.slotIcon = null; } }
      for (let i = ei; i < this.orderSlots.length - 1; i++) { this.orderSlots[i].iconKey = this.orderSlots[i + 1].iconKey; this.orderSlots[i].placedQty = this.orderSlots[i + 1].placedQty; }
      const last = this.orderSlots[this.orderSlots.length - 1]; last.iconKey = null; last.placedQty = 0;
      for (let i = ei; i < this.orderSlots.length; i++) this.redrawSlot(i);
    } else if (ei !== -1) {
      this.orderSlots[ei].placedQty = qty; this.redrawSlot(ei);
    } else {
      const emp = this.orderSlots.findIndex(s => s.iconKey === null); if (emp === -1) return;
      this.orderSlots[emp].iconKey = iconKey; this.orderSlots[emp].placedQty = qty; this.redrawSlot(emp);
    }
    this.switchToOrdersTab?.(); this.checkOrderComplete();
  }

  private checkOrderComplete(): void {
    if (!this.currentOrder) return;
    for (let i = 0; i < this.orderSlots.length; i++) { if (this.evaluateSlot(i) === 'wrong') return; }
    const allMet = this.currentOrder.requirements.every(r => this.orderSlots.some(s => s.iconKey === r.iconKey && s.placedQty === r.quantity));
    if (!allMet) return;
    this.switchToOrdersTab?.(); this.completeOrder();
  }

  private completeOrder(): void {
    if (!this.currentOrder) return;
    this.flashAndTransition();
  }

  private flashAndTransition(): void {
    const { ordersPanelX: px, ordersPanelWidth: pw, ordersPanelTop: pt, ordersPanelHeight: ph } = this;
    const flash = this.add.rectangle(px, pt + ph / 2 + 10, pw - 8, ph - 70, 0xffffff, 0).setDepth(50);
    this.tweens.add({ targets: flash, alpha: { from: 0, to: 0.3 }, duration: 120, yoyo: true, ease: "Quad.easeOut",
      onComplete: () => {
        const lbl = this.add.text(px, pt + ph / 2 - 10, 'ORDER ACCEPTED', readoutStyle(16, 0x00ff88)).setOrigin(0.5).setDepth(51);
        this.tweens.add({ targets: lbl, alpha: { from: 1, to: 0 }, duration: 800, delay: 350, ease: "Quad.easeIn",
          onComplete: () => { lbl.destroy(); flash.destroy(); this.loadNextOrder(GameManager.getInstance().getItems()); },
        });
      },
    });
  }

  private loadNextOrder(items: any[]): void {
    this.ordersContainer?.removeAll(true);
    this.orderSlots = [];
    this.radialDial?.reset();
    this.currentOrder = buildOrder(items);
    const p = new OrdersPanel(this);
    this.orderSlots = p.build(this.ordersContainer!, this.ordersPanelX, this.ordersPanelTop + 10, this.ordersPanelWidth - 20, this.ordersPanelHeight - 20, this.currentOrder);
  }
}
