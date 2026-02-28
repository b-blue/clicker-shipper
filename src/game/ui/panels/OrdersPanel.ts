import Phaser from 'phaser';
import { AssetLoader } from '../../managers/AssetLoader';
import { Colors } from '../../constants/Colors';
import { labelStyle, readoutStyle } from '../../constants/FontStyle';
import { Order } from '../../types/GameTypes';
import { OrderSlot } from '../../orders/OrderTypes';

/**
 * Builds the ORDERS tab content for a given Order object.
 * Returns the created OrderSlot array for use by Game.ts order-fulfillment logic.
 */
export class OrdersPanel {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Main entry point — renders the full order view into `container`.
   * @returns the array of fulfillment slots (initially all empty).
   */
  build(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    height: number,
    order: Order,
  ): OrderSlot[] {
    const contentX   = x - width / 2 + 12;
    const rightEdge  = x + width / 2 - 12;
    const contentBottom = y + height;

    const { slots, boxRowTop } = this.buildFulfillmentSlotRow(container, x, width, contentBottom, order.requirements);
    this.buildOrderRequirementRows(container, x, width, boxRowTop, order, contentX, rightEdge);

    return slots;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Renders the bottom strip of fulfillment slots — one per distinct item type.
   */
  private buildFulfillmentSlotRow(
    container: Phaser.GameObjects.Container,
    x: number,
    width: number,
    contentBottom: number,
    requirements: Order['requirements'],
  ): { slots: OrderSlot[]; boxRowTop: number } {
    const totalSlots    = requirements.length;
    const boxRowHeight  = 64;
    const boxGap        = 6;
    const boxSize       = Math.min(
      48,
      Math.floor(
        (width - 16 - (Math.max(1, totalSlots) - 1) * boxGap) / Math.max(1, totalSlots),
      ),
    );
    const rowTotalWidth = totalSlots * boxSize + (totalSlots - 1) * boxGap;
    const boxRowTop     = contentBottom - boxRowHeight;
    const boxRowCenterY = boxRowTop + boxRowHeight / 2;
    const boxStartX     = x - rowTotalWidth / 2;

    // Row background strip
    const rowStripBg = this.scene.add.graphics();
    rowStripBg.fillStyle(0x071428, 0.9);
    rowStripBg.fillRect(x - width / 2 + 4, boxRowTop, width - 8, boxRowHeight);
    rowStripBg.lineStyle(1, Colors.BORDER_BLUE, 0.6);
    rowStripBg.strokeRect(x - width / 2 + 4, boxRowTop, width - 8, boxRowHeight);
    container.add(rowStripBg);

    const slots: OrderSlot[] = [];
    for (let i = 0; i < totalSlots; i++) {
      const bx = boxStartX + i * (boxSize + boxGap) + boxSize / 2;
      const by = boxRowCenterY;

      const boxBg = this.scene.add.graphics();
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

    const aboveBoxSep = this.scene.add.graphics();
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
    const rowHeight       = 48;
    const rowPadding      = 4;
    const fontSize        = 12;
    const detailFontSize  = 10;
    const qtyFontSize     = Math.round(detailFontSize * (4 / 3));
    const budgetLineHeight = 28;
    const orderListHeight  = order.requirements.length * rowHeight + budgetLineHeight;
    const orderListTop     = (boxRowTop - 10) - orderListHeight;

    order.requirements.forEach((req, index) => {
      const rowTop = orderListTop + index * rowHeight;

      const rowBg = this.scene.add.graphics();
      rowBg.fillStyle(index % 2 === 0 ? 0x112244 : 0x0d1a35, 0.6);
      rowBg.fillRect(x - width / 2 + 4, rowTop + rowPadding / 2, width - 8, rowHeight - rowPadding);
      container.add(rowBg);

      const nameLine1Y = rowTop + rowPadding + fontSize / 2 + 2;
      if (AssetLoader.textureExists(this.scene, 'hash-sign')) {
        const bullet = AssetLoader.createImage(this.scene, contentX + 4, nameLine1Y, 'hash-sign');
        bullet.setScale(0.45).setOrigin(0, 0.5).setTint(0xffffff);
        container.add(bullet);
      }
      container.add(
        this.scene.add.text(contentX + 22, nameLine1Y, req.itemName.toUpperCase(), labelStyle(fontSize))
          .setOrigin(0, 0.5).setWordWrapWidth(width - 36),
      );

      const detailY = nameLine1Y + fontSize + 4;
      container.add(
        this.scene.add.text(contentX + 16, detailY, `X${req.quantity}`, readoutStyle(qtyFontSize, 0xaaaacc))
          .setOrigin(0, 0.5),
      );
      container.add(
        this.scene.add.text(rightEdge, detailY, `Q${req.cost * req.quantity}`, readoutStyle(detailFontSize, Colors.HIGHLIGHT_YELLOW))
          .setOrigin(1, 0.5),
      );

      if (index < order.requirements.length - 1) {
        const sep = this.scene.add.graphics();
        sep.lineStyle(1, Colors.BORDER_BLUE, 0.3);
        sep.lineBetween(
          x - width / 2 + 8, rowTop + rowHeight - rowPadding / 2,
          x + width / 2 - 8, rowTop + rowHeight - rowPadding / 2,
        );
        container.add(sep);
      }
    });

    const budgetY = orderListTop + order.requirements.length * rowHeight;
    const separatorLine = this.scene.add.graphics();
    separatorLine.lineStyle(1, Colors.BORDER_BLUE, 0.7);
    separatorLine.lineBetween(x - width / 2 + 8, budgetY, x + width / 2 - 8, budgetY);
    container.add(separatorLine);

    container.add(
      this.scene.add.text(contentX, budgetY + budgetLineHeight / 2, 'TOTAL BUDGET', labelStyle(fontSize))
        .setOrigin(0, 0.5),
    );
    container.add(
      this.scene.add.text(rightEdge, budgetY + budgetLineHeight / 2, `Q${order.budget}`, readoutStyle(fontSize + 1, Colors.HIGHLIGHT_YELLOW_BRIGHT))
        .setOrigin(1, 0.5),
    );
  }
}
