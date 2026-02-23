export interface ImageLayer {
  texture: string;
  depth?: number;
  tint?: number;
  alpha?: number;
  scale?: number;
}

// Hierarchical menu item (new unified type)
export interface MenuItem {
  id: string;
  name: string;
  icon: string;
  type?: string;
  cost?: number;
  description?: string;
  layers?: ImageLayer[];
  children?: MenuItem[];
}

// Legacy types (kept for backward compatibility)
export interface SubItem {
  id: string;
  name: string;
  icon: string;
  type?: string;
  cost: number;
  description?: string;
  layers?: ImageLayer[];
}

export interface Item {
  id: string;
  name: string;
  icon: string;
  type?: string;
  description?: string;
  subItems: SubItem[];
  layers?: ImageLayer[];
}

export interface ItemsData {
  items: Item[];
}

// New hierarchical data format
export interface MenuItemsData {
  items: MenuItem[];
}

export interface GameConfig {
  shiftDuration: number;
  dialLevels: number;
  itemsPerLevel: number;
  rootDialIconPath?: string;
}

export interface OrderRequirement {
  itemId: string;
  itemName: string;
  iconKey: string;
  quantity: number;
  cost: number;
}

export interface Order {
  id: string;
  budget: number;
  requirements: OrderRequirement[];
}