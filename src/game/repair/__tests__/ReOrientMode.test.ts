/** @jest-environment jsdom */
/**
 * Tests for ReOrientMode and DeliveryQueue.
 *
 * Coverage goals:
 *   • DroneWireframe.getPipelineInstance defensive guards (regression for real crash)
 *   • buildArrangement wireframe colour wiring
 *   • ReOrientMode item state, onItemSelected routing
 *   • Repair success / failure settlement flows (dial:repairSettled)
 *   • resolveItem (delivery-completion path)
 *   • DeliveryQueue timer lifecycle, progress tracking, cancellation
 *
 * Nothing is rendered; all Phaser / scene dependencies are mocked.
 */

jest.mock('phaser', () => ({
  default: {
    Renderer: {
      WebGL: {
        Pipelines: {
          PostFXPipeline: class {
            uniforms: Record<string, any> = {};
            set3f = jest.fn();
            set1f = jest.fn();
          },
        },
      },
    },
  },
}));

jest.mock('../../managers/AssetLoader', () => ({
  AssetLoader: {
    textureExists: jest.fn().mockReturnValue(false),
    createImage: jest.fn(),
  },
}));

import { ReOrientMode } from '../ReOrientMode';
import { DroneWireframe } from '../DroneWireframe';
import { DeliveryQueue } from '../DeliveryQueue';

// ── Shared scene factories ─────────────────────────────────────────────────

/**
 * Returns a Phaser.Scene-shaped mock whose event system actually dispatches
 * to registered handlers, so scene.events.emit(...) invokes activate()-ed
 * listeners on the mode under test.
 */
function makeBehaviorScene() {
  type Handler = (data?: any) => void;
  const handlers: Record<string, Handler[]> = {};
  const emittedEvents: Array<{ event: string; data?: any }> = [];

  const events = {
    on: jest.fn((ev: string, fn: Handler, ctx?: any) => {
      const bound = ctx ? fn.bind(ctx) : fn;
      (handlers[ev] ??= []).push(bound);
    }),
    off: jest.fn((ev: string, _fn?: Handler) => {
      // Remove all handlers for this event (sufficient for deactivate() tests)
      if (ev) handlers[ev] = [];
    }),
    once: jest.fn(),
    emit: jest.fn((ev: string, data?: any) => {
      emittedEvents.push({ event: ev, data });
      (handlers[ev] ?? []).forEach(h => h(data));
    }),
  };

  const makeGfx = () => ({
    lineStyle: jest.fn().mockReturnThis(),
    strokeCircle: jest.fn().mockReturnThis(),
    fillStyle: jest.fn().mockReturnThis(),
    fillCircle: jest.fn().mockReturnThis(),
    setDepth: jest.fn().mockReturnThis(),
    setAlpha: jest.fn().mockReturnThis(),
    clear: jest.fn().mockReturnThis(),
    lineBetween: jest.fn().mockReturnThis(),
    beginPath: jest.fn().mockReturnThis(),
    moveTo: jest.fn().mockReturnThis(),
    lineTo: jest.fn().mockReturnThis(),
    strokePath: jest.fn().mockReturnThis(),
    createGeometryMask: jest.fn().mockReturnValue({}),
    destroy: jest.fn(),
  });

  const makeImg = () => ({
    setAngle: jest.fn().mockReturnThis(),
    setDisplaySize: jest.fn().mockReturnThis(),
    setDepth: jest.fn().mockReturnThis(),
    setAlpha: jest.fn().mockReturnThis(),
    setVisible: jest.fn().mockReturnThis(),
    x: 100, y: 100,
    displayWidth: 60, displayHeight: 60,
    destroy: jest.fn(),
  });

  const scene = {
    add: {
      graphics:   jest.fn().mockImplementation(makeGfx),
      image:      jest.fn().mockImplementation(makeImg),
      sprite:     jest.fn().mockReturnValue({
        setPostPipeline: jest.fn(), getPostPipeline: jest.fn(() => null),
        setDisplaySize: jest.fn().mockReturnThis(), setDepth: jest.fn().mockReturnThis(),
        setAlpha: jest.fn().mockReturnThis(), setMask: jest.fn().mockReturnThis(),
        play: jest.fn().mockReturnThis(),
      }),
      text:       jest.fn().mockReturnValue({
        setOrigin: jest.fn().mockReturnThis(), setColor: jest.fn().mockReturnThis(),
        setDepth: jest.fn().mockReturnThis(), setAlpha: jest.fn().mockReturnThis(),
        destroy: jest.fn(),
      }),
      bitmapText: jest.fn().mockReturnValue({
        setOrigin: jest.fn().mockReturnThis(), setTint: jest.fn().mockReturnThis(),
        setDepth: jest.fn().mockReturnThis(), setAlpha: jest.fn().mockReturnThis(),
        destroy: jest.fn(),
      }),
      rectangle:  jest.fn().mockReturnValue({ setStrokeStyle: jest.fn().mockReturnThis(), destroy: jest.fn() }),
      container:  jest.fn().mockReturnValue({ add: jest.fn() }),
    },
    textures: { exists: jest.fn().mockReturnValue(false) },
    anims:    { exists: jest.fn().mockReturnValue(false), create: jest.fn() },
    time:     { delayedCall: jest.fn() },
    tweens:   { add: jest.fn() },
    events,
    make: {
      graphics: jest.fn().mockReturnValue({
        clear: jest.fn().mockReturnThis(),
        fillStyle: jest.fn().mockReturnThis(),
        fillRect: jest.fn().mockReturnThis(),
        createGeometryMask: jest.fn().mockReturnValue({}),
        destroy: jest.fn(),
      }),
    },
  };

  const container = { add: jest.fn() };

  return { scene, events, emittedEvents, container };
}

/** Shorthand: build an arrangement with two items, activate the mode, return helpers. */
function setupTwoItemMode() {
  const { scene, events, emittedEvents, container } = makeBehaviorScene();
  const mode = new ReOrientMode(scene as any);
  mode.setPool([
    { id: 'alpha', icon: 'icon-alpha' },
    { id: 'beta',  icon: 'icon-beta'  },
  ]);
  mode.buildArrangement(container as any, { cx: 100, cy: 100, w: 300, h: 200 }, 2);
  mode.activate();
  return { mode, scene, events, emittedEvents };
}

/** Emits convenience: first event with matching name, or undefined. */
function firstOf(ev: Array<{ event: string; data?: any }>, name: string) {
  return ev.find(e => e.event === name);
}

// ── helpers ────────────────────────────────────────────────────────────────

// ── getPipelineInstance (static, now on DroneWireframe) ───────────────────

describe('DroneWireframe.getPipelineInstance', () => {
  const get = (sprite: any) =>
    (DroneWireframe as any).getPipelineInstance(sprite, 'DiagnosticFX');

  it('returns null when getPostPipeline is not available', () => {
    expect(get({})).toBeNull();
  });

  it('returns null when getPostPipeline returns null', () => {
    const sprite = { getPostPipeline: jest.fn(() => null) };
    expect(get(sprite)).toBeNull();
  });

  it('returns null when getPostPipeline returns undefined', () => {
    const sprite = { getPostPipeline: jest.fn(() => undefined) };
    expect(get(sprite)).toBeNull();
  });

  it('returns null when the instance has no set3f method', () => {
    const sprite = {
      getPostPipeline: jest.fn(() => ({ uniforms: {}, set3f: undefined })),
    };
    expect(get(sprite)).toBeNull();
  });

  it('returns null when uniforms is not populated (pre-boot state)', () => {
    // This is the exact scenario that caused the crash:
    // set3f exists on the prototype but this.uniforms is undefined
    const sprite = {
      getPostPipeline: jest.fn(() => ({
        set3f: jest.fn(), // exists, but...
        uniforms: undefined, // ...onBoot hasn't fired yet
      })),
    };
    expect(get(sprite)).toBeNull();
  });

  it('returns null when uniforms is null', () => {
    const sprite = {
      getPostPipeline: jest.fn(() => ({ set3f: jest.fn(), uniforms: null })),
    };
    expect(get(sprite)).toBeNull();
  });

  it('returns the instance when set3f and uniforms are both present', () => {
    const mock = { set3f: jest.fn(), uniforms: { uEdgeColor: {} } };
    const sprite = { getPostPipeline: jest.fn(() => mock) };
    expect(get(sprite)).toBe(mock);
  });

  it('unwraps array return (Phaser 3.60+ behaviour) and returns first element', () => {
    const mock = { set3f: jest.fn(), uniforms: { uEdgeColor: {} } };
    const sprite = { getPostPipeline: jest.fn(() => [mock]) };
    expect(get(sprite)).toBe(mock);
  });

  it('returns null when array is empty', () => {
    const sprite = { getPostPipeline: jest.fn(() => []) };
    expect(get(sprite)).toBeNull();
  });

  it('returns null when first array element has no uniforms', () => {
    const sprite = {
      getPostPipeline: jest.fn(() => [{ set3f: jest.fn(), uniforms: undefined }]),
    };
    expect(get(sprite)).toBeNull();
  });
});

// ── pendingEdgeColor assignment in buildArrangement ────────────────────────

describe('ReOrientMode.buildArrangement — wireframe pendingEdgeColor', () => {
  /** Create a minimal scene mock sufficient for buildArrangement. */
  const makeScene = () => {
    const spriteMock = {
      pendingEdgeColor: null as any,
      setPostPipeline: jest.fn(function (this: any) {
        // Simulate what Phaser does: create a pipeline instance and store it.
        // Include set3f + uniforms so getPipelineInstance's guard passes.
        this._pipe = { pendingEdgeColor: null, set3f: jest.fn(), uniforms: {} };
      }),
      getPostPipeline: jest.fn(function (this: any) {
        return this._pipe ?? null;
      }),
      setDisplaySize: jest.fn().mockReturnThis(),
      setDepth: jest.fn().mockReturnThis(),
      setAlpha: jest.fn().mockReturnThis(),
      setMask: jest.fn().mockReturnThis(),
      play: jest.fn().mockReturnThis(),
      _pipe: null as any,
    };

    const containerMock = { add: jest.fn() };

    const scene = {
      add: {
        sprite: jest.fn().mockReturnValue(spriteMock),
        graphics: jest.fn().mockReturnValue({
          lineStyle: jest.fn().mockReturnThis(),
          strokeCircle: jest.fn().mockReturnThis(),
          fillStyle: jest.fn().mockReturnThis(),
          fillCircle: jest.fn().mockReturnThis(),
          setDepth: jest.fn().mockReturnThis(),
          setAlpha: jest.fn().mockReturnThis(),
          clear: jest.fn().mockReturnThis(),
          lineBetween: jest.fn().mockReturnThis(),
          beginPath: jest.fn().mockReturnThis(),
          moveTo: jest.fn().mockReturnThis(),
          lineTo: jest.fn().mockReturnThis(),
          strokePath: jest.fn().mockReturnThis(),
          createGeometryMask: jest.fn().mockReturnValue({}),
          destroy: jest.fn(),
        }),
        image: jest.fn().mockReturnValue({
          setAngle: jest.fn().mockReturnThis(),
          setDisplaySize: jest.fn().mockReturnThis(),
          setDepth: jest.fn().mockReturnThis(),
          setAlpha: jest.fn().mockReturnThis(),
          setVisible: jest.fn().mockReturnThis(),
          destroy: jest.fn(),
        }),
        text: jest.fn().mockReturnValue({
          setOrigin: jest.fn().mockReturnThis(),
          setColor: jest.fn().mockReturnThis(),
          setDepth: jest.fn().mockReturnThis(),
          setAlpha: jest.fn().mockReturnThis(),
          destroy: jest.fn(),
        }),
        bitmapText: jest.fn().mockReturnValue({
          setOrigin: jest.fn().mockReturnThis(),
          setTint: jest.fn().mockReturnThis(),
          setDepth: jest.fn().mockReturnThis(),
          setAlpha: jest.fn().mockReturnThis(),
          destroy: jest.fn(),
        }),
        rectangle: jest.fn().mockReturnValue({
          setStrokeStyle: jest.fn().mockReturnThis(),
          destroy: jest.fn(),
        }),
        container: jest.fn().mockReturnValue(containerMock),
      },
      textures: {
        exists: jest.fn().mockReturnValue(true),
      },
      anims: {
        exists: jest.fn().mockReturnValue(false),
        create: jest.fn(),
      },
      time: {
        delayedCall: jest.fn(),
      },
      tweens: {
        add: jest.fn(),
      },
      events: {
        on: jest.fn(),
        off: jest.fn(),
        once: jest.fn(),
      },
      make: {
        graphics: jest.fn().mockReturnValue({
          clear: jest.fn().mockReturnThis(),
          fillStyle: jest.fn().mockReturnThis(),
          fillRect: jest.fn().mockReturnThis(),
          createGeometryMask: jest.fn().mockReturnValue({}),
          destroy: jest.fn(),
        }),
      },
    };

    return { scene, spriteMock, containerMock };
  };

  it('sets pendingEdgeColor on the pipeline instance synchronously', () => {
    const { scene, spriteMock, containerMock } = makeScene();

    const mode = new ReOrientMode(scene as any);
    mode.setPool([{ id: 'item1', icon: 'icon1' }, { id: 'item2', icon: 'icon2' }]);

    mode.buildArrangement(containerMock as any, { cx: 100, cy: 200, w: 200, h: 120 }, 2, 'drone-1-idle');

    expect(spriteMock.setPostPipeline).toHaveBeenCalledWith('DiagnosticFX');
    expect(spriteMock._pipe.pendingEdgeColor).toEqual([0.28, 0.40, 0.32]);
  });

  it('skips wireframe when droneKey is undefined', () => {
    const { scene, spriteMock, containerMock } = makeScene();

    const mode = new ReOrientMode(scene as any);
    mode.setPool([{ id: 'item1', icon: 'icon1' }]);

    // No droneKey
    mode.buildArrangement(containerMock as any, { cx: 100, cy: 200, w: 200, h: 120 }, 1);

    expect(spriteMock.setPostPipeline).not.toHaveBeenCalled();
  });

  it('skips wireframe when the texture does not exist', () => {
    const { scene, spriteMock, containerMock } = makeScene();
    scene.textures.exists.mockReturnValue(false);

    const mode = new ReOrientMode(scene as any);
    mode.setPool([{ id: 'item1', icon: 'icon1' }]);

    mode.buildArrangement(containerMock as any, { cx: 100, cy: 200, w: 200, h: 120 }, 1, 'drone-1-idle');

    expect(spriteMock.setPostPipeline).not.toHaveBeenCalled();
  });
});

// ── ReOrientMode — buildArrangement item state ─────────────────────────────

describe('ReOrientMode.buildArrangement — item initialisation', () => {
  it('populates repairItems with requiresReplace=false and solved=false', () => {
    const { scene, container } = makeBehaviorScene();
    const mode = new ReOrientMode(scene as any);
    mode.setPool([
      { id: 'a', icon: 'icon-a' },
      { id: 'b', icon: 'icon-b' },
      { id: 'c', icon: 'icon-c' },
    ]);
    mode.buildArrangement(container as any, { cx: 100, cy: 100, w: 300, h: 200 }, 3);
    const items = mode.getItems();
    expect(items).toHaveLength(3);
    items.forEach(item => {
      expect(item.solved).toBe(false);
      expect(item.requiresReplace).toBe(false);
    });
  });

  it('limits count to pool size', () => {
    const { scene, container } = makeBehaviorScene();
    const mode = new ReOrientMode(scene as any);
    mode.setPool([{ id: 'only', icon: 'icon-only' }]);
    mode.buildArrangement(container as any, { cx: 100, cy: 100, w: 300, h: 200 }, 5);
    expect(mode.getItems()).toHaveLength(1);
  });

  it('produces distinct start and target rotation angles', () => {
    const { scene, container } = makeBehaviorScene();
    const mode = new ReOrientMode(scene as any);
    mode.setPool([{ id: 'x', icon: 'icon-x' }]);
    mode.buildArrangement(container as any, { cx: 100, cy: 100, w: 300, h: 200 }, 1);
    const [item] = mode.getItems();
    expect(item.startRotationDeg).not.toBe(item.targetRotationDeg);
    expect(item.currentRotationDeg).toBe(item.startRotationDeg);
  });

  it('returns empty array before buildArrangement is called', () => {
    const { scene } = makeBehaviorScene();
    const mode = new ReOrientMode(scene as any);
    expect(mode.getItems()).toEqual([]);
    expect(mode.isAllSolved()).toBe(false);
  });
});

// ── ReOrientMode — onItemSelected routing ─────────────────────────────────

describe('ReOrientMode.onItemSelected', () => {
  it('emits repair:showDial for an unsolved, non-failed item', () => {
    const { mode, emittedEvents } = setupTwoItemMode();
    const items = mode.getItems();
    mode.onItemSelected({ id: items[0].iconKey, name: items[0].iconKey, icon: items[0].iconKey });
    const ev = firstOf(emittedEvents, 'repair:showDial');
    expect(ev).toBeDefined();
    expect(ev!.data.item.icon).toBe(items[0].iconKey);
    expect(ev!.data.currentRotationDeg).toBe(items[0].startRotationDeg);
    expect(ev!.data.targetRotationDeg).toBe(items[0].targetRotationDeg);
  });

  it('emits repair:noMatch when item icon is not in arrangement', () => {
    const { mode, emittedEvents } = setupTwoItemMode();
    mode.onItemSelected({ id: 'unknown', name: 'unknown', icon: 'unknown' });
    expect(firstOf(emittedEvents, 'repair:noMatch')).toBeDefined();
    expect(firstOf(emittedEvents, 'repair:showDial')).toBeUndefined();
  });

  it('emits repair:noMatch when item is already solved', () => {
    const { mode, events, emittedEvents } = setupTwoItemMode();
    const [item] = mode.getItems();
    mode.onItemSelected({ id: item.iconKey, name: item.iconKey, icon: item.iconKey });
    emittedEvents.length = 0;
    // Settle as success
    events.emit('dial:repairSettled', { success: true });
    emittedEvents.length = 0;

    // Try to select the same solved item again
    mode.onItemSelected({ id: item.iconKey, name: item.iconKey, icon: item.iconKey });
    expect(firstOf(emittedEvents, 'repair:noMatch')).toBeDefined();
  });

  it('emits repair:noMatch when item requiresReplace (failure-escalation guard)', () => {
    const { mode, events, emittedEvents } = setupTwoItemMode();
    const [item] = mode.getItems();
    // Trigger failure
    mode.onItemSelected({ id: item.iconKey, name: item.iconKey, icon: item.iconKey });
    events.emit('dial:repairSettled', { success: false });
    emittedEvents.length = 0;

    // Player tries to re-select the failed item
    mode.onItemSelected({ id: item.iconKey, name: item.iconKey, icon: item.iconKey });
    expect(firstOf(emittedEvents, 'repair:noMatch')).toBeDefined();
    expect(firstOf(emittedEvents, 'repair:showDial')).toBeUndefined();
  });
});

// ── ReOrientMode — repair success flow ────────────────────────────────────

describe('ReOrientMode — successful repair settlement', () => {
  it('marks item solved and emits repair:itemSolved when others remain', () => {
    const { mode, events, emittedEvents } = setupTwoItemMode();
    const [first] = mode.getItems();
    mode.onItemSelected({ id: first.iconKey, name: first.iconKey, icon: first.iconKey });
    events.emit('dial:repairSettled', { success: true });

    expect(first.solved).toBe(true);
    expect(first.requiresReplace).toBe(false);
    expect(firstOf(emittedEvents, 'repair:itemSolved')).toBeDefined();
    expect(firstOf(emittedEvents, 'repair:allSolved')).toBeUndefined();
  });

  it('resets currentRotationDeg to 0 on success', () => {
    const { mode, events } = setupTwoItemMode();
    const [item] = mode.getItems();
    mode.onItemSelected({ id: item.iconKey, name: item.iconKey, icon: item.iconKey });
    events.emit('dial:repairSettled', { success: true });
    expect(item.currentRotationDeg).toBe(0);
  });

  it('emits repair:allSolved when the last item is solved', () => {
    const { mode, events, emittedEvents } = setupTwoItemMode();
    const [a, b] = mode.getItems();

    // Solve both
    mode.onItemSelected({ id: a.iconKey, name: a.iconKey, icon: a.iconKey });
    events.emit('dial:repairSettled', { success: true });
    emittedEvents.length = 0;

    mode.onItemSelected({ id: b.iconKey, name: b.iconKey, icon: b.iconKey });
    events.emit('dial:repairSettled', { success: true });

    expect(firstOf(emittedEvents, 'repair:allSolved')).toBeDefined();
    expect(firstOf(emittedEvents, 'repair:itemSolved')).toBeUndefined();
    expect(mode.isAllSolved()).toBe(true);
  });

  it('isAllSolved returns false when any item is unsolved', () => {
    const { mode, events } = setupTwoItemMode();
    const [a] = mode.getItems();
    mode.onItemSelected({ id: a.iconKey, name: a.iconKey, icon: a.iconKey });
    events.emit('dial:repairSettled', { success: true });
    expect(mode.isAllSolved()).toBe(false);
  });

  it('dial:repairRotated updates currentRotationDeg on the active item', () => {
    const { mode, events } = setupTwoItemMode();
    const [item] = mode.getItems();
    mode.onItemSelected({ id: item.iconKey, name: item.iconKey, icon: item.iconKey });
    events.emit('dial:repairRotated', { rotation: 90 });
    expect(item.currentRotationDeg).toBe(90);
  });

  it('dial:repairRotated is a no-op when no item is active', () => {
    const { mode, events } = setupTwoItemMode();
    const [item] = mode.getItems();
    const before = item.currentRotationDeg;
    events.emit('dial:repairRotated', { rotation: 99 });
    expect(item.currentRotationDeg).toBe(before); // unchanged
  });
});

// ── ReOrientMode — failure-escalation flow ────────────────────────────────

describe('ReOrientMode — failure settlement (requires replacement)', () => {
  it('sets requiresReplace=true and emits repair:itemFailed on failure', () => {
    const { mode, events, emittedEvents } = setupTwoItemMode();
    const [item] = mode.getItems();
    mode.onItemSelected({ id: item.iconKey, name: item.iconKey, icon: item.iconKey });
    events.emit('dial:repairSettled', { success: false });

    expect(item.requiresReplace).toBe(true);
    expect(item.solved).toBe(false);
    const ev = firstOf(emittedEvents, 'repair:itemFailed');
    expect(ev).toBeDefined();
    expect(ev!.data.iconKey).toBe(item.iconKey);
  });

  it('does NOT emit repair:itemSolved or repair:allSolved on failure', () => {
    const { mode, events, emittedEvents } = setupTwoItemMode();
    const [item] = mode.getItems();
    mode.onItemSelected({ id: item.iconKey, name: item.iconKey, icon: item.iconKey });
    events.emit('dial:repairSettled', { success: false });

    expect(firstOf(emittedEvents, 'repair:itemSolved')).toBeUndefined();
    expect(firstOf(emittedEvents, 'repair:allSolved')).toBeUndefined();
  });

  it('clears currentRepairItem after failure so further events are ignored', () => {
    const { mode, events, emittedEvents } = setupTwoItemMode();
    const [item] = mode.getItems();
    mode.onItemSelected({ id: item.iconKey, name: item.iconKey, icon: item.iconKey });
    events.emit('dial:repairSettled', { success: false });
    emittedEvents.length = 0;

    // Extra settled event should not change state further
    events.emit('dial:repairSettled', { success: true });
    expect(emittedEvents.filter(e => e.event.startsWith('repair:'))).toHaveLength(0);
  });

  it('mixed: one failure, one success → allSolved emitted via resolveItem', () => {
    const { mode, events, emittedEvents } = setupTwoItemMode();
    const [a, b] = mode.getItems();

    // Fail item A
    mode.onItemSelected({ id: a.iconKey, name: a.iconKey, icon: a.iconKey });
    events.emit('dial:repairSettled', { success: false });

    // Succeed item B
    mode.onItemSelected({ id: b.iconKey, name: b.iconKey, icon: b.iconKey });
    events.emit('dial:repairSettled', { success: true });
    // B solved, A still failed → itemSolved emitted not allSolved
    expect(firstOf(emittedEvents, 'repair:itemSolved')).toBeDefined();
    expect(firstOf(emittedEvents, 'repair:allSolved')).toBeUndefined();

    emittedEvents.length = 0;
    // Delivery completes for A
    mode.resolveItem(a.iconKey);
    expect(firstOf(emittedEvents, 'repair:allSolved')).toBeDefined();
    expect(a.solved).toBe(true);
  });
});

// ── ReOrientMode — resolveItem (delivery-completion path) ─────────────────

describe('ReOrientMode.resolveItem', () => {
  it('marks the failed item as solved', () => {
    const { mode, events, emittedEvents } = setupTwoItemMode();
    const [item] = mode.getItems();
    mode.onItemSelected({ id: item.iconKey, name: item.iconKey, icon: item.iconKey });
    events.emit('dial:repairSettled', { success: false });
    emittedEvents.length = 0;

    mode.resolveItem(item.iconKey);
    expect(item.solved).toBe(true);
  });

  it('emits repair:itemSolved when other items remain unsolved', () => {
    const { mode, events, emittedEvents } = setupTwoItemMode();
    const [a] = mode.getItems();
    mode.onItemSelected({ id: a.iconKey, name: a.iconKey, icon: a.iconKey });
    events.emit('dial:repairSettled', { success: false });
    emittedEvents.length = 0;

    mode.resolveItem(a.iconKey);
    expect(firstOf(emittedEvents, 'repair:itemSolved')).toBeDefined();
    expect(firstOf(emittedEvents, 'repair:allSolved')).toBeUndefined();
  });

  it('emits repair:allSolved when it was the last outstanding item', () => {
    const { mode, events, emittedEvents } = setupTwoItemMode();
    const [a, b] = mode.getItems();

    // Fail a, succeed b
    mode.onItemSelected({ id: a.iconKey, name: a.iconKey, icon: a.iconKey });
    events.emit('dial:repairSettled', { success: false });
    mode.onItemSelected({ id: b.iconKey, name: b.iconKey, icon: b.iconKey });
    events.emit('dial:repairSettled', { success: true });
    emittedEvents.length = 0;

    mode.resolveItem(a.iconKey);
    expect(firstOf(emittedEvents, 'repair:allSolved')).toBeDefined();
  });

  it('is a no-op for an iconKey not marked requiresReplace', () => {
    const { mode, emittedEvents } = setupTwoItemMode();
    // No failure triggered — items are not marked requiresReplace
    mode.resolveItem('icon-alpha');
    expect(emittedEvents.filter(e => e.event.startsWith('repair:'))).toHaveLength(0);
  });

  it('is a no-op for an already-resolved item', () => {
    const { mode, events, emittedEvents } = setupTwoItemMode();
    const [a] = mode.getItems();
    mode.onItemSelected({ id: a.iconKey, name: a.iconKey, icon: a.iconKey });
    events.emit('dial:repairSettled', { success: false });
    mode.resolveItem(a.iconKey);   // first resolve
    emittedEvents.length = 0;
    mode.resolveItem(a.iconKey);   // second call should do nothing
    expect(emittedEvents.filter(e => e.event.startsWith('repair:'))).toHaveLength(0);
  });
});

// ── ReOrientMode — clearCurrent / deactivate ──────────────────────────────

describe('ReOrientMode.clearCurrent and deactivate', () => {
  it('clearCurrent causes subsequent repairSettled to be a no-op', () => {
    const { mode, events, emittedEvents } = setupTwoItemMode();
    const [item] = mode.getItems();
    mode.onItemSelected({ id: item.iconKey, name: item.iconKey, icon: item.iconKey });
    mode.clearCurrent();
    emittedEvents.length = 0;

    events.emit('dial:repairSettled', { success: true });
    expect(emittedEvents.filter(e => e.event.startsWith('repair:'))).toHaveLength(0);
  });

  it('deactivate stops the mode from responding to dial events', () => {
    const { mode, events, emittedEvents } = setupTwoItemMode();
    const [item] = mode.getItems();
    mode.onItemSelected({ id: item.iconKey, name: item.iconKey, icon: item.iconKey });
    mode.deactivate();
    emittedEvents.length = 0;

    events.emit('dial:repairSettled', { success: true });
    expect(emittedEvents.filter(e => e.event.startsWith('repair:'))).toHaveLength(0);
  });
});

// ── DeliveryQueue ─────────────────────────────────────────────────────────

describe('DeliveryQueue', () => {
  /** Minimal scene mock with controllable time.delayedCall and addEvent. */
  function makeTimerScene() {
    const timers: Array<{ delay: number; cb: () => void; loop?: boolean; tickCb?: (d: any) => void; removed: boolean }> = [];
    const emitted: Array<{ event: string; data?: any }> = [];

    function addEvent(opts: { delay: number; loop: boolean; callback: () => void }) {
      const entry = { delay: opts.delay, cb: opts.callback, loop: opts.loop, removed: false };
      timers.push(entry);
      return { remove: jest.fn(() => { entry.removed = true; }) };
    }

    function delayedCall(delay: number, cb: () => void) {
      const entry = { delay, cb, removed: false };
      timers.push(entry);
      return { remove: jest.fn(() => { entry.removed = true; }) };
    }

    const scene = {
      time: { now: 0, addEvent, delayedCall },
      events: {
        emit: jest.fn((ev: string, data?: any) => { emitted.push({ event: ev, data }); }),
        on: jest.fn(),
        off: jest.fn(),
      },
    };

    function fireAllReady() {
      // fire all non-loop timers once (simulates time passing)
      timers.filter(t => !t.loop && !t.removed).forEach(t => t.cb());
    }

    return { scene, timers, emitted, fireAllReady };
  }

  it('enqueue creates a ticker and a completion timer', () => {
    const { scene, timers } = makeTimerScene();
    const q = new DeliveryQueue();
    q.setScene(scene as any);
    const cfg = { deliveryDurations: [8000, 4000, 1500], deliveryCosts: [2, 5, 10] } as any;
    q.enqueue('item-x', 0, cfg, scene as any);
    // One loop ticker + one delayedCall completion
    expect(timers).toHaveLength(2);
  });

  it('getAll returns the pending entry', () => {
    const { scene } = makeTimerScene();
    const q = new DeliveryQueue();
    q.setScene(scene as any);
    const cfg = { deliveryDurations: [8000, 4000, 1500], deliveryCosts: [2, 5, 10] } as any;
    q.enqueue('item-x', 1, cfg, scene as any);
    expect(q.getAll()).toHaveLength(1);
    expect(q.getAll()[0].iconKey).toBe('item-x');
    expect(q.getAll()[0].speedTier).toBe(1);
  });

  it('emits delivery:completed and removes entry when timer fires', () => {
    const { scene, emitted, fireAllReady } = makeTimerScene();
    const q = new DeliveryQueue();
    q.setScene(scene as any);
    const cfg = { deliveryDurations: [1500, 4000, 8000], deliveryCosts: [10, 5, 2] } as any;
    q.enqueue('item-y', 2, cfg, scene as any);
    fireAllReady();
    expect(emitted.find(e => e.event === 'delivery:completed' && e.data.iconKey === 'item-y')).toBeDefined();
    expect(q.getAll()).toHaveLength(0);
  });

  it('cancel removes the entry without emitting delivery:completed', () => {
    const { scene, emitted } = makeTimerScene();
    const q = new DeliveryQueue();
    q.setScene(scene as any);
    const cfg = { deliveryDurations: [8000, 4000, 1500], deliveryCosts: [2, 5, 10] } as any;
    q.enqueue('item-z', 0, cfg, scene as any);
    q.cancel('item-z');
    expect(q.getAll()).toHaveLength(0);
    expect(emitted.find(e => e.event === 'delivery:completed')).toBeUndefined();
  });

  it('re-enqueueing the same iconKey cancels the previous delivery', () => {
    const { scene, timers } = makeTimerScene();
    const q = new DeliveryQueue();
    q.setScene(scene as any);
    const cfg = { deliveryDurations: [8000, 4000, 1500], deliveryCosts: [2, 5, 10] } as any;
    q.enqueue('item-w', 0, cfg, scene as any);
    q.enqueue('item-w', 2, cfg, scene as any); // re-enqueue faster tier
    expect(q.getAll()).toHaveLength(1);
    expect(q.getAll()[0].speedTier).toBe(2);
    // The first pair of timers should be marked removed
    const removedCount = timers.filter(t => t.removed).length;
    expect(removedCount).toBeGreaterThanOrEqual(2);
  });

  it('getEntry returns undefined for unknown icon', () => {
    const { scene } = makeTimerScene();
    const q = new DeliveryQueue();
    q.setScene(scene as any);
    expect(q.getEntry('nope')).toBeUndefined();
  });

  it('destroy clears all timers and entries', () => {
    const { scene, timers } = makeTimerScene();
    const q = new DeliveryQueue();
    q.setScene(scene as any);
    const cfg = { deliveryDurations: [8000, 4000, 1500], deliveryCosts: [2, 5, 10] } as any;
    q.enqueue('a', 0, cfg, scene as any);
    q.enqueue('b', 1, cfg, scene as any);
    q.destroy();
    expect(q.getAll()).toHaveLength(0);
    expect(timers.every(t => t.removed)).toBe(true);
  });

  it('uses deliveryDurations[speedTier] for the correct tier', () => {
    const { scene, timers } = makeTimerScene();
    const q = new DeliveryQueue();
    q.setScene(scene as any);
    const cfg = { deliveryDurations: [8000, 4000, 1500], deliveryCosts: [2, 5, 10] } as any;
    q.enqueue('fast', 2, cfg, scene as any);
    // The completion delayedCall should have delay = 1500
    const completionTimer = timers.find(t => !t.loop);
    expect(completionTimer?.delay).toBe(1500);
  });
});
