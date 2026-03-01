import { AssetLoader } from '../AssetLoader';

describe('AssetLoader', () => {
  // ── getAtlasKey ───────────────────────────────────────────────────────────

  describe('getAtlasKey', () => {
    it('routes skill-*, Skillicon14_*, frame, and hash-sign to atlas-nav', () => {
      expect(AssetLoader.getAtlasKey('skill-diagram')).toBe('atlas-nav');
      expect(AssetLoader.getAtlasKey('skill-down')).toBe('atlas-nav');
      expect(AssetLoader.getAtlasKey('Skillicon14_02')).toBe('atlas-nav');
      expect(AssetLoader.getAtlasKey('frame')).toBe('atlas-nav');
      expect(AssetLoader.getAtlasKey('hash-sign')).toBe('atlas-nav');
    });

    it('returns null for action-item icons and other standalone keys', () => {
      expect(AssetLoader.getAtlasKey('reorient1')).toBeNull();
      expect(AssetLoader.getAtlasKey('rootDialIcon')).toBeNull();
      expect(AssetLoader.getAtlasKey('')).toBeNull();
    });
  });

  // ── preloadAtlases ────────────────────────────────────────────────────────

  describe('preloadAtlases', () => {
    it('calls scene.load.atlas for the 1 nav atlas group', () => {
      const mockScene: any = { load: { atlas: jest.fn() } };
      AssetLoader.preloadAtlases(mockScene);
      expect(mockScene.load.atlas).toHaveBeenCalledTimes(1);
    });

    it('passes correct key and paths for the nav atlas', () => {
      const mockScene: any = { load: { atlas: jest.fn() } };
      AssetLoader.preloadAtlases(mockScene);
      const calls: [string, string, string][] = mockScene.load.atlas.mock.calls;
      const keys = calls.map(c => c[0]);
      expect(keys).toContain('atlas-nav');
      // PNG and JSON paths are correctly paired
      calls.forEach(([key, png, json]) => {
        const name = key.replace('atlas-', '');
        expect(png).toBe(`assets/atlases/${name}.png`);
        expect(json).toBe(`assets/atlases/${name}.json`);
      });
    });
  });

  // ── textureExists ─────────────────────────────────────────────────────────

  describe('textureExists', () => {
    function makeScene(atlasLoaded: boolean, frameLoaded: boolean): any {
      return {
        textures: {
          exists: jest.fn(() => atlasLoaded),
          get: jest.fn(() => ({ has: jest.fn(() => frameLoaded) })),
        },
      };
    }

    it('returns true when the atlas is loaded and the frame exists', () => {
      expect(AssetLoader.textureExists(makeScene(true, true), 'skill-diagram')).toBe(true);
    });

    it('returns false when the atlas is not yet loaded', () => {
      expect(AssetLoader.textureExists(makeScene(false, false), 'skill-diagram')).toBe(false);
    });

    it('returns false when the atlas is loaded but frame is absent', () => {
      expect(AssetLoader.textureExists(makeScene(true, false), 'skill-diagram')).toBe(false);
    });

    it('falls through to scene.textures.exists for non-atlas icons', () => {
      const mockScene: any = {
        textures: { exists: jest.fn(() => true), get: jest.fn() },
      };
      expect(AssetLoader.textureExists(mockScene, 'rootDialIcon')).toBe(true);
      expect(mockScene.textures.get).not.toHaveBeenCalled();
    });
  });

  // ── createImage ───────────────────────────────────────────────────────────

  describe('createImage', () => {
    function makeScene(): any {
      return { add: { image: jest.fn(() => ({})) } };
    }

    it('passes atlas key + frame name for atlas sprites', () => {
      const scene = makeScene();
      AssetLoader.createImage(scene, 10, 20, 'skill-diagram');
      expect(scene.add.image).toHaveBeenCalledWith(10, 20, 'atlas-nav', 'skill-diagram');
    });

    it('uses icon key directly for non-atlas sprites', () => {
      const scene = makeScene();
      AssetLoader.createImage(scene, 0, 0, 'rootDialIcon');
      expect(scene.add.image).toHaveBeenCalledWith(0, 0, 'rootDialIcon');
    });
  });

  // ── preloadItemAssets (legacy no-op) ──────────────────────────────────────

  describe('preloadItemAssets (deprecated no-op)', () => {
    it('does not call load.image or load.atlas', () => {
      const mockScene: any = { load: { image: jest.fn(), atlas: jest.fn() } };
      AssetLoader.preloadItemAssets(mockScene, []);
      expect(mockScene.load.image).not.toHaveBeenCalled();
      expect(mockScene.load.atlas).not.toHaveBeenCalled();
    });
  });
});
