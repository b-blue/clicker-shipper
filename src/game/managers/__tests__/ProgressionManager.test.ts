/** @jest-environment jsdom */

// Minimal localStorage mock is provided by jsdom.

import {
  ProgressionManager,
  ALL_CATEGORY_IDS,
  CATEGORY_DISPLAY_NAMES,
} from '../ProgressionManager';

// Helper: get a fresh manager with clean localStorage for each test
function freshManager(): ProgressionManager {
  localStorage.clear();
  // Reset the singleton so each test starts from a clean slate
  (ProgressionManager as any).instance = undefined;
  return ProgressionManager.getInstance();
}

describe('ProgressionManager — initial state', () => {
  it('starts with Resources unlocked at depth 1', () => {
    const pm = freshManager();
    expect(pm.isUnlocked('nav_resources_root')).toBe(true);
    expect(pm.getUnlockedDepth('nav_resources_root')).toBe(1);
  });

  it('starts with all other categories locked', () => {
    const pm = freshManager();
    const locked = ALL_CATEGORY_IDS.filter(id => id !== 'nav_resources_root');
    locked.forEach(id => expect(pm.isUnlocked(id)).toBe(false));
  });

  it('starts with zero quanta', () => {
    const pm = freshManager();
    expect(pm.getQuantaBank()).toBe(0);
  });

  it('starts with zero shifts completed', () => {
    const pm = freshManager();
    expect(pm.getShiftsCompleted()).toBe(0);
  });
});

describe('ProgressionManager — addQuanta / recordShiftComplete', () => {
  it('adds positive quanta to the bank', () => {
    const pm = freshManager();
    pm.addQuanta(40);
    expect(pm.getQuantaBank()).toBe(40);
  });

  it('ignores zero or negative quanta', () => {
    const pm = freshManager();
    pm.addQuanta(0);
    pm.addQuanta(-5);
    expect(pm.getQuantaBank()).toBe(0);
  });

  it('accumulates quanta across multiple calls', () => {
    const pm = freshManager();
    pm.addQuanta(25);
    pm.addQuanta(30);
    expect(pm.getQuantaBank()).toBe(55);
  });

  it('increments shiftsCompleted', () => {
    const pm = freshManager();
    pm.recordShiftComplete();
    pm.recordShiftComplete();
    expect(pm.getShiftsCompleted()).toBe(2);
  });
});

describe('ProgressionManager — canAfford', () => {
  it('returns false when bank is empty', () => {
    const pm = freshManager();
    expect(pm.canAfford(1)).toBe(false);
  });

  it('returns true when bank >= cost', () => {
    const pm = freshManager();
    pm.addQuanta(50);
    expect(pm.canAfford(50)).toBe(true);
    expect(pm.canAfford(51)).toBe(false);
  });
});

describe('ProgressionManager — cost schedule', () => {
  it('getCostToUnlockNew returns Q25 for the first non-Resources unlock', () => {
    const pm = freshManager(); // only Resources unlocked
    expect(pm.getCostToUnlockNew()).toBe(25);
  });

  it('getCostToUnlockNew doubles for each subsequent unlock', () => {
    const pm = freshManager();
    pm.addQuanta(1000);
    pm.purchaseNewCategory('nav_armaments_root'); // cost Q25, now 2 unlocked
    expect(pm.getCostToUnlockNew()).toBe(50);
    pm.purchaseNewCategory('nav_melee_root'); // cost Q50, now 3 unlocked
    expect(pm.getCostToUnlockNew()).toBe(100);
  });

  it('getCostToDeepen returns Q30 * current depth', () => {
    const pm = freshManager();
    expect(pm.getCostToDeepen('nav_resources_root')).toBe(30); // depth 1 → Q30
    pm.addQuanta(30);
    pm.deepenCategory('nav_resources_root'); // depth becomes 2
    expect(pm.getCostToDeepen('nav_resources_root')).toBe(60); // Q30 × 2
  });

  it('getCostToDeepen returns 0 for a locked category', () => {
    const pm = freshManager();
    expect(pm.getCostToDeepen('nav_armaments_root')).toBe(0);
  });
});

describe('ProgressionManager — purchaseNewCategory', () => {
  it('unlocks category and deducts quanta', () => {
    const pm = freshManager();
    pm.addQuanta(25);
    const ok = pm.purchaseNewCategory('nav_armaments_root');
    expect(ok).toBe(true);
    expect(pm.isUnlocked('nav_armaments_root')).toBe(true);
    expect(pm.getQuantaBank()).toBe(0);
  });

  it('appends the new category in unlock order', () => {
    const pm = freshManager();
    pm.addQuanta(200);
    pm.purchaseNewCategory('nav_melee_root');
    pm.purchaseNewCategory('nav_mining_root');
    const ids = pm.getUnlockedCategories().map(c => c.categoryId);
    expect(ids[ids.length - 2]).toBe('nav_melee_root');
    expect(ids[ids.length - 1]).toBe('nav_mining_root');
  });

  it('returns false when category already unlocked', () => {
    const pm = freshManager();
    pm.addQuanta(100);
    expect(pm.purchaseNewCategory('nav_resources_root')).toBe(false);
  });

  it('returns false when cannot afford', () => {
    const pm = freshManager();
    // bank is 0, cost is Q25
    expect(pm.purchaseNewCategory('nav_armaments_root')).toBe(false);
    expect(pm.isUnlocked('nav_armaments_root')).toBe(false);
  });
});

describe('ProgressionManager — deepenCategory', () => {
  it('increments depth by 1 and deducts quanta', () => {
    const pm = freshManager();
    pm.addQuanta(30);
    const ok = pm.deepenCategory('nav_resources_root');
    expect(ok).toBe(true);
    expect(pm.getUnlockedDepth('nav_resources_root')).toBe(2);
    expect(pm.getQuantaBank()).toBe(0);
  });

  it('returns false when cannot afford', () => {
    const pm = freshManager();
    // bank is 0
    expect(pm.deepenCategory('nav_resources_root')).toBe(false);
    expect(pm.getUnlockedDepth('nav_resources_root')).toBe(1);
  });

  it('returns false for a locked category', () => {
    const pm = freshManager();
    pm.addQuanta(100);
    expect(pm.deepenCategory('nav_armaments_root')).toBe(false);
  });

  it('returns false when already at max depth', () => {
    const pm = freshManager();
    pm.addQuanta(10000);
    // Deepen to max (7)
    for (let i = 1; i < 7; i++) pm.deepenCategory('nav_resources_root');
    expect(pm.getUnlockedDepth('nav_resources_root')).toBe(7);
    expect(pm.deepenCategory('nav_resources_root')).toBe(false);
  });
});

describe('ProgressionManager — getAvailableToUnlock', () => {
  it('returns all categories except Resources initially', () => {
    const pm = freshManager();
    const available = pm.getAvailableToUnlock();
    expect(available).not.toContain('nav_resources_root');
    expect(available.length).toBe(ALL_CATEGORY_IDS.length - 1);
  });

  it('removes purchased categories from available list', () => {
    const pm = freshManager();
    pm.addQuanta(100);
    pm.purchaseNewCategory('nav_armaments_root');
    const available = pm.getAvailableToUnlock();
    expect(available).not.toContain('nav_armaments_root');
  });

  it('returns empty array when all categories are unlocked', () => {
    const pm = freshManager();
    pm.addQuanta(1000);
    const toUnlock = ALL_CATEGORY_IDS.filter(id => id !== 'nav_resources_root');
    for (const id of toUnlock) pm.purchaseNewCategory(id);
    expect(pm.getAvailableToUnlock()).toHaveLength(0);
  });
});

describe('ProgressionManager — reset', () => {
  it('restores default state', () => {
    const pm = freshManager();
    pm.addQuanta(500);
    pm.purchaseNewCategory('nav_armaments_root');
    pm.recordShiftComplete();
    pm.reset();
    expect(pm.getQuantaBank()).toBe(0);
    expect(pm.getShiftsCompleted()).toBe(0);
    expect(pm.getUnlockedCategories()).toHaveLength(1);
    expect(pm.isUnlocked('nav_armaments_root')).toBe(false);
  });
});

describe('ProgressionManager — persistence', () => {
  it('persists state to localStorage and restores it', () => {
    const pm = freshManager();
    pm.addQuanta(99);
    pm.recordShiftComplete();

    // Simulate a reload by resetting the singleton and re-creating
    (ProgressionManager as any).instance = undefined;
    const pm2 = ProgressionManager.getInstance();
    expect(pm2.getQuantaBank()).toBe(99);
    expect(pm2.getShiftsCompleted()).toBe(1);
  });
});

describe('ProgressionManager — CATEGORY_DISPLAY_NAMES', () => {
  it('has entries for every ALL_CATEGORY_IDS entry', () => {
    ALL_CATEGORY_IDS.forEach(id => {
      expect(CATEGORY_DISPLAY_NAMES[id]).toBeDefined();
    });
  });

  it('all names are uppercase', () => {
    Object.values(CATEGORY_DISPLAY_NAMES).forEach(name => {
      expect(name).toBe(name.toUpperCase());
    });
  });
});

describe('ProgressionManager — powerup system', () => {
  it('hasPowerup returns false for an unpurchased powerup', () => {
    const pm = freshManager();
    expect(pm.hasPowerup('ORDER_HINTS')).toBe(false);
  });

  it('getPowerupCost returns the catalog cost for a known powerup', () => {
    const pm = freshManager();
    expect(pm.getPowerupCost('ORDER_HINTS')).toBe(50);
  });

  it('getPowerupCost returns 0 for an unknown powerup ID', () => {
    const pm = freshManager();
    expect(pm.getPowerupCost('NONEXISTENT')).toBe(0);
  });

  it('purchasePowerup returns false when player cannot afford it', () => {
    const pm = freshManager();
    // quantaBank starts at 0; ORDER_HINTS costs Q50
    expect(pm.purchasePowerup('ORDER_HINTS')).toBe(false);
    expect(pm.hasPowerup('ORDER_HINTS')).toBe(false);
  });

  it('purchasePowerup succeeds and deducts cost when player can afford it', () => {
    const pm = freshManager();
    pm.addQuanta(100);
    expect(pm.purchasePowerup('ORDER_HINTS')).toBe(true);
    expect(pm.hasPowerup('ORDER_HINTS')).toBe(true);
    expect(pm.getQuantaBank()).toBe(50); // 100 - 50
  });

  it('purchasePowerup returns false if already owned (no double-purchase)', () => {
    const pm = freshManager();
    pm.addQuanta(200);
    pm.purchasePowerup('ORDER_HINTS');
    const secondPurchase = pm.purchasePowerup('ORDER_HINTS');
    expect(secondPurchase).toBe(false);
    expect(pm.getQuantaBank()).toBe(150); // only deducted once
  });

  it('purchased powerups persist across save/reload', () => {
    const pm = freshManager();
    pm.addQuanta(100);
    pm.purchasePowerup('ORDER_HINTS');

    (ProgressionManager as any).instance = undefined;
    const pm2 = ProgressionManager.getInstance();
    expect(pm2.hasPowerup('ORDER_HINTS')).toBe(true);
  });

  it('backward-compat: loads saved state missing purchasedPowerups without error', () => {
    // Simulate a save file created before the powerup system existed
    const legacy = JSON.stringify({
      unlockedCategories: [{ categoryId: 'nav_resources_root', depth: 1 }],
      quantaBank: 42,
      shiftsCompleted: 3,
      // purchasedPowerups intentionally absent
    });
    localStorage.setItem('clicker-shipper-progression', legacy);
    (ProgressionManager as any).instance = undefined;
    const pm = ProgressionManager.getInstance();
    expect(pm.getQuantaBank()).toBe(42);
    expect(pm.hasPowerup('ORDER_HINTS')).toBe(false);
  });
});
