import { Colors } from '../constants/Colors';
import { labelStyle, readoutStyle } from '../constants/FontStyle';
import {
  ProgressionManager,
  CATEGORY_DISPLAY_NAMES,
} from '../managers/ProgressionManager';

interface EndShiftData {
  revenue?: number;
  bonus?: number;
  shiftsCompleted?: number;
}

export class EndShift extends Phaser.Scene {
  private upgradesContainer: Phaser.GameObjects.Container | null = null;
  private upgradesContainerY: number = 0;
  private upgradesAreaHeight: number = 0;
  private quantaBankText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('EndShift');
  }

  create(data: EndShiftData) {
    const progression = ProgressionManager.getInstance();
    const revenue = data?.revenue ?? 0;
    const bonus = data?.bonus ?? 0;
    const shiftsCompleted = data?.shiftsCompleted ?? progression.getShiftsCompleted();

    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const cx = W / 2;

    // ── Background ──────────────────────────────────────────────────────────
    this.add.rectangle(cx, H / 2, W, H, Colors.BACKGROUND_DARK);

    // ── Header panel ────────────────────────────────────────────────────────
    const headerH = 56;
    const headerY = headerH / 2 + 10;
    this.add.rectangle(cx, headerY, W - 20, headerH, Colors.PANEL_DARK, 0.9)
      .setStrokeStyle(2, Colors.BORDER_BLUE);
    this.add.text(cx, headerY - 9, 'SHIFT COMPLETE', labelStyle(16, Colors.HIGHLIGHT_YELLOW_BRIGHT))
      .setOrigin(0.5);
    this.add.text(cx, headerY + 12, `SHIFTS COMPLETED ${shiftsCompleted}`, readoutStyle(10, Colors.MUTED_BLUE))
      .setOrigin(0.5);

    // ── Stats row ────────────────────────────────────────────────────────────
    const statsY = headerY + headerH / 2 + 16 + 20;
    const statsPanelH = 52;
    this.add.rectangle(cx, statsY, W - 20, statsPanelH, Colors.PANEL_MEDIUM, 0.85)
      .setStrokeStyle(1, Colors.BORDER_BLUE);
    const col1 = cx - (W - 40) / 4;
    const col2 = cx + (W - 40) / 4;
    // Revenue
    this.add.text(col1, statsY - 9, 'REVENUE', labelStyle(10, Colors.MUTED_BLUE))
      .setOrigin(0.5);
    this.add.text(col1, statsY + 9, `Q${revenue}`, readoutStyle(14, Colors.HIGHLIGHT_YELLOW_BRIGHT))
      .setOrigin(0.5);
    // Accuracy bonus
    this.add.text(col2, statsY - 9, 'BONUS', labelStyle(10, Colors.MUTED_BLUE))
      .setOrigin(0.5);
    this.add.text(col2, statsY + 9, `Q${bonus}`, readoutStyle(14, Colors.LIGHT_BLUE))
      .setOrigin(0.5);

    // ── Quanta bank display ──────────────────────────────────────────────────
    const bankY = statsY + statsPanelH / 2 + 10 + 20;
    const bankPanelH = 44;
    this.add.rectangle(cx, bankY, W - 20, bankPanelH, Colors.PANEL_DARK, 0.9)
      .setStrokeStyle(2, Colors.NEON_BLUE, 0.8);
    this.add.text(cx - 60, bankY, 'QUANTA BANK', labelStyle(11, Colors.MUTED_BLUE))
      .setOrigin(0, 0.5);
    this.quantaBankText = this.add.text(cx + 60, bankY, `Q${progression.getQuantaBank()}`, readoutStyle(15, Colors.HIGHLIGHT_YELLOW_BRIGHT))
      .setOrigin(1, 0.5);

    // ── Upgrades panel ────────────────────────────────────────────────────────
    const doneH = 56;
    const upgradeLabel = bankY + bankPanelH / 2 + 16;
    this.add.text(cx, upgradeLabel, 'UPGRADES', labelStyle(12, Colors.PALE_BLUE))
      .setOrigin(0.5);

    const upgradesTop = upgradeLabel + 16;
    const upgradesBottom = H - doneH - 20;
    this.upgradesAreaHeight = upgradesBottom - upgradesTop;
    this.upgradesContainerY = upgradesTop;

    this.buildUpgradesPanel(W, cx);

    // ── Action buttons (PLAY AGAIN / MAIN MENU) ─────────────────────────────
    const btnAreaY = H - doneH / 2 - 10;
    const halfW = (W - 52) / 2;
    const playX = cx - halfW / 2 - 4;
    const menuBtnX = cx + halfW / 2 + 4;

    const playBg = this.add.rectangle(playX, btnAreaY, halfW, doneH - 10, Colors.PANEL_DARK, 0.9)
      .setStrokeStyle(2, Colors.NEON_BLUE);
    playBg.setInteractive();
    playBg.on('pointerover', () => playBg.setFillStyle(Colors.BUTTON_HOVER, 0.95));
    playBg.on('pointerout', () => playBg.setFillStyle(Colors.PANEL_DARK, 0.9));
    playBg.on('pointerdown', () => this.scene.start('Game'));
    this.add.text(playX, btnAreaY, 'PLAY AGAIN', labelStyle(14, Colors.NEON_BLUE))
      .setOrigin(0.5);

    const menuBg = this.add.rectangle(menuBtnX, btnAreaY, halfW, doneH - 10, Colors.PANEL_DARK, 0.9)
      .setStrokeStyle(2, Colors.HIGHLIGHT_YELLOW);
    menuBg.setInteractive();
    menuBg.on('pointerover', () => menuBg.setFillStyle(Colors.BUTTON_HOVER, 0.95));
    menuBg.on('pointerout', () => menuBg.setFillStyle(Colors.PANEL_DARK, 0.9));
    menuBg.on('pointerdown', () => this.scene.start('MainMenu'));
    this.add.text(menuBtnX, btnAreaY, 'MAIN MENU', labelStyle(14, Colors.HIGHLIGHT_YELLOW))
      .setOrigin(0.5);
  }

  // ────────────────────────────────────────────────────────────────────────────

  private buildUpgradesPanel(W: number, cx: number): void {
    // Destroy previous panel if it exists
    this.upgradesContainer?.destroy();

    const progression = ProgressionManager.getInstance();
    const areaH = this.upgradesAreaHeight;
    const rowH = 46;
    const rowGap = 6;
    const rowW = W - 24;

    const container = this.add.container(0, this.upgradesContainerY);
    this.upgradesContainer = container;

    // Apply a mask so rows don't overflow below the DONE button
    const maskGfx = this.add.graphics();
    maskGfx.fillStyle(0xffffff, 1);
    maskGfx.fillRect(0, this.upgradesContainerY, W, areaH);
    maskGfx.setVisible(false);
    container.setMask(maskGfx.createGeometryMask());

    const rows: Phaser.GameObjects.GameObject[] = [];
    let rowIndex = 0;

    const addRow = (
      label: string,
      costStr: string,
      canAfford: boolean,
      atMax: boolean,
      onPress: () => void,
    ) => {
      const y = rowIndex * (rowH + rowGap) + rowH / 2;
      const fillColor = atMax ? Colors.PANEL_MEDIUM : Colors.PANEL_DARK;
      const strokeColor = atMax ? Colors.BORDER_BLUE : canAfford ? Colors.NEON_BLUE : Colors.BORDER_BLUE;
      const strokeAlpha = atMax ? 0.5 : canAfford ? 1 : 0.6;

      const bg = this.add.rectangle(cx, y, rowW, rowH, fillColor, 0.85);
      bg.setStrokeStyle(1, strokeColor, strokeAlpha);
      rows.push(bg);

      const labelTint = atMax ? Colors.MUTED_BLUE : Colors.PALE_BLUE;
      const lbl = this.add.text(cx - rowW / 2 + 12, y, label, labelStyle(11, labelTint))
        .setOrigin(0, 0.5);
      rows.push(lbl);

      if (!atMax) {
        const costTint = canAfford ? Colors.HIGHLIGHT_YELLOW_BRIGHT : Colors.MUTED_BLUE;
        const cost = this.add.text(cx + rowW / 2 - 10, y, costStr, readoutStyle(11, costTint))
          .setOrigin(1, 0.5);
        rows.push(cost);
      } else {
        const maxLbl = this.add.text(cx + rowW / 2 - 10, y, 'MAX', labelStyle(10, Colors.MUTED_BLUE))
          .setOrigin(1, 0.5);
        rows.push(maxLbl);
      }

      if (!atMax && canAfford) {
        bg.setInteractive();
        bg.on('pointerover', () => bg.setFillStyle(Colors.BUTTON_HOVER, 0.95));
        bg.on('pointerout', () => bg.setFillStyle(fillColor, 0.85));
        bg.on('pointerdown', onPress);
      }

      rowIndex++;
    };

    // ── Deepen rows for each unlocked category ────────────────────────────────
    const unlocked = progression.getUnlockedCategories();

    // Section label
    if (unlocked.length > 0) {
      const secY = rowIndex * (rowH + rowGap) + rowH / 2;
      const secLbl = this.add.text(cx, secY, 'DEEPEN ACCESS', labelStyle(10, Colors.TEXT_MUTED_BLUE))
        .setOrigin(0.5);
      rows.push(secLbl);
      rowIndex++;
    }

    for (const cat of unlocked) {
      const name = CATEGORY_DISPLAY_NAMES[cat.categoryId] ?? cat.categoryId;
      const atMax = !progression.canDeepen(cat.categoryId);
      const cost = progression.getCostToDeepen(cat.categoryId);
      const canAfford = !atMax && progression.canAfford(cost);
      const lvlStr = atMax ? `L${cat.depth}` : `L${cat.depth} TO L${cat.depth + 1}`;
      const label = `${name} ${lvlStr}`;
      const costStr = `Q${cost}`;

      addRow(label, costStr, canAfford, atMax, () => {
        progression.deepenCategory(cat.categoryId);
        this.quantaBankText?.setText(`Q${progression.getQuantaBank()}`);
        this.buildUpgradesPanel(W, cx);
      });
    }

    // ── Unlock new category rows ──────────────────────────────────────────────
    const available = progression.getAvailableToUnlock();

    if (available.length > 0) {
      const secY = rowIndex * (rowH + rowGap) + rowH / 2;
      const secLbl = this.add.text(cx, secY, 'UNLOCK NEW', labelStyle(10, Colors.TEXT_MUTED_BLUE))
        .setOrigin(0.5);
      rows.push(secLbl);
      rowIndex++;
    }

    if (available.length > 0) {
      const cost = progression.getCostToUnlockNew();
      const canAfford = progression.canAfford(cost);
      for (const catId of available) {
        const name = CATEGORY_DISPLAY_NAMES[catId] ?? catId;
        const label = `UNLOCK ${name}`;
        addRow(label, `Q${cost}`, canAfford, false, () => {
          progression.purchaseNewCategory(catId);
          this.quantaBankText?.setText(`Q${progression.getQuantaBank()}`);
          this.buildUpgradesPanel(W, cx);
        });
      }
    }

    // Nothing to show
    if (rowIndex === 0) {
      const lbl = this.add.text(cx, rowH / 2, 'ALL UPGRADES MAXED', labelStyle(14, Colors.HIGHLIGHT_YELLOW))
        .setOrigin(0.5);
      rows.push(lbl);
    }

    container.add(rows);

    // ── Touch scroll ─────────────────────────────────────────────────────────
    const totalH = rowIndex * (rowH + rowGap);
    let scrollOffset = 0;
    const minOffset = Math.min(0, areaH - totalH);

    if (totalH > areaH) {
      let touchStartY = 0;
      let dragging = false;

      this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (p.y >= this.upgradesContainerY && p.y <= this.upgradesContainerY + areaH) {
          touchStartY = p.y;
          dragging = true;
        }
      });
      this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
        if (!dragging) return;
        const dy = touchStartY - p.y;
        touchStartY = p.y;
        scrollOffset = Math.max(minOffset, Math.min(0, scrollOffset - dy));
        container.y = this.upgradesContainerY + scrollOffset;
      });
      this.input.on('pointerup', () => { dragging = false; });
      this.input.on('wheel', (_p: Phaser.Input.Pointer, _go: any, _dx: number, dy: number) => {
        scrollOffset = Math.max(minOffset, Math.min(0, scrollOffset - dy * 0.4));
        container.y = this.upgradesContainerY + scrollOffset;
      });
    }
  }
}

