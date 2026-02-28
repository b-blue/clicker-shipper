import Phaser from 'phaser';
import { MenuItem } from '../types/GameTypes';
import { RepairItem } from './RepairTypes';
import { DroneWireframe } from './DroneWireframe';

export type TaskBounds = { cx: number; cy: number; w: number; h: number };

/**
 * Contract for a single repair action type (e.g. Re-Orient, Re-Wire, Re-Build).
 *
 * A task is responsible for:
 *   - Choosing which items from the pool form the arrangement
 *   - Building and destroying that arrangement's Phaser objects
 *   - Responding to top-level nav events (item selected, go-back)
 *   - Subscribing to its own terminal-dial scene events via activate()
 *   - Emitting outward scene events:
 *       repair:showDial   { item, currentRotationDeg, targetRotationDeg }
 *       repair:noMatch    {}
 *       repair:itemFailed { iconKey }  (item permanently failed; needs replacement)
 *       repair:itemSolved {}
 *       repair:allSolved  {}
 *
 * Terminal-dial events (e.g. dial:repairRotated, dial:repairSettled) are the
 * task's own internal concern — they must NOT appear on this interface, as
 * different task types may use entirely different terminal dials.
 */
export interface IRepairTask {
  /**
   * Build the icon grid into `container` at alpha 0. Call RepairPanel.materialize()
   * once the drone has arrived.
   */
  buildArrangement(
    container: Phaser.GameObjects.Container,
    bounds: TaskBounds,
    count: number,
    droneKey?: string,
  ): void;

  setPool(items: any[]): void;
  getItems(): RepairItem[];
  getWireframe(): DroneWireframe | null;
  isAllSolved(): boolean;

  /** Called when dial:itemConfirmed fires while this task is active. */
  onItemSelected(item: MenuItem): void;

  /** Called when dial:goBack fires — cancel the current in-progress item. */
  clearCurrent(): void;

  /**
   * Force-resolves a previously-failed item by iconKey (called when its
   * replacement delivery completes).  Emits repair:itemSolved or
   * repair:allSolved as appropriate.
   */
  resolveItem(iconKey: string): void;

  /**
   * Subscribe to whatever terminal-dial scene events this task needs.
   * Called by RepairSession / RepairPanel after buildArrangement.
   */
  activate(): void;

  /** Unsubscribe from scene events. */
  deactivate(): void;

  destroy(): void;
}
