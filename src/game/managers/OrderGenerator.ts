import { GameManager } from './GameManager';

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

export class OrderGenerator {
  private gameManager: GameManager;
  private orderCount: number = 0;

  constructor() {
    this.gameManager = GameManager.getInstance();
  }

  generateOrder(): Order {
    this.orderCount++;
    const orderId = `order_${this.orderCount}`;
    
    // Step 1: Generate random budget ($30-$80, slightly generous)
    const budget = this.randomBudget();
    
    // Step 2: Build order requirements within budget
    const requirements = this.buildRequirements(budget);
    
    return {
      id: orderId,
      budget: budget,
      requirements: requirements
    };
  }

  private randomBudget(): number {
    // Random between $30-$80
    return Math.floor(Math.random() * 51) + 30;
  }

  private buildRequirements(budget: number): OrderRequirement[] {
    const allSubItems = this.getAllSubItems();
    const requirements: OrderRequirement[] = [];
    let remainingBudget = budget;
    let itemCount = Math.floor(Math.random() * 5) + 1; // 1-5 items per order
    let attempts = 0;
    const maxAttempts = 100;

    while (requirements.length < itemCount && attempts < maxAttempts) {
      attempts++;
      
      // Pick a random sub-item
      const randomIndex = Math.floor(Math.random() * allSubItems.length);
      const subItem = allSubItems[randomIndex];
      
      // Check for duplicates (5% chance to allow)
      const isDuplicate = requirements.some(r => r.itemId === subItem.id);
      if (isDuplicate && Math.random() > 0.05) {
        continue;
      }

      // Determine quantity based on cost vs remaining budget
      const maxQuantity = Math.floor(remainingBudget / subItem.cost);
      if (maxQuantity < 1) {
        continue;
      }

      const quantity = Math.floor(Math.random() * Math.min(5, maxQuantity)) + 1;
      const totalCost = quantity * subItem.cost;

      if (totalCost <= remainingBudget) {
        requirements.push({
          itemId: subItem.id,
          itemName: subItem.name,
          quantity: quantity
        });
        remainingBudget -= totalCost;
      }
    }

    // If we couldn't generate enough items, try again with a fresh budget
    if (requirements.length === 0) {
      return this.buildRequirements(this.randomBudget());
    }

    return requirements;
  }

  private getAllSubItems(): Array<{ id: string; name: string; cost: number }> {
    const items = this.gameManager.getItems();
    const allLeafItems: Array<{ id: string; name: string; cost: number }> = [];

    // Handle both legacy Item[] and hierarchical MenuItem[] formats
    const collectLeafItems = (items: any[]) => {
      items.forEach(item => {
        // Check if this is a legacy Item with subItems
        if ('subItems' in item && item.subItems) {
          item.subItems.forEach((subItem: any) => {
            if (subItem.cost !== undefined) {
              allLeafItems.push({
                id: subItem.id,
                name: subItem.name,
                cost: subItem.cost
              });
            }
          });
        }
        // Check if this is a MenuItem with children
        else if ('children' in item && item.children && item.children.length > 0) {
          // Recursively collect from children
          collectLeafItems(item.children);
        }
        // This is a leaf item (has cost, no children)
        else if (item.cost !== undefined) {
          allLeafItems.push({
            id: item.id,
            name: item.name,
            cost: item.cost
          });
        }
      });
    };

    collectLeafItems(items);
    return allLeafItems;
  }
}