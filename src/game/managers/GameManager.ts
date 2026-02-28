import { GameConfig, Item, MenuItem } from '../types/GameTypes';
import { RadDialConfig, ActionNode } from '../types/RadDialTypes';
import { paginateWithConfig } from '../utils/ItemAdapter';
import { SettingsManager } from './SettingsManager';

/**
 * Per-action item store: the flat raw items plus the paginated nav tree.
 */
export interface ModeItemStore {
  actionId: string;
  /** Flat list of leaf items loaded from the mode's items.json */
  flat: MenuItem[];
  /** Paginated nav tree derived from flat, ready for StandardNavFace */
  navTree: MenuItem[];
}

export class GameManager {
  private static instance: GameManager;
  private config: GameConfig | null = null;
  /** Legacy flat Item[] — kept for backward compat with OrderUtils etc. */
  private items: Item[] = [];
  /** Per-mode item stores keyed by action id */
  private modeStores: Map<string, ModeItemStore> = new Map();

  private constructor() {}

  static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager();
    }
    return GameManager.instance;
  }

  async initialize(scene: Phaser.Scene, configPath: string): Promise<void> {
    // config.json is queued in Preloader.preload() — read from cache directly.
    const configKey = configPath.split('/').pop()!.replace('.json', '');
    this.config     = scene.cache.json.get(configKey) as GameConfig;

    // Load per-mode item files that were queued by Preloader using each
    // action's id as the cache key.
    const radDial = scene.cache.json.get('rad-dial') as RadDialConfig | null;
    if (radDial?.actions) {
      this.buildModeStores(radDial.actions, scene);
    }
  }

  private buildModeStores(actions: ActionNode[], scene: Phaser.Scene): void {
    this.modeStores.clear();
    const leftHanded   = SettingsManager.getInstance().getHandedness() === 'left';
    const navDownIndex = leftHanded ? 4 : 1;
    for (const action of actions) {
      if (!action.itemsFile) continue;
      const raw = scene.cache.json.get(action.id) as MenuItem[] | null;
      if (!raw) continue;
      const flat    = Array.isArray(raw) ? raw : [];
      const navTree = paginateWithConfig(flat, this.config, navDownIndex);
      this.modeStores.set(action.id, { actionId: action.id, flat, navTree });
    }
  }

  getConfig(): GameConfig {
    if (!this.config) {
      throw new Error('GameManager not initialized. Call initialize() first.');
    }
    return this.config;
  }

  /** @deprecated Use getModeStore() for action-specific items. */
  getItems(): Item[] {
    return this.items;
  }

  getModeStore(actionId: string): ModeItemStore | undefined {
    return this.modeStores.get(actionId);
  }

  getAllModeStores(): ModeItemStore[] {
    return Array.from(this.modeStores.values());
  }

  getShiftDuration(): number {
    return this.getConfig().shiftDuration;
  }
}