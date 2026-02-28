/** @jest-environment jsdom */
/**
 * Tests for RepairSession.
 *
 * Coverage goals:
 *   • Constructor stores droneKey and creates a task
 *   • task is a ReOrientMode (IRepairTask) — basic method delegation works
 *   • destroy() calls task.deactivate() then task.destroy()
 */

jest.mock('phaser', () => ({}));

// Mock ReOrientMode so we can spy on its lifecycle methods without needing
// a full Phaser scene.
jest.mock('../ReOrientMode', () => {
  return {
    ReOrientMode: jest.fn().mockImplementation(() => ({
      setPool:       jest.fn(),
      getItems:      jest.fn().mockReturnValue([]),
      getWireframe:  jest.fn().mockReturnValue(null),
      isAllSolved:   jest.fn().mockReturnValue(false),
      onItemSelected: jest.fn(),
      clearCurrent:  jest.fn(),
      resolveItem:   jest.fn(),
      activate:      jest.fn(),
      deactivate:    jest.fn(),
      destroy:       jest.fn(),
      buildArrangement: jest.fn(),
    })),
  };
});

import { RepairSession } from '../RepairSession';
import { ReOrientMode } from '../ReOrientMode';

// ── Constructor ────────────────────────────────────────────────────────────

describe('RepairSession constructor', () => {
  it('stores droneKey', () => {
    const session = new RepairSession({} as any, 'drone-3-idle');
    expect(session.droneKey).toBe('drone-3-idle');
  });

  it('stores an empty string droneKey when passed empty string', () => {
    const session = new RepairSession({} as any, '');
    expect(session.droneKey).toBe('');
  });

  it('creates a ReOrientMode task', () => {
    const scene   = {} as any;
    const session = new RepairSession(scene, 'drone-1-idle');
    expect(ReOrientMode).toHaveBeenCalledWith(scene);
    expect(session.task).toBeDefined();
  });

  it('task exposes IRepairTask interface methods', () => {
    const session = new RepairSession({} as any, 'drone-7-idle');
    expect(typeof session.task.setPool).toBe('function');
    expect(typeof session.task.getItems).toBe('function');
    expect(typeof session.task.isAllSolved).toBe('function');
    expect(typeof session.task.onItemSelected).toBe('function');
    expect(typeof session.task.clearCurrent).toBe('function');
    expect(typeof session.task.resolveItem).toBe('function');
    expect(typeof session.task.activate).toBe('function');
    expect(typeof session.task.deactivate).toBe('function');
    expect(typeof session.task.destroy).toBe('function');
    expect(typeof session.task.buildArrangement).toBe('function');
  });
});

// ── Task delegation ────────────────────────────────────────────────────────

describe('RepairSession — task delegation', () => {
  it('getItems() returns [] by default', () => {
    const session = new RepairSession({} as any, 'robot-2-idle');
    expect(session.task.getItems()).toEqual([]);
  });

  it('isAllSolved() returns false by default', () => {
    const session = new RepairSession({} as any, 'robot-2-idle');
    expect(session.task.isAllSolved()).toBe(false);
  });

  it('setPool() can be called without throwing', () => {
    const session = new RepairSession({} as any, 'robot-2-idle');
    expect(() => session.task.setPool([{ id: 'x', icon: 'icon-x' }])).not.toThrow();
  });
});

// ── destroy ────────────────────────────────────────────────────────────────

describe('RepairSession.destroy', () => {
  it('calls task.deactivate() and task.destroy()', () => {
    const session = new RepairSession({} as any, 'drone-5-idle');
    session.destroy();
    expect(session.task.deactivate).toHaveBeenCalledTimes(1);
    expect(session.task.destroy).toHaveBeenCalledTimes(1);
  });

  it('calls deactivate before destroy', () => {
    const callOrder: string[] = [];
    const session = new RepairSession({} as any, 'drone-5-idle');
    (session.task.deactivate as jest.Mock).mockImplementation(() => callOrder.push('deactivate'));
    (session.task.destroy   as jest.Mock).mockImplementation(() => callOrder.push('destroy'));
    session.destroy();
    expect(callOrder).toEqual(['deactivate', 'destroy']);
  });
});

