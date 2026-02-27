import { MenuItem } from '../../../types/GameTypes';
import { IDialFace } from '../IDialFace';

/**
 * All parameters that might be needed to initialise any terminal face.
 * Individual terminal factories only use the fields relevant to them.
 */
export interface TerminalContext {
  /** Quantity already in the active order slot (default 0). */
  existingQty?:       number;
  /** Dial angle (radians) where the arc trigger should start (default π/2). */
  startAngle?:        number;
  /** Current rotation of the item in degrees (for repair terminal). */
  currentRotationDeg?: number;
  /** Target rotation offset in degrees (for repair terminal). */
  targetRotationDeg?:  number;
}

/**
 * Factory signature for terminal dial faces.
 */
export type TerminalFactory = (item: MenuItem, ctx: TerminalContext) => IDialFace;

/**
 * Maps (actionId, itemType) pairs to terminal-face factories.
 *
 * Lookup falls back through a chain of increasing generality:
 *   (actionId, itemType) → (actionId, '*') → ('*', itemType) → ('*', '*')
 *
 * The ('*', '*') fallback must always exist; it is seeded by RadialDial with a
 * QuantityTerminalFace factory to reproduce the current default behavior.
 *
 * Usage:
 *   TerminalRegistry.register('nav_armaments_root', 'reorientation',
 *     (item, ctx) => new RepairTerminalFace(item, ctx.currentRotationDeg ?? 0, ctx.targetRotationDeg ?? 0));
 */
export class TerminalRegistry {
  private static factories: Map<string, TerminalFactory> = new Map();

  /** Register a terminal factory for a specific (actionId, itemType) pair.
   *  Use '*' as a wildcard for either field. */
  static register(actionId: string, itemType: string, factory: TerminalFactory): void {
    TerminalRegistry.factories.set(`${actionId}:${itemType}`, factory);
  }

  /**
   * Resolve the terminal face for an (actionId, itemType) pair.
   * Falls back through the wildcard chain described in the class comment.
   */
  static resolve(
    actionId: string,
    itemType: string | undefined,
    item: MenuItem,
    ctx: TerminalContext,
  ): IDialFace {
    const candidates: Array<string | null> = [
      itemType ? `${actionId}:${itemType}` : null,
      `${actionId}:*`,
      itemType ? `*:${itemType}` : null,
      '*:*',
    ];

    for (const key of candidates) {
      if (!key) continue;
      const factory = TerminalRegistry.factories.get(key);
      if (factory) return factory(item, ctx);
    }

    throw new Error(
      `TerminalRegistry: no factory for (${actionId}, ${itemType}) and no wildcard registered. ` +
      'Call TerminalRegistry.register("*", "*", ...) first.'
    );
  }

  /** Remove all registrations. Useful in tests for isolation. */
  static reset(): void {
    TerminalRegistry.factories.clear();
  }
}
