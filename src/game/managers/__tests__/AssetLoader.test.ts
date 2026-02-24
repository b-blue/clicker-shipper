import { AssetLoader } from '../AssetLoader';

describe('AssetLoader', () => {
  // ── getAtlasKey ───────────────────────────────────────────────────────────

  describe('getAtlasKey', () => {
    it('routes arm* icons to atlas-armaments', () => {
      expect(AssetLoader.getAtlasKey('arm1')).toBe('atlas-armaments');
      expect(AssetLoader.getAtlasKey('arm40')).toBe('atlas-armaments');
    });

    it('routes melee* icons to atlas-melee', () => {
      expect(AssetLoader.getAtlasKey('melee1')).toBe('atlas-melee');
    });

    it('routes mining* and named mining icons to atlas-mining', () => {
      expect(AssetLoader.getAtlasKey('mining1')).toBe('atlas-mining');
      expect(AssetLoader.getAtlasKey('pickaxe')).toBe('atlas-mining');
      expect(AssetLoader.getAtlasKey('pickaxe-broken')).toBe('atlas-mining');
      expect(AssetLoader.getAtlasKey('shovel')).toBe('atlas-mining');
      expect(AssetLoader.getAtlasKey('jackhammer')).toBe('atlas-mining');
      expect(AssetLoader.getAtlasKey('cthonic-bore')).toBe('atlas-mining');
      expect(AssetLoader.getAtlasKey('handheld-cthonic-bore')).toBe('atlas-mining');
      expect(AssetLoader.getAtlasKey('ice-core-augur')).toBe('atlas-mining');
    });

    it('routes radioactive* and Iconset10 to atlas-radioactive', () => {
      expect(AssetLoader.getAtlasKey('radioactive1')).toBe('atlas-radioactive');
      expect(AssetLoader.getAtlasKey('Iconset10')).toBe('atlas-radioactive');
    });

    it('routes resource* icons to atlas-resources', () => {
      expect(AssetLoader.getAtlasKey('resource1')).toBe('atlas-resources');
    });

    it('routes streetwear* icons to atlas-streetwear', () => {
      expect(AssetLoader.getAtlasKey('streetwear1')).toBe('atlas-streetwear');
    });

    it('routes skill-*, Skillicon14_*, frame, and hash-sign to atlas-nav', () => {
      expect(AssetLoader.getAtlasKey('skill-diagram')).toBe('atlas-nav');
      expect(AssetLoader.getAtlasKey('skill-down')).toBe('atlas-nav');
      expect(AssetLoader.getAtlasKey('Skillicon14_02')).toBe('atlas-nav');
      expect(AssetLoader.getAtlasKey('frame')).toBe('atlas-nav');
      expect(AssetLoader.getAtlasKey('hash-sign')).toBe('atlas-nav');
    });

    it('returns null for unknown / one-off icon keys', () => {
      expect(AssetLoader.getAtlasKey('rootDialIcon')).toBeNull();
      expect(AssetLoader.getAtlasKey('')).toBeNull();
    });
  });

  // ── preloadAtlases ────────────────────────────────────────────────────────

  describe('preloadAtlases', () => {
    it('calls scene.load.atlas for each of the 7 atlas groups', () => {
      const mockScene: any = { load: { atlas: jest.fn() } };
      AssetLoader.preloadAtlases(mockScene);
      expect(mockScene.load.atlas).toHaveBeenCalledTimes(7);
    });

    it('passes correct keys and paths for each atlas', () => {
      const mockScene: any = { load: { atlas: jest.fn() } };
      AssetLoader.preloadAtlases(mockScene);
      const calls: [string, string, string][] = mockScene.load.atlas.mock.calls;
      const keys = calls.map(c => c[0]);
      expect(keys).toContain('atlas-armaments');
      expect(keys).toContain('atlas-melee');
      expect(keys).toContain('atlas-mining');
      expect(keys).toContain('atlas-radioactive');
      expect(keys).toContain('atlas-resources');
      expect(keys).toContain('atlas-streetwear');
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
      expect(AssetLoader.textureExists(makeScene(true, true), 'arm1')).toBe(true);
    });

    it('returns false when the atlas is not yet loaded', () => {
      expect(AssetLoader.textureExists(makeScene(false, false), 'arm1')).toBe(false);
    });

    it('returns false when the atlas is loaded but frame is absent', () => {
      expect(AssetLoader.textureExists(makeScene(true, false), 'arm1')).toBe(false);
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
      AssetLoader.createImage(scene, 10, 20, 'arm1');
      expect(scene.add.image).toHaveBeenCalledWith(10, 20, 'atlas-armaments', 'arm1');
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
