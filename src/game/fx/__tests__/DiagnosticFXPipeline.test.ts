/**
 * Tests for DiagnosticFXPipeline.
 *
 * DiagnosticFXPipeline.ts uses Phaser as a global (no import statement), so we
 * install a lightweight stub on `global.Phaser` before requiring the module.
 */

// ── Mock parent class ──────────────────────────────────────────────────────

class MockPostFXPipeline {
  set3fCalls: Array<[string, number, number, number]> = [];
  set1fCalls: Array<[string, number]> = [];
  uniforms: Record<string, { value: any }> = {};

  set3f(name: string, x: number, y: number, z: number) {
    this.uniforms[name] = { value: [x, y, z] };
    this.set3fCalls.push([name, x, y, z]);
  }

  set1f(name: string, v: number) {
    this.uniforms[name] = { value: v };
    this.set1fCalls.push([name, v]);
  }
}

// Install global BEFORE any module is required
(global as any).Phaser = {
  Renderer: {
    WebGL: {
      Pipelines: {
        PostFXPipeline: MockPostFXPipeline,
      },
    },
  },
};

// ── Dynamic require so the global is in place first ───────────────────────
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DiagnosticFXPipeline, DIAGNOSTIC_FX } =
  require('../DiagnosticFXPipeline') as typeof import('../DiagnosticFXPipeline');

// ── Tests ─────────────────────────────────────────────────────────────────

describe('DiagnosticFXPipeline', () => {
  describe('DIAGNOSTIC_FX constant', () => {
    it('is the string "DiagnosticFX"', () => {
      expect(DIAGNOSTIC_FX).toBe('DiagnosticFX');
    });
  });

  describe('pendingEdgeColor', () => {
    it('defaults to null', () => {
      const pipe = new DiagnosticFXPipeline({} as any);
      expect(pipe.pendingEdgeColor).toBeNull();
    });

    it('onBoot uses neon-green default when pendingEdgeColor is null', () => {
      const pipe = new DiagnosticFXPipeline({} as any);
      pipe.onBoot();
      const mock = pipe as any;
      expect(mock.set3fCalls.find((c: any) => c[0] === 'uEdgeColor')).toEqual([
        'uEdgeColor', 0.0, 0.910, 0.392,
      ]);
    });

    it('onBoot uses pendingEdgeColor when set before boot', () => {
      const pipe = new DiagnosticFXPipeline({} as any);
      pipe.pendingEdgeColor = [0.28, 0.40, 0.32];
      pipe.onBoot();
      const mock = pipe as any;
      expect(mock.set3fCalls.find((c: any) => c[0] === 'uEdgeColor')).toEqual([
        'uEdgeColor', 0.28, 0.40, 0.32,
      ]);
    });

    it('onBoot sets uThreshold and uGain regardless of pendingEdgeColor', () => {
      const pipe = new DiagnosticFXPipeline({} as any);
      pipe.onBoot();
      const mock = pipe as any;
      expect(mock.set1fCalls.find((c: any) => c[0] === 'uThreshold')).toEqual([
        'uThreshold', 0.22,
      ]);
      expect(mock.set1fCalls.find((c: any) => c[0] === 'uGain')).toEqual([
        'uGain', 2.8,
      ]);
    });

    it('onBoot can be called multiple times — last call wins', () => {
      const pipe = new DiagnosticFXPipeline({} as any);
      pipe.pendingEdgeColor = [0.1, 0.2, 0.3];
      pipe.onBoot();
      pipe.pendingEdgeColor = [0.5, 0.6, 0.7];
      pipe.onBoot();
      const mock = pipe as any;
      const edgeCalls = mock.set3fCalls.filter((c: any) => c[0] === 'uEdgeColor');
      expect(edgeCalls[edgeCalls.length - 1]).toEqual(['uEdgeColor', 0.5, 0.6, 0.7]);
    });
  });
});


describe('DiagnosticFXPipeline', () => {
  describe('DIAGNOSTIC_FX constant', () => {
    it('is the string "DiagnosticFX"', () => {
      expect(DIAGNOSTIC_FX).toBe('DiagnosticFX');
    });
  });

  describe('pendingEdgeColor', () => {
    it('defaults to null', () => {
      const pipe = new DiagnosticFXPipeline({} as any);
      expect(pipe.pendingEdgeColor).toBeNull();
    });

    it('onBoot uses neon-green default when pendingEdgeColor is null', () => {
      const pipe = new DiagnosticFXPipeline({} as any);
      pipe.onBoot();
      const mock = pipe as any;
      expect(mock.set3fCalls.find((c: any) => c[0] === 'uEdgeColor')).toEqual([
        'uEdgeColor', 0.0, 0.910, 0.392,
      ]);
    });

    it('onBoot uses pendingEdgeColor when set before boot', () => {
      const pipe = new DiagnosticFXPipeline({} as any);
      pipe.pendingEdgeColor = [0.28, 0.40, 0.32];
      pipe.onBoot();
      const mock = pipe as any;
      expect(mock.set3fCalls.find((c: any) => c[0] === 'uEdgeColor')).toEqual([
        'uEdgeColor', 0.28, 0.40, 0.32,
      ]);
    });

    it('onBoot sets uThreshold and uGain regardless of pendingEdgeColor', () => {
      const pipe = new DiagnosticFXPipeline({} as any);
      pipe.onBoot();
      const mock = pipe as any;
      expect(mock.set1fCalls.find((c: any) => c[0] === 'uThreshold')).toEqual([
        'uThreshold', 0.22,
      ]);
      expect(mock.set1fCalls.find((c: any) => c[0] === 'uGain')).toEqual([
        'uGain', 2.8,
      ]);
    });

    it('onBoot can be called multiple times — last call wins', () => {
      const pipe = new DiagnosticFXPipeline({} as any);
      pipe.pendingEdgeColor = [0.1, 0.2, 0.3];
      pipe.onBoot();
      pipe.pendingEdgeColor = [0.5, 0.6, 0.7];
      pipe.onBoot();
      const mock = pipe as any;
      const edgeCalls = mock.set3fCalls.filter((c: any) => c[0] === 'uEdgeColor');
      expect(edgeCalls[edgeCalls.length - 1]).toEqual(['uEdgeColor', 0.5, 0.6, 0.7]);
    });
  });
});
