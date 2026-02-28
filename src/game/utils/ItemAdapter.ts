import { Item, SubItem, MenuItem, GameConfig } from '../types/GameTypes';

/**
 * Adapter to convert legacy Item/SubItem structure to hierarchical MenuItem structure
 * Provides backward compatibility while gradually migrating to the new format
 */

/**
 * Convert a SubItem to a MenuItem (leaf node)
 * @param subItem The legacy SubItem
 * @returns MenuItem representation of the SubItem
 */
function subItemToMenuItem(subItem: SubItem): MenuItem {
  return {
    id: subItem.id,
    name: subItem.name,
    icon: subItem.icon,
    cost: subItem.cost,
    description: subItem.description,
    layers: subItem.layers,
    // SubItems are leaves, so no children property
  };
}

/**
 * Convert an Item to a MenuItem (navigation node)
 * @param item The legacy Item with subItems
 * @returns MenuItem representation with subItems converted to children
 */
function itemToMenuItem(item: Item): MenuItem {
  return {
    id: item.id,
    name: item.name,
    icon: item.icon,
    description: item.description,
    layers: item.layers,
    children: item.subItems.map(subItemToMenuItem),
  };
}

/**
 * Convert legacy Item[] to MenuItem[]
 * Handles the 2-level hierarchy (Item -> SubItem) and converts to MenuItem tree
 * @param items Legacy Item[] array
 * @returns MenuItem[] hierarchy
 */
export function adaptLegacyItems(items: Item[]): MenuItem[] {
  return items.map(itemToMenuItem);
}

/**
 * Check if data is already in MenuItem format (has 'children' property instead of 'subItems')
 * @param items The items to check
 * @returns true if items are already in MenuItem format
 */
export function isMenuItemFormat(items: any[]): items is MenuItem[] {
  if (!items || items.length === 0) return true; // Empty is valid for both

  const firstItem = items[0];
  // Check for 'children' property and lack of 'subItems'
  return 'children' in firstItem && !('subItems' in firstItem);
}

/**
 * Normalize items to MenuItem[] format, handling both legacy and new formats
 * @param items Items that could be either Item[] or MenuItem[]
 * @returns MenuItem[] in the new format
 */
export function normalizeItems(items: Item[] | MenuItem[]): MenuItem[] {
  // If already in MenuItem format, return as-is
  if (isMenuItemFormat(items)) {
    return items;
  }

  // Otherwise, convert from legacy format
  return adaptLegacyItems(items as Item[]);
}

/**
 * Builds a paginated nav-tree MenuItem hierarchy from a flat list of leaf items.
 *
 * Each page holds up to `pageSize` leaf items.  When the list exceeds one page
 * a "More" nav-down node is appended that links to the overflow page, recursively.
 *
 * This replaces the hand-authored nav_*_down_N nodes that previously lived in
 * items.json — the tree is now generated at runtime from compact flat files.
 *
 * @param items    Flat array of leaf items (MenuItem without children).
 * @param pageSize Max items per dial page.  Defaults to config.itemsPerLevel (5).
 * @param depth    Internal recursion counter; starts at 0.
 * @returns        Root-level MenuItem array ready to pass to StandardNavFace.
 */
export function paginateItems(
  items: MenuItem[],
  pageSize: number = 5,
  depth: number = 0,
  navDownIndex: number = 1,
): MenuItem[] {
  if (items.length === 0) return [];

  const page    = items.slice(0, pageSize);
  const rest    = items.slice(pageSize);

  if (rest.length === 0) return page;

  const navDown: MenuItem = {
    id:   `nav_page_down_${depth}`,
    name: 'More',
    icon: 'skill-down',
    layers: [
      { texture: 'skill-down', depth: 3 },
      { texture: 'frame',      depth: 2 },
    ],
    children: paginateItems(rest, pageSize, depth + 1, navDownIndex),
  };

  // Insert the nav-down node at the target clock position:
  //   navDownIndex=1 → 3 o'clock (right-handed default)
  //   navDownIndex=4 → 9 o'clock (left-handed)
  const result = [...page];
  result.splice(Math.min(navDownIndex, page.length), 0, navDown);
  return result;
}

/**
 * Convenience wrapper: paginate a flat item list using the itemsPerLevel value
 * from GameConfig (falls back to 5 if config is not yet available).
 */
export function paginateWithConfig(
  items: MenuItem[],
  config: GameConfig | null,
  navDownIndex: number = 1,
): MenuItem[] {
  const pageSize = config?.itemsPerLevel ?? 5;
  return paginateItems(items, pageSize, 0, navDownIndex);
}
