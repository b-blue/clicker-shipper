export interface SubItem {
  id: string;
  name: string;
  icon: string;
  cost: number;
}

export interface Item {
  id: string;
  name: string;
  icon: string;
  subItems: SubItem[];
}

export interface ItemsData {
  items: Item[];
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
  quantity: number;
}

export interface Order {
  id: string;
  budget: number;
  requirements: OrderRequirement[];
}