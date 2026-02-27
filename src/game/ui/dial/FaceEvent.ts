import { MenuItem } from '../../types/GameTypes';

/**
 * Typed events that a dial face can fire back to the RadialDial coordinator.
 * The coordinator handles each event and updates the face stack accordingly.
 */
export type FaceEvent =
  /** A navigable slice was confirmed — push a sub-dial face for this item. */
  | { type: 'drillDown';         item: MenuItem }
  /** User tapped the center (or otherwise cancelled) — pop this face. */
  | { type: 'goBack' }
  /** A leaf item was confirmed — look up and push the matching terminal face. */
  | { type: 'itemConfirmed';     item: MenuItem; sliceCenterAngle: number }
  /** Quantity was committed — emit scene event and full-reset the dial. */
  | { type: 'quantityConfirmed'; item: MenuItem; quantity: number }
  /** Repair rotation settled — emit scene event (face stays until dismissed). */
  | { type: 'repairSettled';     success: boolean }
  /** Repair rotation changed — forward to scene listeners. */
  | { type: 'repairRotated';     rotation: number };
