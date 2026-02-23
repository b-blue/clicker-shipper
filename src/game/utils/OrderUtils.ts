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
 *   1. It is a direct child of a root (A-level) menu item  — i.e. it lives
 *      on the B-level dial that is shown when the player drills into any
 *      A-level category.
 *   2. It is NOT a navigation-down item (icon === 'skill-down' or id
 *      contains '_down_'). Those items expand into a deeper (locked) dial
 *      and are therefore not directly selectable by the player yet.
 *   3. It has a defined `cost` field — items without a cost are metadata
 *      nodes, not shippable goods.
 *
 * This intentionally mirrors the locking logic in RadialDial.shouldLockNavItem
 * so that orders are always composed of items the player can actually reach.
 */
export function getShippableItems(items: any[]): MenuItem[] {
  const normalized = normalizeItems(items);
  const shippable: MenuItem[] = [];

  normalized.forEach(rootItem => {
    if (!rootItem.children) return;
    rootItem.children.forEach((child: MenuItem) => {
      const isNavDown = child.icon === 'skill-down' || child.id.includes('_down_');
      if (!isNavDown && child.cost !== undefined) {
        shippable.push(child);
      }
    });
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

/** Weighted random quantity: 60%=1, 25%=2, 10%=3, 4%=4, 1%=5 */
export function getRandomQuantity(): number {
  const roll = Math.random();
  if (roll < 0.60) return 1;
  if (roll < 0.85) return 2;
  if (roll < 0.95) return 3;
  if (roll < 0.99) return 4;
  return 5;
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
    quantity: qtyFn(),
    cost: item.cost ?? 0,
  }));

  const budget = requirements.reduce((sum, req) => sum + req.cost * req.quantity, 0);

  return {
    id: `order_${Date.now()}`,
    budget,
    requirements,
  };
}
