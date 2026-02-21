import { Item } from '../types/GameTypes';

export class AssetLoader {
  /**
   * Auto-loads all item sprites from items.json.
   * Each item sprite is named using its id (e.g., item_1_1, item_2_3).
   * Assumes sprites are stored at public/assets/items/{id}.png
   * 
   * To disable this during development, comment out the call in Boot.ts preload().
   * To remove entirely after development, delete this file and remove the call from Boot.ts.
   */
  static preloadItemAssets(scene: Phaser.Scene, items: Item[]): void {
    items.forEach((category) => {
      category.subItems.forEach((subItem) => {
        const texturePath = `assets/items/${subItem.id}.png`;
        scene.load.image(subItem.id, texturePath);
      });
    });
  }
}
