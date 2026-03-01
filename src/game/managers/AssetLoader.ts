import { Item, MenuItem } from '../types/GameTypes';
import { ITEM_ATLASES } from '../generated/SpritesManifest';

export class AssetLoader {
  // ── Atlas loading ─────────────────────────────────────────────────────────

  /**
   * Returns the atlas key for a given icon key, or `null` if the icon is not
   * part of any atlas (e.g. standalone PNGs for action items).
   *
   * Only the nav atlas survives — skill-* icons, Skillicon14_* dial frames,
   * the generic `frame` key, and `hash-sign` all live in atlas-nav.
   * Action-item icons (e.g. reorient1–20) are loaded as individual images
   * and return null here.
   */
  static getAtlasKey(iconKey: string): string | null {
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
    for (const name of ITEM_ATLASES) {
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
