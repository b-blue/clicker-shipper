/** @jest-environment jsdom */
/**
 * Tests for Preloader scene — font warm-up logic.
 *
 * The Preloader must ensure both custom web fonts (Minotaur + Hack) are fully
 * loaded and cached by the Phaser canvas context before transitioning to the
 * MainMenu scene.
 *
 * Strategy:
 *   1. Hidden DOM elements in index.html reference the fonts so the browser
 *      begins downloading them during initial CSS parse.
 *   2. `await document.fonts.ready` blocks until those downloads complete.
 *   3. Two off-screen probe Text objects force the canvas 2D context to
 *      measure and cache each glyph.
 *   4. One requestAnimationFrame tick lets the canvas actually render the
 *      probes before scene transition.
 *   5. scene.start('MainMenu') is called; probes are then destroyed.
 */

import { jest } from '@jest/globals';

// ── Module mocks (must come before any import that transitively uses them) ──

jest.mock('../../managers/GameManager', () => ({
  GameManager: {
    getInstance: jest.fn(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      getConfig: jest.fn(() => ({ rootDialIconPath: null })),
    })),
  },
}));

jest.mock('../../managers/SettingsManager', () => ({
  SettingsManager: {
    getInstance: jest.fn(() => ({
      loadSettings: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

jest.mock('../../managers/AssetLoader', () => ({
  AssetLoader: { preloadAtlases: jest.fn() },
}));

jest.mock('../../fx/DiagnosticFXPipeline', () => ({
  DiagnosticFXPipeline: class {},
  DIAGNOSTIC_FX: 'DiagnosticFXPipeline',
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal Phaser scene mock for Preloader.create(). */
const buildScene = () => {
  // Stub load: `once('complete', cb)` fires the callback synchronously so the
  // asset-load await resolves without needing real Phaser I/O.
  const loadOnce = jest.fn((event: string, cb: () => void) => {
    if (event === 'complete') cb();
  });

  const probeDestroy = jest.fn();
  // `add.text` returns a minimal Text mock; every call gets the same destroy spy
  // so tests can assert both probe objects were cleaned up.
  const addText = jest.fn(() => ({ destroy: probeDestroy }));

  const sceneStart = jest.fn();

  const scene = {
    game:     { renderer: { type: 0 /* not WEBGL */ } },
    load:     { json: jest.fn(), image: jest.fn(), spritesheet: jest.fn(), start: jest.fn(), once: loadOnce },
    add:      { text: addText },
    anims:    { exists: jest.fn(() => false), create: jest.fn(), generateFrameNumbers: jest.fn(() => []) },
    textures: { exists: jest.fn(() => false) },
    scene:    { start: sceneStart },
  };

  return { scene, addText, sceneStart, probeDestroy };
};

// ── Test suite ───────────────────────────────────────────────────────────────

describe('Preloader — font warm-up', () => {
  let rafSpy: jest.SpiedFunction<typeof requestAnimationFrame>;

  beforeAll(() => {
    (global as any).Phaser = {
      Scene: class {},
      WEBGL: 1,
      Renderer: { WebGL: { WebGLRenderer: class {} } },
    };
  });

  beforeEach(() => {
    // Make requestAnimationFrame synchronous so tests don't need fake timers.
    rafSpy = jest.spyOn(global, 'requestAnimationFrame').mockImplementation(
      (cb: FrameRequestCallback) => { cb(0); return 0; }
    );
  });

  afterEach(() => {
    rafSpy.mockRestore();
    jest.resetModules();
  });

  // ── 1. Sequencing: fonts load before probes are created ─────────────────

  it('awaits document.fonts.ready before creating probe Text objects', async () => {
    let fontsReadyResolve!: () => void;
    const fontsReady = new Promise<void>(resolve => { fontsReadyResolve = resolve; });
    Object.defineProperty(document, 'fonts', {
      value: { ready: fontsReady },
      configurable: true,
    });

    const { Preloader } = await import('../Preloader');
    const { scene, addText } = buildScene();
    Object.assign(Object.create(Preloader.prototype), scene);
    const instance = Object.assign(new Preloader(), scene);

    const createPromise = instance.create();

    // Fonts have not resolved yet — probes must not exist
    expect(addText).not.toHaveBeenCalled();

    fontsReadyResolve();
    await createPromise;

    // Now probes should have been created
    expect(addText).toHaveBeenCalled();
  });

  // ── 2. Probe objects are off-screen ─────────────────────────────────────

  it('creates both probe Text objects at off-screen coordinates (-9999, -9999)', async () => {
    Object.defineProperty(document, 'fonts', {
      value: { ready: Promise.resolve() },
      configurable: true,
    });

    const { Preloader } = await import('../Preloader');
    const { scene, addText } = buildScene();
    const instance = Object.assign(new Preloader(), scene);

    await instance.create();

    const coords = addText.mock.calls.map((c: any[]) => [c[0], c[1]]);
    expect(coords).toEqual(expect.arrayContaining([[-9999, -9999], [-9999, -9999]]));
  });

  // ── 3. Probe objects use the correct font families ───────────────────────

  it('creates a Minotaur probe and a Hack probe', async () => {
    Object.defineProperty(document, 'fonts', {
      value: { ready: Promise.resolve() },
      configurable: true,
    });

    const { Preloader } = await import('../Preloader');
    const { scene, addText } = buildScene();
    const instance = Object.assign(new Preloader(), scene);

    await instance.create();

    const families: string[] = addText.mock.calls.map((c: any[]) => c[3]?.fontFamily);
    expect(families).toContain('Minotaur');
    expect(families).toContain('Hack');
  });

  // ── 4. requestAnimationFrame fires before scene transition ───────────────

  it('calls requestAnimationFrame before scene.start("MainMenu")', async () => {
    Object.defineProperty(document, 'fonts', {
      value: { ready: Promise.resolve() },
      configurable: true,
    });

    const callOrder: string[] = [];
    rafSpy.mockImplementation((cb: FrameRequestCallback) => {
      callOrder.push('rAF');
      cb(0);
      return 0;
    });

    const { Preloader } = await import('../Preloader');
    const { scene, sceneStart } = buildScene();
    (sceneStart as jest.Mock).mockImplementation(() => callOrder.push('start'));
    const instance = Object.assign(new Preloader(), scene);

    await instance.create();

    expect(callOrder.indexOf('rAF')).toBeLessThan(callOrder.indexOf('start'));
  });

  // ── 5. Probe objects are destroyed after scene.start ────────────────────

  it('destroys both probe Text objects after calling scene.start("MainMenu")', async () => {
    Object.defineProperty(document, 'fonts', {
      value: { ready: Promise.resolve() },
      configurable: true,
    });

    const callOrder: string[] = [];

    const { Preloader } = await import('../Preloader');
    const { scene, sceneStart, probeDestroy } = buildScene();
    (sceneStart as jest.Mock).mockImplementation(() => callOrder.push('start'));
    (probeDestroy as jest.Mock).mockImplementation(() => callOrder.push('destroy'));

    const instance = Object.assign(new Preloader(), scene);
    await instance.create();

    expect(callOrder.indexOf('start')).toBeLessThan(callOrder.indexOf('destroy'));
    // Both probes destroyed
    expect(probeDestroy).toHaveBeenCalledTimes(2);
  });

  // ── 6. Fallback: scene.start fires even if an error is thrown ────────────

  it('still starts MainMenu if an error occurs during font warm-up', async () => {
    Object.defineProperty(document, 'fonts', {
      // Simulate fonts.ready rejecting (e.g. sandboxed WebView)
      value: { ready: Promise.reject(new Error('fonts unavailable')) },
      configurable: true,
    });

    const { Preloader } = await import('../Preloader');
    const { scene, sceneStart } = buildScene();
    const instance = Object.assign(new Preloader(), scene);

    // Should not throw
    await expect(instance.create()).resolves.toBeUndefined();

    expect(sceneStart).toHaveBeenCalledWith('MainMenu');
  });
});
