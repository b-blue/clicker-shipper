# Future Features

## Gameplay Enhancements

### Component Combination System
Some orders should require the player to combine base components into composite items that are not present on the dials. This would add crafting/assembly complexity to the game.

**Design considerations:**
- Players would need to select multiple base items from the dial
- A separate UI or gesture system would handle combining items
- Combined items could have higher point values or unlock special achievements
- Orders could specify either base components OR composite items
- Example: Combine "Bread" + "Lettuce" + "Tomato" → "Sandwich" (not on dial)

**Technical requirements:**
- New item type: CompositeItem with recipe definitions
- Recipe validation system
- Inventory/staging area for holding items before combination
- Visual feedback for valid/invalid combinations
- Update OrderGenerator to include composite items in orders

---

