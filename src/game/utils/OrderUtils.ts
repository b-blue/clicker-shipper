import { MenuItem, Order, OrderRequirement } from '../types/GameTypes';
import { normalizeItems } from './ItemAdapter';
import { ProgressionManager } from '../managers/ProgressionManager';

/**
 * A catalog category groups an A-level root item with its directly accessible
 * (B-level, non-locked) shippable children.  This matches exactly the items
 * a player can currently reach and is used as the single source of truth for
 * both order generation and the catalog display.
 */
export interface CatalogCategory {
  category: MenuItem;
  items: MenuItem[];
}

/**
 * Returns only the items that are currently accessible to the player and
 * eligible to appear in orders.
 *
 * An item is "shippable" if:
 *   1. Its parent root (A-level) category is unlocked per ProgressionManager.
 *      Categories that follow the `nav_*_root` naming convention are checked;
 *      others (legacy / test fixtures without that pattern) are included as-is.
 *   2. It is a direct child of an A-level menu item — i.e. it lives on the
 *      B-level dial shown when the player drills into a category.
 *   3. It is NOT a navigation-down item (icon === 'skill-down' or id contains
 *      '_down_'). Those expand into deeper dials not yet selectable.
 *   4. It has a defined `cost` field — items without a cost are metadata nodes.
 *
 * This mirrors the locking logic in RadialDial.shouldLockNavItem and
 * getCatalogRows so that orders are always composed of items the player can
 * actually reach on the dial.
 */
export function getShippableItems(items: any[]): MenuItem[] {
  const normalized = normalizeItems(items);
  const shippable: MenuItem[] = [];

  // Obtain progression state; fall back gracefully when unavailable (e.g. tests).
  let pm: { isUnlocked: (id: string) => boolean; getUnlockedDepth: (id: string) => number } | null = null;
  try { pm = ProgressionManager.getInstance(); } catch { /* unavailable */ }

  /**
   * Recursively collects leaf (shippable) items from a nav node, respecting
   * the unlocked depth for nav_*_down_N gated sub-trees.
   */
  const collectLeaves = (node: MenuItem, unlockedDepth: number): void => {
    if (!node.children) return;
    node.children.forEach((child: MenuItem) => {
      // Depth-gated nav node: recurse only when the player has unlocked far
      // enough (levelN must be strictly less than their unlocked depth).
      const downMatch = child.id.match(/_down_(\d+)$/);
      if (downMatch) {
        const levelN = parseInt(downMatch[1], 10);
        if (levelN < unlockedDepth) {
          collectLeaves(child, unlockedDepth);
        }
        return;
      }
      // Exclude any remaining navigation nodes (non-numeric _down_ ids,
      // skill-down icons, etc.) that are not leaf items.
      const isNavDown = child.icon === 'skill-down' || child.id.includes('_down_');
      if (!isNavDown && child.cost !== undefined) {
        shippable.push(child);
      }
    });
  };

  normalized.forEach(rootItem => {
    if (!rootItem.children) return;

    // Skip locked progression categories.
    const isProgressionCategory = rootItem.id.startsWith('nav_') && rootItem.id.endsWith('_root');
    if (isProgressionCategory && pm && !pm.isUnlocked(rootItem.id)) return;

    // Depth governs how many nav_*_down_N levels are accessible.
    // Non-progression categories default to depth=1 (B-level only).
    const unlockedDepth = (isProgressionCategory && pm) ? pm.getUnlockedDepth(rootItem.id) : 1;
    collectLeaves(rootItem, unlockedDepth);
  });

  return shippable;
}

/**
 * Returns all accessible leaf items from a nav node, one dial page at a time,
 * each page reordered counter-clockwise: [pos1, pos6, pos5, pos4, pos3] so
 * the catalog reflects the CCW reading order of the radial dial.
 *
 * @param navNode       The nav node whose children we are scanning.
 * @param unlockedDepth How many `_down_N` levels the player can access
 *                      (nav_*_down_N is recursed when N < unlockedDepth).
 */
function collectDialPageItems(navNode: MenuItem, unlockedDepth: number): MenuItem[] {
  if (!navNode.children) return [];

  // Direct leaf children on this dial page (not nav-down nodes, must have cost)
  const leaves: MenuItem[] = navNode.children.filter((c: MenuItem) => {
    const isNavDown = c.icon === 'skill-down' || c.id.includes('_down_');
    return !isNavDown && c.cost !== undefined;
  });

  // CCW reorder: keep slot-1 item first, then reverse the rest → [0, n-1, n-2, …, 1]
  const ccw: MenuItem[] = leaves.length > 1
    ? [leaves[0], ...leaves.slice(1).reverse()]
    : [...leaves];

  // Recurse into accessible nav_*_down_N children
  const deeper: MenuItem[] = [];
  navNode.children.forEach((child: MenuItem) => {
    const match = child.id.match(/_down_(\d+)$/);
    if (!match) return;                           // non-numeric nav suffix — skip
    const levelN = parseInt(match[1], 10);
    if (levelN < unlockedDepth) {
      deeper.push(...collectDialPageItems(child, unlockedDepth));
    }
  });

  return [...ccw, ...deeper];
}

/**
 * Groups accessible items under their A-level parent categories for the
 * catalog display.  Differs from `getShippableItems` in two ways:
 *
 * 1. **Progression-aware**: for categories that follow the `nav_*_root`
 *    naming convention (the real game progression categories), only unlocked
 *    categories are included, and items from deeper nav levels are shown
 *    based on the player's unlocked depth.
 *
 * 2. **Counter-clockwise ordering**: within each dial page the items are
 *    shown as [pos1, pos6, pos5, pos4, pos3] (CCW from the top slot).
 */
export function getCatalogRows(items: any[]): CatalogCategory[] {
  const normalized = normalizeItems(items);
  const rows: CatalogCategory[] = [];

  // Lazily obtain the progression manager; fall back gracefully if unavailable.
  let pm: { isUnlocked: (id: string) => boolean; getUnlockedDepth: (id: string) => number } | null = null;
  try { pm = ProgressionManager.getInstance(); } catch { /* unavailable */ }

  normalized.forEach(rootItem => {
    if (!rootItem.children) return;

    // Determine whether this root item is a managed progression category.
    // Convention: all game categories use ids like `nav_<slug>_root`.
    const isProgressionCategory = rootItem.id.startsWith('nav_') && rootItem.id.endsWith('_root');

    // Skip locked progression categories.
    if (isProgressionCategory && pm && !pm.isUnlocked(rootItem.id)) return;

    // Depth governs how many nav_*_down_N levels are accessible.
    // Unknown / non-progression categories default to depth=1 (B-level only).
    const unlockedDepth = (isProgressionCategory && pm)
      ? pm.getUnlockedDepth(rootItem.id)
      : 1;

    const pageItems = collectDialPageItems(rootItem, unlockedDepth);
    if (pageItems.length > 0) {
      rows.push({ category: rootItem, items: pageItems });
    }
  });

  return rows;
}

/** Weighted random quantity: 60%=1, 30%=2, 10%=3 (max 3 per item type). */
export function getRandomQuantity(): number {
  const roll = Math.random();
  if (roll < 0.60) return 1;
  if (roll < 0.90) return 2;
  return 3;
}

/**
 * Generates an order from the subset of items currently accessible to the
 * player (via getShippableItems).  Passing a custom `rng` and `qtyFn` lets
 * tests inject deterministic randomness.
 */
export function generateOrder(
  items: any[],
  rng: () => number = Math.random,
  qtyFn: () => number = getRandomQuantity,
): Order {
  const shippable = getShippableItems(items);
  if (shippable.length === 0) {
    return { id: `order_${Date.now()}`, budget: 0, requirements: [] };
  }

  const MAX_ITEM_QTY = 3;  // no more than this quantity of a single item type
  const MAX_TOTAL_QTY = 7; // no more than this total items across the whole order

  const numItems = Math.min(Math.floor(rng() * 5) + 1, shippable.length);
  const selected: MenuItem[] = [];
  const indices = new Set<number>();
  while (indices.size < numItems) {
    indices.add(Math.floor(rng() * shippable.length));
  }
  indices.forEach(i => selected.push(shippable[i]));

  const requirements: OrderRequirement[] = selected.map(item => ({
    itemId: item.id,
    itemName: item.name,
    iconKey: item.icon,
    quantity: Math.min(qtyFn(), MAX_ITEM_QTY),
    cost: item.cost ?? 0,
  }));

  // Trim total quantity to MAX_TOTAL_QTY, reducing from the last requirement first
  let total = requirements.reduce((s, r) => s + r.quantity, 0);
  for (let i = requirements.length - 1; i >= 0 && total > MAX_TOTAL_QTY; i--) {
    const cut = Math.min(requirements[i].quantity, total - MAX_TOTAL_QTY);
    requirements[i].quantity -= cut;
    total -= cut;
  }
  const trimmed = requirements.filter(r => r.quantity > 0);

  const budget = trimmed.reduce((sum, req) => sum + req.cost * req.quantity, 0);

  return {
    id: `order_${Date.now()}`,
    budget,
    requirements: trimmed,
  };
}
