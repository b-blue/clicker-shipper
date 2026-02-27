import { MenuItem } from '../../../types/GameTypes';
import { IDialFace } from '../IDialFace';

/**
 * Factory signature for sub-dial faces.
 * @param actionId  The id of the root-level action that was selected.
 * @param items     The children of that action node (the items to display).
 */
export type SubDialFactory = (actionId: string, items: MenuItem[]) => IDialFace;

/**
 * Maps root-level action ids to sub-dial face factories.
 *
 * Registration is done once at startup (e.g. in Game.create before the dial
 * is constructed). Unregistered actions fall back to a StandardNavFace.
 *
 * Usage:
 *   SubDialRegistry.register('nav_armaments_root', (actionId, items) =>
 *     new CustomArmamentsNavFace(items));
 */
export class SubDialRegistry {
  private static factories: Map<string, SubDialFactory> = new Map();

  /** Register a custom sub-dial factory for a specific action id. */
  static register(actionId: string, factory: SubDialFactory): void {
    SubDialRegistry.factories.set(actionId, factory);
  }

  /**
   * Resolve the sub-dial face for an action.
   * Falls back to a default StandardNavFace if no registration exists.
   * The default factory is injected at startup by RadialDial to avoid a
   * circular module dependency (registries ← faces ← registries).
   */
  static resolve(actionId: string, items: MenuItem[]): IDialFace {
    const factory = SubDialRegistry.factories.get(actionId);
    if (factory) return factory(actionId, items);

    const defaultFactory = SubDialRegistry.factories.get('__default__');
    if (defaultFactory) return defaultFactory(actionId, items);

    // Belt-and-suspenders: should not reach here if RadialDial bootstrapped correctly.
    throw new Error(
      `SubDialRegistry: no factory for actionId "${actionId}" and no default registered. ` +
      'Call SubDialRegistry.setDefault() or register a factory first.'
    );
  }

  /**
   * Register the fallback factory used when no specific action entry exists.
   * Called once by RadialDial's module initializer.
   */
  static setDefault(factory: SubDialFactory): void {
    SubDialRegistry.factories.set('__default__', factory);
  }

  /** Remove all registrations. Useful in tests for isolation. */
  static reset(): void {
    SubDialRegistry.factories.clear();
  }
}
