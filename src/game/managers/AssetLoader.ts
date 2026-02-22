import { Item, MenuItem } from '../types/GameTypes';

export class AssetLoader {
  /**
   * Auto-loads all item sprites from items.json.
   * Each item sprite is named using its id (e.g., item_1, item_1_1, item_2_3).
   * Assumes sprites are stored at public/assets/items/{id}.png
   * 
   * Supports multi-layer images via the layers property in items.json.
   * Layer textures are loaded from assets/items/{texture}.png
   * 
   * Works with both hierarchical (MenuItem) and legacy (Item) formats.
   * Recursively loads all items at any nesting depth.
   * 
   * To disable this during development, comment out the call in Boot.ts preload().
   * To remove entirely after development, delete this file and remove the call from Boot.ts.
   */
  static preloadItemAssets(scene: Phaser.Scene, items: Item[] | MenuItem[]): void {
    // Check if items are in MenuItem format (hierarchical)
    if (this.isMenuItemFormat(items)) {
      this.preloadMenuItemsRecursive(scene, items as MenuItem[]);
    } else {
      // Legacy Item format
      this.preloadLegacyItems(scene, items as Item[]);
    }
  }

  /**
   * Recursively load MenuItem structures at any depth
   */
  private static preloadMenuItemsRecursive(scene: Phaser.Scene, items: MenuItem[]): void {
    items.forEach((item) => {
      // Load item's icon texture from appropriate folder
      const texturePath = this.getAssetPath(item.icon, item.type);
      scene.load.image(item.icon, texturePath);
      
      // Load item's layer textures if defined
      if (item.layers) {
        item.layers.forEach((layer) => {
          const layerTexturePath = this.getAssetPath(layer.texture);
          scene.load.image(layer.texture, layerTexturePath);
        });
      }
      
      // Recursively load children if they exist
      if (item.children && item.children.length > 0) {
        this.preloadMenuItemsRecursive(scene, item.children);
      }
    });
  }

  /**
   * Determine the correct asset path based on icon name and type
   */
  private static getAssetPath(iconName: string, type?: string): string {
    // Skill icons and frame go in nav-items
    if (iconName.startsWith('Skillicon14_') || iconName.startsWith('skill-') || iconName === 'frame') {
      return `assets/nav-items/${iconName}.png`;
    }
    
    // Route new-format item icons to their folders
    if (iconName.startsWith('arm') || type === 'armaments') {
      return `assets/armaments/${iconName}.png`;
    }
    if (iconName.startsWith('melee') || type === 'melee') {
      return `assets/melee/${iconName}.png`;
    }
    if (iconName.startsWith('mining') || type === 'mining') {
      return `assets/mining/${iconName}.png`;
    }
    if (iconName.startsWith('radioactive') || type === 'radioactive') {
      return `assets/radioactive/${iconName}.png`;
    }
    if (iconName.startsWith('streetwear') || type === 'streetwear') {
      return `assets/streetwear/${iconName}.png`;
    }
    if (iconName.startsWith('resource')) {
      return `assets/resources/${iconName}.png`;
    }
    
    // Fallback to generic items folder
    return `assets/items/${iconName}.png`;
  }

  /**
   * Load legacy Item format (2-level hierarchy)
   */
  private static preloadLegacyItems(scene: Phaser.Scene, items: Item[]): void {
    items.forEach((category) => {
      // Load category/top-level item image using correct folder
      const categoryTexturePath = this.getAssetPath(category.icon, category.type);
      scene.load.image(category.icon, categoryTexturePath);
      
      // Load category layer images if defined
      if (category.layers) {
        category.layers.forEach((layer) => {
          const layerTexturePath = this.getAssetPath(layer.texture);
          scene.load.image(layer.texture, layerTexturePath);
        });
      }
      
      // Load sub-item images
      category.subItems.forEach((subItem) => {
        const texturePath = this.getAssetPath(subItem.icon, subItem.type);
        scene.load.image(subItem.icon, texturePath);
        
        // Load sub-item layer images if defined
        if (subItem.layers) {
          subItem.layers.forEach((layer) => {
            const layerTexturePath = this.getAssetPath(layer.texture);
            scene.load.image(layer.texture, layerTexturePath);
          });
        }
      });
    });
  }

  /**
   * Check if items are in MenuItem format (has 'children' property, no 'subItems')
   */
  private static isMenuItemFormat(items: any[]): items is MenuItem[] {
    if (!items || items.length === 0) return true; // Empty is valid for both
    const firstItem = items[0];
    return 'children' in firstItem && !('subItems' in firstItem);
  }
}
