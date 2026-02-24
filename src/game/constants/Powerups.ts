/**
 * Powerup system constants.
 *
 * POWERUP_IDS  — canonical string identifiers; add one entry per new powerup.
 * POWERUP_CATALOG — human-readable metadata and cost per powerup.
 *
 * The `type` field is the future-flexibility hook:
 *   'permanent'  — bought once, active for all future shifts (checked via hasPowerup)
 *   'consumable' — bought per-shift, depleted on use (future: consumablePowerups field)
 *   'toggle'     — bought once, player can enable/disable per-shift (future: activePowerups field)
 *
 * Call sites should always use hasPowerup(id) — the internal storage strategy
 * can evolve per type without changing any rendering code.
 */

export const POWERUP_IDS = {
  /**
   * Show a dimmed ghost of the required item inside each unfulfilled order slot.
   * Without this, slots appear as empty boxes and the player must recall requirements
   * from the order list above.
   */
  ORDER_HINTS: 'ORDER_HINTS',
} as const;

export type PowerupId = (typeof POWERUP_IDS)[keyof typeof POWERUP_IDS];

export interface PowerupEntry {
  name: string;
  description: string;
  cost: number;
  type: 'permanent' | 'consumable' | 'toggle';
}

export const POWERUP_CATALOG: Record<string, PowerupEntry> = {
  [POWERUP_IDS.ORDER_HINTS]: {
    name: 'ORDER HINTS',
    description: 'Show ghost icons inside unfilled order slots to remind you what item is required.',
    cost: 50,
    type: 'permanent',
  },
};
