/** @jest-environment jsdom */
/**
 * Tests for Preloader scene — font warm-up, splash dismissal,
 * parallel manager init, and Phaser-native progress bar.
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
    load:     { json: jest.fn(), image: jest.fn(), spritesheet: jest.fn(), start: jest.fn(), once: loadOnce, on: jest.fn() },
    add:      { text: addText },
    anims:    { exists: jest.fn(() => false), create: jest.fn(), generateFrameNumbers: jest.fn(() => []) },
    textures: { exists: jest.fn(() => false) },
    scene:    { start: sceneStart },
  };

  return { scene, addText, sceneStart, probeDestroy };
};

// ── Shared setup ─────────────────────────────────────────────────────────────

const globalSetup = () => {
  (global as any).Phaser = {
    Scene: class {},
    WEBGL: 1,
    Renderer: { WebGL: { WebGLRenderer: class {} } },
  };
};

// ── Test suites ──────────────────────────────────────────────────────────────

describe('Preloader — font warm-up', () => {
  let rafSpy: jest.SpiedFunction<typeof requestAnimationFrame>;

  beforeAll(globalSetup);

  beforeEach(() => {
    // Make requestAnimationFrame synchronous so tests don't need fake timers.
    rafSpy = jest.spyOn(global, 'requestAnimationFrame').mockImplementation(
      (cb: FrameRequestCallback) => { cb(0); return 0; }
    );
    Object.defineProperty(document, 'fonts', {
      value: { ready: Promise.resolve() },
      configurable: true,
    });
  });

  afterEach(() => {
    rafSpy.mockRestore();
    jest.resetModules();
  });

  it('awaits document.fonts.ready before creating probe Text objects', async () => {
    let fontsReadyResolve!: () => void;
    const fontsReady = new Promise<void>(resolve => { fontsReadyResolve = resolve; });
    Object.defineProperty(document, 'fonts', {
      value: { ready: fontsReady },
      configurable: true,
    });

    const { Preloader } = await import('../Preloader');
    const { scene, addText } = buildScene();
    const instance = Object.assign(new Preloader(), scene);

    const createPromise = instance.create();
    expect(addText).not.toHaveBeenCalled();

    fontsReadyResolve();
    await createPromise;
    expect(addText).toHaveBeenCalled();
  });

  it('creates both probe Text objects at off-screen coordinates (-9999, -9999)', async () => {
    const { Preloader } = await import('../Preloader');
    const { scene, addText } = buildScene();
    const instance = Object.assign(new Preloader(), scene);
    await instance.create();
    const coords = addText.mock.calls.map((c: any[]) => [c[0], c[1]]);
    expect(coords).toEqual(expect.arrayContaining([[-9999, -9999], [-9999, -9999]]));
  });

  it('creates a Minotaur probe and a Hack probe', async () => {
    const { Preloader } = await import('../Preloader');
    const { scene, addText } = buildScene();
    const instance = Object.assign(new Preloader(), scene);
    await instance.create();
    const families: string[] = addText.mock.calls.map((c: any[]) => c[3]?.fontFamily);
    expect(families).toContain('Minotaur');
    expect(families).toContain('Hack');
  });

  it('calls requestAnimationFrame before scene.start("MainMenu")', async () => {
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

  it('destroys both probe Text objects after calling scene.start("MainMenu")', async () => {
    const callOrder: string[] = [];
    const { Preloader } = await import('../Preloader');
    const { scene, sceneStart, probeDestroy } = buildScene();
    (sceneStart as jest.Mock).mockImplementation(() => callOrder.push('start'));
    (probeDestroy as jest.Mock).mockImplementation(() => callOrder.push('destroy'));
    const instance = Object.assign(new Preloader(), scene);
    await instance.create();
    expect(callOrder.indexOf('start')).toBeLessThan(callOrder.indexOf('destroy'));
    expect(probeDestroy).toHaveBeenCalledTimes(2);
  });

  it('still starts MainMenu if an error occurs during font warm-up', async () => {
    Object.defineProperty(document, 'fonts', {
      value: { ready: Promise.reject(new Error('fonts unavailable')) },
      configurable: true,
    });
    const { Preloader } = await import('../Preloader');
    const { scene, sceneStart } = buildScene();
    const instance = Object.assign(new Preloader(), scene);
    await expect(instance.create()).resolves.toBeUndefined();
    expect(sceneStart).toHaveBeenCalledWith('MainMenu');
  });
});

describe('Preloader — splash screen dismissal', () => {
  let rafSpy: jest.SpiedFunction<typeof requestAnimationFrame>;

  beforeAll(globalSetup);

  beforeEach(() => {
    rafSpy = jest.spyOn(global, 'requestAnimationFrame').mockImplementation(
      (cb: FrameRequestCallback) => { cb(0); return 0; }
    );
    Object.defineProperty(document, 'fonts', {
      value: { ready: Promise.resolve() },
      configurable: true,
    });
  });

  afterEach(() => {
    rafSpy.mockRestore();
    // Remove any loading-screen left by a test
    document.getElementById('loading-screen')?.remove();
    jest.resetModules();
  });

  it('removes #loading-screen before scene.start("MainMenu") on the happy path', async () => {
    // Inject the loading screen element as the browser would
    const screen = document.createElement('div');
    screen.id = 'loading-screen';
    document.body.appendChild(screen);

    const callOrder: string[] = [];
    const { Preloader } = await import('../Preloader');
    const { scene, sceneStart } = buildScene();
    (sceneStart as jest.Mock).mockImplementation(() => {
      callOrder.push(document.getElementById('loading-screen') ? 'screen-present' : 'screen-gone');
    });
    const instance = Object.assign(new Preloader(), scene);
    await instance.create();

    // Screen must already be removed *before* scene.start fires
    expect(callOrder[0]).toBe('screen-gone');
    expect(document.getElementById('loading-screen')).toBeNull();
  });

  it('removes #loading-screen even when an error is thrown', async () => {
    const screen = document.createElement('div');
    screen.id = 'loading-screen';
    document.body.appendChild(screen);

    Object.defineProperty(document, 'fonts', {
      value: { ready: Promise.reject(new Error('load failure')) },
      configurable: true,
    });

    const { Preloader } = await import('../Preloader');
    const { scene } = buildScene();
    const instance = Object.assign(new Preloader(), scene);
    await instance.create();

    expect(document.getElementById('loading-screen')).toBeNull();
  });

  it('does not throw when #loading-screen is absent from the DOM', async () => {
    // Ensure the element is not present
    document.getElementById('loading-screen')?.remove();

    const { Preloader } = await import('../Preloader');
    const { scene } = buildScene();
    const instance = Object.assign(new Preloader(), scene);
    await expect(instance.create()).resolves.toBeUndefined();
  });
});

describe('Preloader — parallel manager initialisation', () => {
  let rafSpy: jest.SpiedFunction<typeof requestAnimationFrame>;

  beforeAll(globalSetup);

  beforeEach(() => {
    rafSpy = jest.spyOn(global, 'requestAnimationFrame').mockImplementation(
      (cb: FrameRequestCallback) => { cb(0); return 0; }
    );
    Object.defineProperty(document, 'fonts', {
      value: { ready: Promise.resolve() },
      configurable: true,
    });
  });

  afterEach(() => {
    rafSpy.mockRestore();
    jest.resetModules();
  });

  it('calls both GameManager.initialize and SettingsManager.loadSettings', async () => {
    const { Preloader } = await import('../Preloader');
    const { GameManager }     = await import('../../managers/GameManager');
    const { SettingsManager } = await import('../../managers/SettingsManager');

    // Use a single shared instance so create() and the test see the same spy
    const gmInstance  = { initialize: jest.fn().mockResolvedValue(undefined), getConfig: jest.fn(() => ({ rootDialIconPath: null })) };
    const smInstance  = { loadSettings: jest.fn().mockResolvedValue(undefined) };
    (GameManager.getInstance  as jest.Mock).mockReturnValue(gmInstance);
    (SettingsManager.getInstance as jest.Mock).mockReturnValue(smInstance);

    const { scene } = buildScene();
    const instance = Object.assign(new Preloader(), scene);
    await instance.create();

    expect(gmInstance.initialize).toHaveBeenCalledWith(
      expect.anything(), 'data/config.json', 'data/items.json'
    );
    expect(smInstance.loadSettings).toHaveBeenCalled();
  });

  it('reaches scene.start only after both managers have resolved', async () => {
    // Create promises whose resolution we control
    let resolveInit!: () => void;
    let resolveSettings!: () => void;
    const initDone     = new Promise<void>(r => { resolveInit     = r; });
    const settingsDone = new Promise<void>(r => { resolveSettings = r; });

    const { GameManager }     = await import('../../managers/GameManager');
    const { SettingsManager } = await import('../../managers/SettingsManager');
    (GameManager.getInstance  as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockReturnValue(initDone),
      getConfig:  jest.fn(() => ({ rootDialIconPath: null })),
    });
    (SettingsManager.getInstance as jest.Mock).mockReturnValue({
      loadSettings: jest.fn().mockReturnValue(settingsDone),
    });

    const { Preloader } = await import('../Preloader');
    const { scene, sceneStart } = buildScene();
    const instance = Object.assign(new Preloader(), scene);

    const createPromise = instance.create();

    // Neither has resolved — scene.start must not have been called
    expect(sceneStart).not.toHaveBeenCalled();

    resolveInit();
    resolveSettings();
    await createPromise;

    expect(sceneStart).toHaveBeenCalledWith('MainMenu');
  });
});

describe('Preloader.preload — progress bar (step E)', () => {
  beforeAll(globalSetup);

  afterEach(() => {
    document.getElementById('loading-bar-fill')?.remove();
    jest.resetModules();
  });

  /** Extract the progress callback registered via load.on('progress', cb). */
  const getProgressCb = (loadOn: jest.Mock): ((v: number) => void) | undefined => {
    const call = loadOn.mock.calls.find((c: any[]) => c[0] === 'progress');
    return call ? call[1] as (v: number) => void : undefined;
  };

  it('registers a progress listener on this.load', async () => {
    // Fill element must be present — the listener is only registered when the
    // element exists (guard prevents errors when running outside a browser).
    const fill = document.createElement('div');
    fill.id = 'loading-bar-fill';
    document.body.appendChild(fill);

    const { Preloader } = await import('../Preloader');
    const { scene } = buildScene();
    const instance = Object.assign(new Preloader(), scene);
    instance.preload();
    expect((scene.load.on as jest.Mock)).toHaveBeenCalledWith('progress', expect.any(Function));
  });

  it('progress callback updates #loading-bar-fill width as a percentage', async () => {
    const fill = document.createElement('div');
    fill.id = 'loading-bar-fill';
    fill.style.animation = 'loading-sweep 1s infinite';
    document.body.appendChild(fill);

    const { Preloader } = await import('../Preloader');
    const { scene } = buildScene();
    const instance = Object.assign(new Preloader(), scene);
    instance.preload();

    const cb = getProgressCb(scene.load.on as jest.Mock)!;
    expect(cb).toBeDefined();

    cb(0.4);
    expect(fill.style.width).toBe('40%');

    cb(1.0);
    expect(fill.style.width).toBe('100%');
  });

  it('progress callback removes the sweep animation', async () => {
    const fill = document.createElement('div');
    fill.id = 'loading-bar-fill';
    fill.style.animation = 'loading-sweep 1.6s infinite';
    document.body.appendChild(fill);

    const { Preloader } = await import('../Preloader');
    const { scene } = buildScene();
    const instance = Object.assign(new Preloader(), scene);
    instance.preload();

    const cb = getProgressCb(scene.load.on as jest.Mock)!;
    cb(0.1);

    expect(fill.style.animation).toBe('none');
    expect(fill.style.transform).toBe('none');
  });

  it('does not throw when #loading-bar-fill is absent from the DOM', async () => {
    document.getElementById('loading-bar-fill')?.remove();

    const { Preloader } = await import('../Preloader');
    const { scene } = buildScene();
    const instance = Object.assign(new Preloader(), scene);
    expect(() => instance.preload()).not.toThrow();

    // Ensure the load.on call itself also does not register a listener that would throw
    const cb = getProgressCb(scene.load.on as jest.Mock);
    // When element is absent, no listener is registered
    expect(cb).toBeUndefined();
  });
});
