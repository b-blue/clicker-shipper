import { Item, SubItem, MenuItem } from '../types/GameTypes';

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
