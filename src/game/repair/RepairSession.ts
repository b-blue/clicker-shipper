import Phaser from 'phaser';
import { IRepairTask } from './IRepairTask';
import { ReOrientMode } from './ReOrientMode';

/**
 * Represents the lifetime of a single drone repair visit.
 *
 * Created when a drone's arrangement is built; destroyed after its
 * dematerialize animation completes and the next drone cycle begins.
 *
 * Owns exactly one active IRepairTask. As more repair modes are introduced
 * RepairSession is the place to sequence them (e.g. reorient → rewire).
 */
export class RepairSession {
  readonly droneKey: string;
  readonly task: IRepairTask;

  constructor(scene: Phaser.Scene, droneKey: string) {
    this.droneKey = droneKey;
    this.task     = new ReOrientMode(scene);
  }

  destroy(): void {
    this.task.deactivate();
    this.task.destroy();
  }
}
