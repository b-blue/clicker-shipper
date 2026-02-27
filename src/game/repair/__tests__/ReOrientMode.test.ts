/** @jest-environment jsdom */
/**
 * Tests for ReOrientMode — focussed on the pipeline-integration logic that
 * caused repeated runtime crashes.
 *
 * We do NOT render anything; all scene / container dependencies are mocked.
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
    mode.setBotBounds({ cx: 100, cy: 200, w: 200, h: 120 });
    mode.setPool([{ id: 'item1', icon: 'icon1' }, { id: 'item2', icon: 'icon2' }]);

    mode.buildArrangement(containerMock as any, 2, 'drone-1-idle');

    expect(spriteMock.setPostPipeline).toHaveBeenCalledWith('DiagnosticFX');
    expect(spriteMock._pipe.pendingEdgeColor).toEqual([0.28, 0.40, 0.32]);
  });

  it('does NOT call delayedCall for the initial color', () => {
    const { scene, containerMock } = makeScene();

    const mode = new ReOrientMode(scene as any);
    mode.setBotBounds({ cx: 100, cy: 200, w: 200, h: 120 });
    mode.setPool([{ id: 'item1', icon: 'icon1' }]);

    mode.buildArrangement(containerMock as any, 1, 'drone-1-idle');

    expect(scene.time.delayedCall).not.toHaveBeenCalled();
  });

  it('skips wireframe when droneKey is undefined', () => {
    const { scene, spriteMock, containerMock } = makeScene();

    const mode = new ReOrientMode(scene as any);
    mode.setBotBounds({ cx: 100, cy: 200, w: 200, h: 120 });
    mode.setPool([{ id: 'item1', icon: 'icon1' }]);

    // No droneKey
    mode.buildArrangement(containerMock as any, 1);

    expect(spriteMock.setPostPipeline).not.toHaveBeenCalled();
  });

  it('skips wireframe when the texture does not exist', () => {
    const { scene, spriteMock, containerMock } = makeScene();
    scene.textures.exists.mockReturnValue(false);

    const mode = new ReOrientMode(scene as any);
    mode.setBotBounds({ cx: 100, cy: 200, w: 200, h: 120 });
    mode.setPool([{ id: 'item1', icon: 'icon1' }]);

    mode.buildArrangement(containerMock as any, 1, 'drone-1-idle');

    expect(spriteMock.setPostPipeline).not.toHaveBeenCalled();
  });
});
