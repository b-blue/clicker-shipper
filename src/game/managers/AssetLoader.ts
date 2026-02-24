import { Item, MenuItem } from '../types/GameTypes';

/**
 * Named mining sprites that don't follow the `miningN` numbering pattern.
 * These live in the mining atlas and need to be routed there.
 */
const MINING_NAMED = new Set([
  'cthonic-bore',
  'handheld-cthonic-bore',
  'ice-core-augur',
  'jackhammer',
  'pickaxe',
  'pickaxe-broken',
  'shovel',
]);

export class AssetLoader {
  // ── Atlas loading ─────────────────────────────────────────────────────────

  /**
   * Returns the atlas key for a given icon key, or `null` if the icon is not
   * part of any atlas (e.g. rootDialIcon or other one-off images).
   *
   * Convention mirrors the folder layout under public/assets/:
   *   arm*          → atlas-armaments
   *   melee*        → atlas-melee
   *   mining* / named mining icons → atlas-mining
   *   radioactive* / Iconset10     → atlas-radioactive
   *   resource*     → atlas-resources
   *   streetwear*   → atlas-streetwear
   *   skill-* / Skillicon14_* / frame / hash-sign → atlas-nav
   */
  static getAtlasKey(iconKey: string): string | null {
    if (iconKey.startsWith('arm'))                                           return 'atlas-armaments';
    if (iconKey.startsWith('melee'))                                         return 'atlas-melee';
    if (iconKey.startsWith('mining') || MINING_NAMED.has(iconKey))          return 'atlas-mining';
    if (iconKey.startsWith('radioactive') || iconKey === 'Iconset10')       return 'atlas-radioactive';
    if (iconKey.startsWith('resource'))                                      return 'atlas-resources';
    if (iconKey.startsWith('streetwear'))                                    return 'atlas-streetwear';
    if (
      iconKey.startsWith('skill-') ||
      iconKey.startsWith('Skillicon14_') ||
      iconKey === 'frame' ||
      iconKey === 'hash-sign'
    ) return 'atlas-nav';
    return null;
  }

  /**
   * Queues all sprite-atlas files for loading.
   * Call inside a Phaser scene's preload() or before load.start() in create().
   */
  static preloadAtlases(scene: Phaser.Scene): void {
    const atlasNames = ['armaments', 'melee', 'mining', 'radioactive', 'resources', 'streetwear', 'nav'];
    for (const name of atlasNames) {
      scene.load.atlas(`atlas-${name}`, `assets/atlases/${name}.png`, `assets/atlases/${name}.json`);
    }
  }

  // ── Texture helpers ───────────────────────────────────────────────────────

  /**
   * Returns `true` if the icon is available as a loaded texture — either as an
   * individual image or as a frame inside one of the sprite atlases.
   */
  static textureExists(scene: Phaser.Scene, iconKey: string): boolean {
    const atlasKey = this.getAtlasKey(iconKey);
    if (atlasKey) {
      if (!scene.textures.exists(atlasKey)) return false;
      return scene.textures.get(atlasKey).has(iconKey);
    }
    return scene.textures.exists(iconKey);
  }

  /**
   * Creates a Phaser Image for the given icon key, automatically routing
   * through the correct atlas when applicable.
   */
  static createImage(
    scene: Phaser.Scene,
    x: number,
    y: number,
    iconKey: string,
  ): Phaser.GameObjects.Image {
    const atlasKey = this.getAtlasKey(iconKey);
    return atlasKey
      ? scene.add.image(x, y, atlasKey, iconKey)
      : scene.add.image(x, y, iconKey);
  }

  // ── Legacy / backward-compat ──────────────────────────────────────────────

  /**
   * @deprecated Use `preloadAtlases` instead.  Kept so that existing test
   * mocks that reference `preloadItemAssets` continue to compile.
   */
  static preloadItemAssets(scene: Phaser.Scene, items: Item[] | MenuItem[]): void {
    // No-op: atlases are now loaded via preloadAtlases().
    // Signature preserved so legacy call-sites and test stubs compile cleanly.
    void scene; void items;
  }

  /** Check if items are in MenuItem format (has 'children', no 'subItems'). */
  static isMenuItemFormat(items: any[]): items is MenuItem[] {
    if (!items || items.length === 0) return true;
    const firstItem = items[0];
    return 'children' in firstItem && !('subItems' in firstItem);
  }
}
