/**
 * A positional fulfillment slot in the (legacy) orders row.
 * Slots start empty (iconKey === null). Items are placed left-to-right.
 * Removing an item collapses the row leftward.
 */
export interface OrderSlot {
  iconKey: string | null;   // null = empty slot
  placedQty: number;        // 0 when empty
  x: number;
  y: number;
  size: number;
  slotBg: Phaser.GameObjects.Graphics;
  slotIcon: Phaser.GameObjects.Image | null;
  badgeGraphic: Phaser.GameObjects.Graphics | null;
  badgeText: Phaser.GameObjects.BitmapText | null;
}
