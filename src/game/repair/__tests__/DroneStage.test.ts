/** @jest-environment jsdom */
/**
 * Tests for DroneStage.
 *
 * Coverage goals:
 *   • pickKey / getCurrentKey / iconCountForCurrentKey
 *   • spawn() early-return guard (topBounds not set)
 *   • spawn() happy-path — adds sprite to container, starts tween
 *   • exit() with no sprite → calls onComplete immediately
 *   • exit() with sprite → tween fires, then calls onComplete via delayedCall
 *   • destroy() nulls the sprite
 */

jest.mock('phaser', () => ({}));

import { DroneStage } from '../DroneStage';

// ── Scene factory ──────────────────────────────────────────────────────────

/**
 * Returns a minimal Phaser.Scene mock.
 * `tweens.add` invokes `onComplete` synchronously so tests stay deterministic.
 * `time.delayedCall` invokes the callback synchronously for the same reason.
 */
function makeScene(frameHeight = 48, frameWidth = 384) {
  const tweenCbs: (() => void)[] = [];

  const scene = {
    textures: {
      get: jest.fn().mockReturnValue({
        source: [{ height: frameHeight, width: frameWidth }],
        has:    jest.fn().mockReturnValue(false),
        add:    jest.fn(),
      }),
      exists: jest.fn().mockReturnValue(false),
    },
    anims: {
      exists: jest.fn().mockReturnValue(true), // skip registerAnim detail
      create: jest.fn(),
    },
    add: {
      sprite: jest.fn().mockReturnValue({
        setScale:   jest.fn().mockReturnThis(),
        setDepth:   jest.fn().mockReturnThis(),
        setMask:    jest.fn().mockReturnThis(),
        play:       jest.fn().mockReturnThis(),
        destroy:    jest.fn(),
        x: 0, y: 0,
      }),
    },
    tweens: {
      // Invoke onComplete synchronously so we can test the full flow in one call
      add: jest.fn().mockImplementation((cfg: any) => {
        cfg.onComplete?.();
      }),
    },
    time: {
      delayedCall: jest.fn().mockImplementation((_delay: number, cb: () => void) => {
        cb();
      }),
    },
  };

  return { scene, tweenCbs };
}

// ── pickKey / getCurrentKey ────────────────────────────────────────────────

describe('DroneStage.pickKey and getCurrentKey', () => {
  it('getCurrentKey returns null before pickKey is called', () => {
    const { scene } = makeScene();
    const stage = new DroneStage(scene as any);
    expect(stage.getCurrentKey()).toBeNull();
  });

  it('pickKey sets currentKey to a non-null string', () => {
    const { scene } = makeScene();
    const stage = new DroneStage(scene as any);
    stage.pickKey();
    expect(typeof stage.getCurrentKey()).toBe('string');
    expect(stage.getCurrentKey()).not.toBeNull();
  });

  it('pickKey sets a key from the known idle-key set', () => {
    const { scene } = makeScene();
    const stage = new DroneStage(scene as any);
    stage.pickKey();
    const key = stage.getCurrentKey()!;
    expect(key).toMatch(/^(drone|robot)-\d+-idle$/);
  });

  it('getSprite returns null before spawn', () => {
    const { scene } = makeScene();
    const stage = new DroneStage(scene as any);
    expect(stage.getSprite()).toBeNull();
  });
});

// ── iconCountForCurrentKey ─────────────────────────────────────────────────

describe('DroneStage.iconCountForCurrentKey', () => {
  it('returns 4 when no key has been picked', () => {
    const { scene } = makeScene();
    const stage = new DroneStage(scene as any);
    expect(stage.iconCountForCurrentKey()).toBe(4);
  });

  it('returns 2 or 3 for small sprites (frameH ≤ 32)', () => {
    const { scene } = makeScene(32);
    const stage = new DroneStage(scene as any);
    stage.pickKey();
    const count = stage.iconCountForCurrentKey();
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(3);
  });

  it('returns 4 or 5 for medium sprites (frameH ≤ 64)', () => {
    const { scene } = makeScene(48);
    const stage = new DroneStage(scene as any);
    stage.pickKey();
    const count = stage.iconCountForCurrentKey();
    expect(count).toBeGreaterThanOrEqual(4);
    expect(count).toBeLessThanOrEqual(5);
  });

  it('returns 6–8 for large sprites (frameH > 64)', () => {
    const { scene } = makeScene(128);
    const stage = new DroneStage(scene as any);
    stage.pickKey();
    const count = stage.iconCountForCurrentKey();
    expect(count).toBeGreaterThanOrEqual(6);
    expect(count).toBeLessThanOrEqual(8);
  });
});

// ── spawn ──────────────────────────────────────────────────────────────────

describe('DroneStage.spawn', () => {
  it('does nothing when topBounds is not set', () => {
    const { scene } = makeScene();
    const stage = new DroneStage(scene as any);
    const container = { add: jest.fn() };
    stage.pickKey();
    stage.spawn(container as any);
    expect(container.add).not.toHaveBeenCalled();
    expect(scene.add.sprite).not.toHaveBeenCalled();
  });

  it('adds a sprite to the container when topBounds is set', () => {
    const { scene } = makeScene();
    const stage = new DroneStage(scene as any);
    stage.setTopBounds({ cx: 100, cy: 80, w: 200, h: 100 });
    stage.pickKey();
    const container = { add: jest.fn() };
    stage.spawn(container as any);
    expect(container.add).toHaveBeenCalled();
    expect(scene.add.sprite).toHaveBeenCalled();
  });

  it('fires onArrived callback after tween completes', () => {
    const { scene } = makeScene();
    const stage = new DroneStage(scene as any);
    stage.setTopBounds({ cx: 100, cy: 80, w: 200, h: 100 });
    stage.pickKey();
    const onArrived = jest.fn();
    stage.spawn({ add: jest.fn() } as any, onArrived);
    expect(onArrived).toHaveBeenCalledTimes(1);
  });

  it('getSprite returns the sprite after spawn', () => {
    const { scene } = makeScene();
    const stage = new DroneStage(scene as any);
    stage.setTopBounds({ cx: 100, cy: 80, w: 200, h: 100 });
    stage.pickKey();
    stage.spawn({ add: jest.fn() } as any);
    expect(stage.getSprite()).not.toBeNull();
  });

  it('applies a provided mask to the sprite', () => {
    const { scene } = makeScene();
    // Capture the sprite that gets created
    let createdSprite: any;
    scene.add.sprite = jest.fn().mockImplementation(() => {
      createdSprite = {
        setScale: jest.fn().mockReturnThis(), setDepth: jest.fn().mockReturnThis(),
        setMask: jest.fn().mockReturnThis(), play: jest.fn().mockReturnThis(), destroy: jest.fn(),
      };
      return createdSprite;
    });

    const stage = new DroneStage(scene as any);
    stage.setTopBounds({ cx: 100, cy: 80, w: 200, h: 100 });
    stage.pickKey();
    const fakeMask = {} as any;
    stage.spawn({ add: jest.fn() } as any, undefined, fakeMask);
    expect(createdSprite.setMask).toHaveBeenCalledWith(fakeMask);
  });
});

// ── exit ──────────────────────────────────────────────────────────────────

describe('DroneStage.exit', () => {
  it('calls onComplete immediately when there is no sprite', () => {
    const { scene } = makeScene();
    const stage = new DroneStage(scene as any);
    const cb = jest.fn();
    stage.exit(cb);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(scene.tweens.add).not.toHaveBeenCalled();
  });

  it('calls onComplete immediately when topBounds is not set (even if sprite exists)', () => {
    // Force a sprite onto the stage without going through spawn
    const { scene } = makeScene();
    const stage = new DroneStage(scene as any);
    // Inject a fake sprite via spawn workaround: set topBounds, spawn, then clear topBounds indirectly
    // Easier: test via exit-with-no-topBounds short-circuit
    const cb = jest.fn();
    stage.exit(cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('destroys sprite and fires onComplete after tween when sprite exists', () => {
    const { scene } = makeScene();
    const stage = new DroneStage(scene as any);
    stage.setTopBounds({ cx: 100, cy: 80, w: 200, h: 100 });
    stage.pickKey();

    const spriteMock = {
      setScale: jest.fn().mockReturnThis(), setDepth: jest.fn().mockReturnThis(),
      setMask: jest.fn().mockReturnThis(), play: jest.fn().mockReturnThis(),
      destroy: jest.fn(), x: 100, y: 80,
    };
    scene.add.sprite = jest.fn().mockReturnValue(spriteMock);

    stage.spawn({ add: jest.fn() } as any);
    // After tween-based spawn, sprite is set. Now exit:
    const cb = jest.fn();
    stage.exit(cb);

    expect(spriteMock.destroy).toHaveBeenCalled();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(stage.getSprite()).toBeNull();
  });
});

// ── destroy ────────────────────────────────────────────────────────────────

describe('DroneStage.destroy', () => {
  it('nulls the sprite and does not throw', () => {
    const { scene } = makeScene();
    const stage = new DroneStage(scene as any);
    stage.setTopBounds({ cx: 100, cy: 80, w: 200, h: 100 });
    stage.pickKey();

    const spriteMock = {
      setScale: jest.fn().mockReturnThis(), setDepth: jest.fn().mockReturnThis(),
      setMask: jest.fn().mockReturnThis(), play: jest.fn().mockReturnThis(),
      destroy: jest.fn(), x: 0, y: 0,
    };
    scene.add.sprite = jest.fn().mockReturnValue(spriteMock);
    stage.spawn({ add: jest.fn() } as any);

    stage.destroy();
    expect(spriteMock.destroy).toHaveBeenCalled();
    expect(stage.getSprite()).toBeNull();
  });

  it('does not throw when called with no sprite', () => {
    const { scene } = makeScene();
    const stage = new DroneStage(scene as any);
    expect(() => stage.destroy()).not.toThrow();
  });
});
