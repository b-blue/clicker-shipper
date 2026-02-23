import { ProgressionState, UnlockedCategory } from '../types/GameTypes';

const STORAGE_KEY = 'clicker-shipper-progression';

// All 6 possible A-level categories. Resources is always slot 0 (first unlocked by default).
export const ALL_CATEGORY_IDS: string[] = [
  'nav_resources_root',
  'nav_armaments_root',
  'nav_melee_root',
  'nav_radioactive_root',
  'nav_mining_root',
  'nav_streetwear_root',
];

// Human-readable display names (uppercase for bitmap font)
export const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  'nav_resources_root':   'RESOURCES',
  'nav_armaments_root':   'ARMAMENTS',
  'nav_melee_root':       'MELEE',
  'nav_radioactive_root': 'RADIOACTIVE',
  'nav_mining_root':      'MINING',
  'nav_streetwear_root':  'STREETWEAR',
};

// Maximum depth accessible per category (items.json has 7 nav_down levels per category)
const MAX_UNLOCK_DEPTH = 7;

const DEFAULT_STATE: ProgressionState = {
  unlockedCategories: [{ categoryId: 'nav_resources_root', depth: 1 }],
  quantaBank: 0,
  shiftsCompleted: 0,
};

export class ProgressionManager {
  private static instance: ProgressionManager;
  private state: ProgressionState;

  private constructor() {
    this.state = this.load();
  }

  static getInstance(): ProgressionManager {
    if (!ProgressionManager.instance) {
      ProgressionManager.instance = new ProgressionManager();
    }
    return ProgressionManager.instance;
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  private load(): ProgressionState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as ProgressionState;
      }
    } catch {
      // fall through to default
    }
    return this.deepCopyDefault();
  }

  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn('ProgressionManager: failed to save to localStorage', e);
    }
  }

  reset(): void {
    ProgressionManager.instance = new ProgressionManager();
    ProgressionManager.instance.state = this.deepCopyDefault();
    ProgressionManager.instance.save();
    // Reassign the singleton to the freshly-reset instance
    this.state = ProgressionManager.instance.state;
  }

  private deepCopyDefault(): ProgressionState {
    // JSON round-trip ensures a true deep copy (no shared references with DEFAULT_STATE)
    return JSON.parse(JSON.stringify(DEFAULT_STATE)) as ProgressionState;
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  getQuantaBank(): number {
    return this.state.quantaBank;
  }

  getUnlockedCategories(): UnlockedCategory[] {
    return this.state.unlockedCategories;
  }

  /** Returns the maximum dial depth accessible for a category, or 0 if not unlocked. */
  getUnlockedDepth(categoryId: string): number {
    const entry = this.state.unlockedCategories.find(c => c.categoryId === categoryId);
    return entry ? entry.depth : 0;
  }

  isUnlocked(categoryId: string): boolean {
    return this.getUnlockedDepth(categoryId) > 0;
  }

  getShiftsCompleted(): number {
    return this.state.shiftsCompleted;
  }

  /** Category IDs from ALL_CATEGORY_IDS not yet present in unlockedCategories. */
  getAvailableToUnlock(): string[] {
    const unlockedIds = new Set(this.state.unlockedCategories.map(c => c.categoryId));
    return ALL_CATEGORY_IDS.filter(id => !unlockedIds.has(id));
  }

  canAfford(cost: number): boolean {
    return this.state.quantaBank >= cost;
  }

  // ── Cost schedule ──────────────────────────────────────────────────────────

  /**
   * Cost to unlock the next new category.
   * N = number of non-Resources categories already unlocked.
   * Cost = Q25 × 2^N  (1st unlock: Q25, 2nd: Q50, 3rd: Q100, …)
   */
  getCostToUnlockNew(): number {
    const n = this.state.unlockedCategories.length - 1; // subtract Resources
    return Math.round(25 * Math.pow(2, n));
  }

  /**
   * Cost to deepen a specific category from its current depth N to N+1.
   * Cost = Q30 × current depth  (L1→L2: Q30, L2→L3: Q60, L3→L4: Q90, …)
   */
  getCostToDeepen(categoryId: string): number {
    const depth = this.getUnlockedDepth(categoryId);
    return depth > 0 ? 30 * depth : 0;
  }

  canDeepen(categoryId: string): boolean {
    const depth = this.getUnlockedDepth(categoryId);
    return depth > 0 && depth < MAX_UNLOCK_DEPTH;
  }

  // ── Writes ─────────────────────────────────────────────────────────────────

  addQuanta(amount: number): void {
    if (amount <= 0) return;
    this.state.quantaBank += amount;
    this.save();
  }

  recordShiftComplete(): void {
    this.state.shiftsCompleted += 1;
    this.save();
  }

  /**
   * Unlock a new category. Appends it to the end of unlockedCategories
   * (preserving player-chosen slot order). Deducts cost from quantaBank.
   * Returns false if the player can't afford it or it's already unlocked.
   */
  purchaseNewCategory(categoryId: string): boolean {
    if (this.isUnlocked(categoryId)) return false;
    const cost = this.getCostToUnlockNew();
    if (!this.canAfford(cost)) return false;
    this.state.quantaBank -= cost;
    this.state.unlockedCategories.push({ categoryId, depth: 1 });
    this.save();
    return true;
  }

  /**
   * Deepen an already-unlocked category by one level.
   * Deducts cost from quantaBank.
   * Returns false if the player can't afford it or the category is already at max depth.
   */
  deepenCategory(categoryId: string): boolean {
    if (!this.canDeepen(categoryId)) return false;
    const cost = this.getCostToDeepen(categoryId);
    if (!this.canAfford(cost)) return false;
    const entry = this.state.unlockedCategories.find(c => c.categoryId === categoryId)!;
    this.state.quantaBank -= cost;
    entry.depth += 1;
    this.save();
    return true;
  }
}
