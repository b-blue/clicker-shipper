#!/usr/bin/env python3
"""Writes the new slim Game.ts — run from the repo root."""
import os

DEST = os.path.join(os.path.dirname(__file__), '..', 'src', 'game', 'scenes', 'Game.ts')

CONTENT = r"""import { RadialDial } from "../ui/RadialDial";
import { DialCornerHUD } from "../ui/DialCornerHUD";
import { GameManager } from "../managers/GameManager";
import { SettingsManager } from "../managers/SettingsManager";
import { ProgressionManager, ALL_CATEGORY_IDS } from "../managers/ProgressionManager";
import { AssetLoader } from "../managers/AssetLoader";
import { Colors } from "../constants/Colors";
import { generateOrder as buildOrder } from "../utils/OrderUtils";
import { MenuItem, Order } from "../types/GameTypes";
import { RadDialConfig } from "../types/RadDialTypes";
import { ShiftTimerState } from "../repair/RepairTypes";
import { OrderSlot } from "../orders/OrderTypes";
import { RepairPanel } from "../ui/panels/RepairPanel";
import { SettingsPanel } from "../ui/panels/SettingsPanel";
import { CatalogPanel } from "../ui/panels/CatalogPanel";
import { DroneViewPanel } from "../ui/panels/DroneViewPanel";
import { OrdersPanel } from "../ui/panels/OrdersPanel";
import { DroneStage } from "../repair/DroneStage";
import { ReOrientMode } from "../repair/ReOrientMode";

type TabKey = "REPAIR" | "SETTINGS" | "CATALOG" | "DRONES";

export class Game extends Phaser.Scene {
  // ── Dial / HUD ────────────────────────────────────────────────────────────
  private radialDial: RadialDial | null = null;
  private cornerHUD: DialCornerHUD | null = null;
  private lastTerminalItem: any = null;
  private lastTerminalSliceAngle: number = Math.PI / 2;
  private altTerminalModeActive: boolean = false;

  // ── Shift timer ───────────────────────────────────────────────────────────
  private shiftTimerState: ShiftTimerState = {
    timerPaused:     false,
    timerPausedAt:   0,
    shiftStartTime:  0,
    shiftDurationMs: 300000,
    shiftTimerEvent: null,
  };
  private shiftArcGraphic: Phaser.GameObjects.Graphics | null = null;
  private shiftTimerX: number = 0;
  private shiftTimerY: number = 0;
  private readonly shiftTimerRadius: number = 12;

  // ── Revenue ───────────────────────────────────────────────────────────────
  private shiftRevenue: number = 0;
  private shiftBonus:   number = 0;
  private revenueText: Phaser.GameObjects.BitmapText | null = null;
  private bonusText:   Phaser.GameObjects.BitmapText | null = null;

  // ── Repair modules ────────────────────────────────────────────────────────
  private droneStage:       DroneStage   | null = null;
  private reOrientMode:     ReOrientMode | null = null;
  private repairContainer:  Phaser.GameObjects.Container | null = null;
  private activeAction:     string | null = null;

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
      const items   = GameManager.getInstance().getItems();
      const cam     = this.cameras.main;
      const gw      = cam.width;
      const gh      = cam.height;
      const ds      = SettingsManager.getInstance().getDialSettings();
      const dialX   = gw + ds.offsetX;
      const dialY   = gh + ds.offsetY;
      const dialR   = ds.radius ?? 150;

      this.droneStage   = new DroneStage(this);
      this.reOrientMode = new ReOrientMode(this);

      this.buildPanelUI(gw, gh, dialY, dialR, items);
      this.buildDial(items, dialX, dialY, dialR);
      this.populateRepairPools(items);
      this.wireDialEvents();
      this.events.once("shutdown", this.shutdown, this);
    } catch (e) {
      console.error("Game create error:", e);
      this.add.bitmapText(50, 50, "clicker", "ERROR LOADING GAME DATA", 20);
    }
  }

  update(): void {
    if (!this.shiftArcGraphic) return;
    const s = this.shiftTimerState;
    if (s.shiftDurationMs <= 0) return;
    const elapsed  = s.timerPaused ? (s.timerPausedAt - s.shiftStartTime) : (Date.now() - s.shiftStartTime);
    const fraction = Math.min(1, elapsed / s.shiftDurationMs);
    const r        = this.shiftTimerRadius;
    this.shiftArcGraphic.clear();
    if (fraction > 0) {
      this.shiftArcGraphic.fillStyle(0x00e84a, 0.85);
      this.shiftArcGraphic.slice(this.shiftTimerX, this.shiftTimerY, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fraction, false);
      this.shiftArcGraphic.fillPath();
    }
  }

  endShift() {
    const p = ProgressionManager.getInstance();
    p.addQuanta(this.shiftBonus);
    p.recordShiftComplete();
    this.scene.start("EndShift", { revenue: this.shiftRevenue, bonus: this.shiftBonus, shiftsCompleted: p.getShiftsCompleted() });
  }

  shutdown() {
    this.shiftTimerState.shiftTimerEvent?.remove();
    this.radialDial?.destroy();
    this.droneStage?.destroy();
    this.reOrientMode?.destroy();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Panel UI
  // ══════════════════════════════════════════════════════════════════════════

  private buildPanelUI(gw: number, gh: number, dialY: number, dialR: number, items: any): void {
    const sm = SettingsManager.getInstance();

    this.add.rectangle(gw / 2, gh / 2, gw, gh, Colors.BACKGROUND_DARK);

    const tabW   = 52;
    const tabH   = 40;
    const tabSpc = 6;
    const tabGap = 8;

    const panelW    = Math.min(420, gw - tabW - tabGap - 20);
    const panelTop  = 20;
    const panelBot  = dialY - dialR - 20;
    const panelH    = panelBot - panelTop;
    const panelX    = 10 + panelW / 2;
    const panelY    = (panelTop + panelBot) / 2;

    const frame = this.add.rectangle(panelX, panelY, panelW, panelH, Colors.PANEL_DARK, 0.85);
    frame.setStrokeStyle(2, Colors.BORDER_BLUE, 0.8);

    const titleY    = panelTop + 21;
    const panelTitle = this.add.bitmapText(panelX, titleY, "clicker", "REPAIR", 14).setOrigin(0.5);

    // Shift timer
    const timerR = this.shiftTimerRadius;
    const timerX = panelX - panelW / 2 + timerR + 8;
    this.shiftTimerX = timerX;
    this.shiftTimerY = titleY;
    const s      = this.shiftTimerState;
    s.shiftDurationMs = sm.getShiftDurationMs();
    s.shiftStartTime  = Date.now();
    const tBg = this.add.graphics();
    tBg.fillStyle(Colors.PANEL_MEDIUM, 1);
    tBg.fillCircle(timerX, titleY, timerR);
    tBg.lineStyle(1, Colors.BORDER_BLUE, 0.7);
    tBg.strokeCircle(timerX, titleY, timerR);
    this.shiftArcGraphic = this.add.graphics();
    s.shiftTimerEvent = this.time.addEvent({ delay: s.shiftDurationMs, callback: this.endShift, callbackScope: this });

    // Stats bar
    const statsCtr  = this.add.container(0, 0);
    const divTop    = this.add.graphics();
    divTop.lineStyle(1, Colors.BORDER_BLUE, 0.45);
    divTop.lineBetween(panelX - panelW / 2 + 8, panelTop + 42, panelX + panelW / 2 - 8, panelTop + 42);
    const statsY    = panelTop + 54;
    const statsLeft = panelX - panelW / 2 + 14;
    const revLbl    = this.add.bitmapText(statsLeft, statsY, "clicker", "REV", 12).setOrigin(0, 0.5).setTint(0xaaaacc);
    this.revenueText = this.add.bitmapText(statsLeft + 38, statsY, "clicker", "Q0", 12).setOrigin(0, 0.5).setTint(Colors.HIGHLIGHT_YELLOW_BRIGHT);
    const bonLbl    = this.add.bitmapText(panelX + 4, statsY, "clicker", "BONUS", 12).setOrigin(0, 0.5).setTint(0xaaaacc);
    this.bonusText  = this.add.bitmapText(panelX + 68, statsY, "clicker", "Q0", 12).setOrigin(0, 0.5).setTint(Colors.HIGHLIGHT_YELLOW);
    const divBot    = this.add.graphics();
    divBot.lineStyle(1, Colors.BORDER_BLUE, 0.45);
    divBot.lineBetween(panelX - panelW / 2 + 8, panelTop + 66, panelX + panelW / 2 - 8, panelTop + 66);
    statsCtr.add([divTop, revLbl, this.revenueText!, bonLbl, this.bonusText!, divBot]);

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
    this.orderSlots = oPanel.build(this.ordersContainer!, panelX, panelTop + 62, panelW - 20, panelH - 76, order);
    this.ordersContainer!.setVisible(false);

    const rPanel = new RepairPanel(this, this.droneStage!, this.reOrientMode!);
    rPanel.build(repairCtr, panelX, panelTop + 36, panelW - 20, panelH - 50);

    const sPanel = new SettingsPanel(this, s, { onEndShift: () => this.endShift() });
    sPanel.build(settingsCtr, panelX, panelW);
    settingsCtr.setVisible(false);

    const cPanel = new CatalogPanel(this);
    this.catalogHandles = cPanel.build(catalogCtr, panelX, panelTop + 36, panelW - 20, panelH - 50, items);
    catalogCtr.setVisible(false);

    const dPanel = new DroneViewPanel(this);
    dPanel.build(droneCtr, panelX, panelTop + 36, panelW - 20, panelH - 50);
    droneCtr.setVisible(false);

    const containers: Record<TabKey, Phaser.GameObjects.Container> = {
      REPAIR: repairCtr, SETTINGS: settingsCtr, CATALOG: catalogCtr, DRONES: droneCtr,
    };
    const tabKeys: TabKey[] = ["REPAIR", "SETTINGS", "CATALOG", "DRONES"];

    const updateTab = (label: TabKey) => {
      panelTitle.setText(label);
      statsCtr.setVisible(label === "REPAIR");
      this.radialDial?.setRepairNavMode(label === "REPAIR");
      for (const k of tabKeys) containers[k].setVisible(k === label);
    };

    this.switchToOrdersTab = () => updateTab("REPAIR");
    const switchToCatalog  = () => updateTab("CATALOG");

    this.events.on("catalog:openToCategory", (id: string) => {
      this.catalogHandles?.openToCategory(id);
      switchToCatalog();
    });

    const tabX      = panelX + panelW / 2 + tabGap + tabW / 2;
    const tabStartY = panelTop + tabH / 2 + 4;
    tabKeys.forEach((label, i) => {
      const ty  = tabStartY + i * (tabH + tabSpc);
      const bg  = this.add.rectangle(tabX, ty, tabW, tabH, Colors.PANEL_DARK, 0.9);
      bg.setStrokeStyle(2, Colors.BORDER_BLUE, 0.8);
      bg.setInteractive();
      bg.on("pointerdown", () => updateTab(label));
      bg.on("pointerover", () => bg.setFillStyle(Colors.BUTTON_HOVER, 0.95));
      bg.on("pointerout",  () => bg.setFillStyle(Colors.PANEL_DARK, 0.9));
      this.add.bitmapText(tabX, ty, "clicker", label[0], 16).setOrigin(0.5).setTint(Colors.HIGHLIGHT_YELLOW);
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Dial
  // ══════════════════════════════════════════════════════════════════════════

  private buildDial(items: any[], dialX: number, dialY: number, dialR: number): void {
    const cfg = this.cache.json.get('rad-dial') as RadDialConfig | undefined;
    let roots: MenuItem[];

    if (cfg) {
      roots = cfg.actions.map((a): MenuItem => {
        if (!a.enabled) return { id: `locked_${a.id}`, name: a.name, icon: a.icon, layers: a.layers };
        const src = a.itemSource ? (items as any[]).find((it: any) => it.id === a.itemSource) : null;
        return { id: a.id, name: a.name, icon: a.icon, layers: a.layers, children: src?.children ?? [] } as MenuItem;
      });
    } else {
      const p    = ProgressionManager.getInstance();
      const cats = p.getUnlockedCategories();
      roots = cats.map(({ categoryId }) => (items as any[]).find((it: any) => it.id === categoryId) as MenuItem).filter(Boolean);
      const needed = ALL_CATEGORY_IDS.length - roots.length;
      for (let i = 0; i < needed; i++) roots.push({ id: `locked_slot_${i}`, name: "LOCKED", icon: "skill-blocked" });
    }

    this.radialDial = new RadialDial(this, dialX, dialY, roots);
    this.radialDial.setRepairNavMode(true);

    this.cornerHUD = new DialCornerHUD(this, dialX, dialY, dialR, {
      openCatalog:        (id) => this.events.emit("catalog:openToCategory", id),
      closeCatalog:       () => this.switchToOrdersTab?.(),
      openMenu:           () => this.scene.start("MainMenu"),
      onAltTerminalToggle: (alt) => {
        this.altTerminalModeActive = alt;
        if (!this.lastTerminalItem || !this.radialDial) return;
        this.radialDial.showTerminalDial(this.lastTerminalItem, 0, alt ? Math.PI / 3 : this.lastTerminalSliceAngle);
      },
    });
  }

  private populateRepairPools(items: any[]): void {
    const cfg = this.cache.json.get('rad-dial') as RadDialConfig | undefined;
    let pool: any[] = [];
    if (cfg) {
      const ra = cfg.actions.find(a => a.id === 'action_reorient');
      if (ra?.itemSource) {
        const src = (items as any[]).find((it: any) => it.id === ra.itemSource);
        if (src) pool = this.collectLeaves(src.children ?? []);
      }
    }
    if (pool.length === 0) {
      const root = (items as any[]).find((it: any) => it.id === 'nav_resources_root');
      if (root) pool = this.collectLeaves(root.children ?? []);
    }
    this.reOrientMode?.setPool(pool);
    if (this.repairContainer) this.reOrientMode?.buildArrangement(this.repairContainer);
  }

  private collectLeaves(nodes: any[]): any[] {
    const out: any[] = [];
    const walk = (arr: any[]) => {
      for (const n of arr) {
        if (n.children?.length) walk(n.children); else out.push(n);
      }
    };
    walk(nodes);
    return out;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Dial events
  // ══════════════════════════════════════════════════════════════════════════

  private wireDialEvents(): void {
    ["dial:itemConfirmed","dial:quantityConfirmed","dial:levelChanged",
     "dial:goBack","dial:repairRotated","dial:repairSettled","catalog:tabActivated"].forEach(e => this.events.removeAllListeners(e));

    this.events.on("dial:itemConfirmed", (data: { item: any; sliceCenterAngle?: number }) => {
      const depth = this.radialDial?.getDepth() ?? 0;
      if (this.activeAction === 'action_reorient' || depth >= 1) {
        this.reOrientMode?.onItemSelected(data.item, this.radialDial!, this.cornerHUD);
        return;
      }
      const iconKey = data.item.icon || data.item.id;
      const qty     = this.orderSlots.find(s => s.iconKey === iconKey)?.placedQty ?? 0;
      this.lastTerminalItem       = data.item;
      this.lastTerminalSliceAngle = data.sliceCenterAngle ?? Math.PI / 2;
      this.radialDial?.showTerminalDial(data.item, qty, this.altTerminalModeActive ? Math.PI / 3 : this.lastTerminalSliceAngle);
      this.cornerHUD?.onItemConfirmed();
    });

    this.events.on("dial:quantityConfirmed", (data: { item: any; quantity: number }) => {
      this.placeItem(data.item.icon || data.item.id, data.quantity);
      this.cornerHUD?.onQuantityConfirmed();
    });

    this.events.on("dial:levelChanged", (data: { depth: number; item: any }) => {
      if (data.depth === 1 && data.item?.id)  this.activeAction = data.item.id;
      else if (data.depth === 0)              this.activeAction = null;
      this.cornerHUD?.onLevelChanged(data.depth, data.item);
    });

    this.events.on("dial:goBack", () => {
      this.reOrientMode?.clearCurrent();
      this.cornerHUD?.onGoBack();
    });

    this.events.on("dial:repairRotated", (data: { rotation: number }) => {
      this.reOrientMode?.onRotated(data);
    });

    this.events.on("dial:repairSettled", (data: { success: boolean }) => {
      const allDone = this.reOrientMode?.onSettled(data, this.cornerHUD) ?? false;
      if (allDone && this.repairContainer) {
        const earned = (this.reOrientMode?.getItems().length ?? 0) * 10;
        this.shiftRevenue += earned;
        this.revenueText?.setText(`Q${this.shiftRevenue}`);
        this.droneStage?.exit(() => {
          this.reOrientMode?.buildArrangement(this.repairContainer!);
          this.droneStage?.spawn(this.repairContainer!);
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
      const txt = this.add.bitmapText(bX, bY, "clicker", String(slot.placedQty), 10).setOrigin(0.5).setTint(bT).setDepth(5);
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
    const rev = this.currentOrder.budget;
    this.shiftRevenue += rev;
    const filled = this.orderSlots.filter(s => s.iconKey !== null);
    if (filled.length > 0 && filled.every((_, i) => this.evaluateSlot(i) === 'correct')) this.shiftBonus += Math.round(rev * 0.5);
    this.revenueText?.setText(`Q${this.shiftRevenue}`);
    this.bonusText?.setText(`Q${this.shiftBonus}`);
    this.flashAndTransition();
  }

  private flashAndTransition(): void {
    const { ordersPanelX: px, ordersPanelWidth: pw, ordersPanelTop: pt, ordersPanelHeight: ph } = this;
    const flash = this.add.rectangle(px, pt + ph / 2 + 10, pw - 8, ph - 70, 0xffffff, 0).setDepth(50);
    this.tweens.add({ targets: flash, alpha: { from: 0, to: 0.3 }, duration: 120, yoyo: true, ease: "Quad.easeOut",
      onComplete: () => {
        const lbl = this.add.bitmapText(px, pt + ph / 2 - 10, "clicker", "ORDER ACCEPTED", 16).setOrigin(0.5).setTint(0x00ff88).setDepth(51);
        this.tweens.add({ targets: lbl, alpha: { from: 1, to: 0 }, duration: 800, delay: 350, ease: "Quad.easeIn",
          onComplete: () => { lbl.destroy(); flash.destroy(); this.loadNextOrder(GameManager.getInstance().getItems()); },
        });
        [this.revenueText, this.bonusText].forEach(t => { if (!t) return; this.tweens.add({ targets: t, scaleX: { from: 1, to: 1.4 }, scaleY: { from: 1, to: 1.4 }, duration: 180, yoyo: true, ease: "Back.easeOut" }); });
      },
    });
  }

  private loadNextOrder(items: any[]): void {
    this.ordersContainer?.removeAll(true);
    this.orderSlots = [];
    this.radialDial?.reset();
    this.currentOrder = buildOrder(items);
    const p = new OrdersPanel(this);
    this.orderSlots = p.build(this.ordersContainer!, this.ordersPanelX, this.ordersPanelTop + 62, this.ordersPanelWidth - 20, this.ordersPanelHeight - 76, this.currentOrder);
  }
}
"""

with open(DEST, 'w') as fh:
    fh.write(CONTENT)

print(f"Written {len(CONTENT)} chars to {DEST}")
