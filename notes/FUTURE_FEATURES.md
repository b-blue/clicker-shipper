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

### Achievement System
Reward players with achievements for reaching fulfillment milestones and completing special challenges.

**Design considerations:**
- Track player progress across shifts (persistent data)
- Display achievement notifications when unlocked
- Provide visual indicators for locked/unlocked achievements
- Achievement categories: Order milestones, Speed records, Accuracy, Special challenges

**Milestone achievements:**
- **First Order**: "Getting Started" - Fulfill your first order
- **Decade**: "Ten Down" - Fulfill 10 orders
- **Half Century**: "Halfway There" - Fulfill 50 orders
- **Century**: "Order Centurion" - Fulfill 100 orders
- **Grand Master**: "Logistics Legend" - Fulfill 1,000 orders

**Additional achievement ideas:**
- Speed-based: "Lightning Fast" - Fulfill 5 orders in under 60 seconds
- Accuracy-based: "Perfect Shift" - Complete a shift with 100% accuracy
- Combo-based: "On a Roll" - Fulfill 10 orders in a row without mistakes
- Component-specific: "Specialist" - Fulfill 20 orders using only items from one category

**Technical requirements:**
- Achievement tracking system with localStorage persistence
- Achievement definition structure (id, name, description, icon, unlock condition)
- Progress tracking for incremental achievements
- Toast/modal notification system for achievement unlocks
- Achievement gallery/collection view accessible from main menu
- Sound effects and visual flourishes for unlock moments

---

## UI/UX Improvements

### Differentiated Radial Dial Interactions
Simplify navigation by using different interaction patterns for categories vs. selectable items, with device-appropriate controls.

**Current behavior:**
- All items (categories and selectable items) require drag-to-center on all devices
- Uniform interaction model across Level 0 (categories) and Level 1 (items)

**Proposed behavior:**

| Item Type | Level | Desktop | Mobile |
|-----------|-------|---------|--------|
| Categories | 0 | Simple click | Simple tap |
| Selectable Items | 1 | Simple click | Drag-to-center |

**Design rationale:**
- Categories are navigation actions, not selections → should use simpler interaction
- Desktop users have precise mouse control → don't need drag confirmation
- Mobile users benefit from drag-to-center on final selections → prevents accidental taps
- Distinct item graphics will reinforce which items are categories vs. selectable

**Implementation approach:**
1. **Device detection:** Use viewport width threshold (600px) to determine mobile vs. desktop mode
2. **Event handler refactoring:**
   - Level 0: Always use simple click/tap for all devices
   - Level 1 Desktop: Click on slice → immediate confirmation
   - Level 1 Mobile: Keep drag-to-center logic with `minDragDistance` validation
3. **Visual feedback updates:**
   - Level 0: Remove center drop cue, keep slice highlighting
   - Level 1 Desktop: Remove drag visualization
   - Level 1 Mobile: Keep yellow ring + center glow feedback
4. **Settings integration:**
   ```json
   {
     "input": {
       "mobileBreakpoint": 600,
       "forceMobileMode": false
     }
   }
   ```

**Technical considerations:**
- Add `isMobile: boolean` property based on viewport width
- Branch `handlePointerUp` logic by level and device type
- Simplify `showDropCue` conditions (false for Level 0 and desktop Level 1)
- Maintain `dragStartSliceIndex`, `lastNonCenterSliceIndex` for mobile Level 1
- Update unit tests for new interaction paths
- Manual testing needed for touch-enabled laptops and tablets

**Benefits:**
- ✅ Faster navigation on desktop
- ✅ Clearer interaction model with visual reinforcement
- ✅ Less accidental selections on mobile at final selection stage
- ✅ Maintains familiar patterns (tap for navigation, drag-to-confirm for commitment)

**Trade-offs:**
- ⚠️ Viewport width detection isn't perfect (touch-enabled laptops)
- ⚠️ Need to maintain two interaction code paths
- ⚠️ Consider adding first-use tutorial/hints

---

