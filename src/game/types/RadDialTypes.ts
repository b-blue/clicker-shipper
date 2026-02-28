import { ImageLayer } from './GameTypes';

/** The six drone-repair action types the player can perform. */
export type TerminalMode =
  | 'reorient'
  | 'replace'
  | 'rewire'
  | 'rebuild'
  | 'refuel'
  | 'recharge';

/**
 * A single action node from rad-dial.json.
 * Enabled actions become navigable slices on the top-level rad-dial.
 * Disabled actions render as locked placeholder slices.
 */
export interface ActionNode {
  id: string;
  name: string;
  icon: string;
  terminalMode: TerminalMode;
  enabled: boolean;
  /**
   * Path (relative to the public root) of a flat JSON array of leaf items
   * for this mode.  e.g. "data/modes/reorient/items.json".
   * The array is paginated into a nav tree at runtime by paginateItems().
   */
  itemsFile?: string;
  layers?: ImageLayer[];
}

/** Root shape of rad-dial.json. */
export interface RadDialConfig {
  actions: ActionNode[];
}
