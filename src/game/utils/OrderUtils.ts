import { MenuItem, Order, OrderRequirement } from '../types/GameTypes';
import { normalizeItems } from './ItemAdapter';

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
