import { MenuItem } from '../types/GameTypes';

/**
 * Manages hierarchical navigation through menu items
 * Maintains a stack of item levels, supporting unlimited nesting depth
 */
export class NavigationController {
  private navigationStack: MenuItem[][] = [];
  private currentItems: MenuItem[] = [];

  /**
   * Creates a NavigationController with root items
   * @param rootItems The top-level items to start navigation from
   */
  constructor(rootItems: MenuItem[]) {
    this.navigationStack.push(rootItems);
    this.currentItems = rootItems;
  }

  /**
   * Drill down into a menu item's children
   * @param parentItem The item to drill into
   * @returns The children items, or empty array if item has no children
   */
  drillDown(parentItem: MenuItem): MenuItem[] {
    if (parentItem.children && parentItem.children.length > 0) {
      this.navigationStack.push(parentItem.children);
      this.currentItems = parentItem.children;
      return this.currentItems;
    }
    return [];
  }

  /**
   * Go back up one navigation level
   * @returns The items at the parent level, or null if already at root
   */
  goBack(): MenuItem[] | null {
    if (this.navigationStack.length > 1) {
      this.navigationStack.pop();
      this.currentItems = this.navigationStack[this.navigationStack.length - 1];
      return this.currentItems;
    }
    return null;
  }

  /**
   * Get the currently displayed items on the dial
   * @returns Array of menu items at current depth
   */
  getCurrentItems(): MenuItem[] {
    return this.currentItems;
  }

  /**
   * Check if an item is navigable (has children)
   * @param item The item to check
   * @returns true if item has children, false if it's a leaf item
   */
  isNavigable(item: MenuItem): boolean {
    return item.children !== undefined && item.children.length > 0;
  }

  /**
   * Get the current depth in the navigation hierarchy
   * @returns 0 for root level, 1 for first nested level, etc.
   */
  getDepth(): number {
    return this.navigationStack.length - 1;
  }

  /**
   * Check if we can go back (not at root)
   * @returns true if not at root level
   */
  canGoBack(): boolean {
    return this.navigationStack.length > 1;
  }

  /**
   * Reset navigation to root level
   * @returns The root items
   */
  reset(): MenuItem[] {
    this.navigationStack = [this.navigationStack[0]];
    this.currentItems = this.navigationStack[0];
    return this.currentItems;
  }

  /**
   * Get the full navigation path as item IDs
   * Useful for analytics, breadcrumbs, or deep linking
   * @returns Array of item IDs from root to current level
   */
  getPath(): string[] {
    const path: string[] = [];

    for (let i = 0; i < this.navigationStack.length - 1; i++) {
      const currentLevel = this.navigationStack[i];
      const nextLevel = this.navigationStack[i + 1];

      // Find which item in the current level leads to the next level
      const parentItem = currentLevel.find(item =>
        item.children === nextLevel
      );

      if (parentItem) {
        path.push(parentItem.id);
      }
    }

    return path;
  }

  /**
   * Calculate scale factor based on depth
   * Keep icons consistent size across depths
   * @returns Scale multiplier for rendering at current depth
   */
  getScaleForDepth(): number {
    return 1.4;
  }
}
