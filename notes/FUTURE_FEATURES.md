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

### Tap-Based Dial Control Scheme (Alternative)
Keep the radial dial layout but replace drag-to-center confirmation with direct tapping of slices, eliminating the drag gesture entirely.

**Design considerations:**
- Tapping a slice at Level 0 (category) navigates into it — same as current
- Tapping a slice at Level 1 (item) immediately confirms the selection with no drag required
- The center disc tap (go back) remains unchanged
- Terminal action dial (send/recall/skill-up) uses the same tap model

**Benefits:**
- ✅ Faster workflow — no dragging required
- ✅ Works well on small screens where drag distance is short
- ✅ Simpler code path, single interaction model on all devices
- ✅ Accessible to users who have difficulty with drag gestures

**Trade-offs:**
- ⚠️ Easy to accidentally confirm an item with a stray tap
- ⚠️ Removes intentional "commitment" gesture from the UX
- ⚠️ Less satisfying haptic/visual confirmation arc

**Implementation approach:**
1. Add `inputMode: 'drag' | 'tap'` to game settings (toggle in DialCalibration scene)
2. In `RadialDial.handlePointerUp`: if `inputMode === 'tap'` and pointer is over a non-center slice, emit `dial:itemConfirmed` immediately without checking drag distance
3. Suppress `showDropCue` and center-glow feedback when in tap mode
4. Visual affordance on each slice (e.g. subtle pulsing border) to reinforce direct-tap interaction

**Settings integration:**
```json
{
  "input": {
    "dialInputMode": "drag"
  }
}
```

---

### Context-Sensitive Item Catalog
The catalog panel should adapt its contents based on which dial level is active when the player opens it.

**Behavior:**
- When the player opens the catalog tab while the dial is at the **A-level** (root), the full catalog of all unlocked items is shown as a single scrollable list (current behavior).
- When the dial is at the **B-level** for a specific item type (e.g. the player has tapped the "Resources" icon and is viewing the resource sub-items), a new contextual **quick-catalog button** appears at the upper-right vertex of the dial square (see Dial Corner Buttons feature). Tapping this button opens the catalog panel filtered to show only items of that item type.
- Selecting the **Catalog tab** from the central panel always shows the full unlocked catalog regardless of dial state; only the corner shortcut applies the type filter.

**Design considerations:**
- Filter state is transient — switching away from the B-level dial or tapping the full Catalog tab clears the filter.
- A visible label or pill above the filtered list indicates which type is active (e.g. "RESOURCES").
- The filtered view uses the same scrollable row layout as the full catalog.

**Technical requirements:**
- Track the current navigation depth and the active category item in `RadialDial` / `Game` scene.
- Pass the active category context to `buildCatalogContent` when triggered from the corner button.
- `buildCatalogContent` accepts an optional `filterCategory` parameter; when set, only rows for that category are rendered.
- The corner button is conditionally created/destroyed as `dial:levelChanged` and `dial:goBack` events fire.

---

### Progressive Unlock System
New players should be eased into the game by starting with a minimal item set and expanding it over time through earned bonus quanta.

#### Starting state
- Only the **Resources** icon is visible on the A-level dial. All other category slots are hidden (or rendered grayed-out as locked indicators).
- Orders are generated exclusively from items visible on the **B-level dial face for Resources** — i.e. the immediate sub-items of the Resources category.
- This keeps the initial learning surface small: players familiarise themselves with a handful of item names and icons before new types are introduced.

#### Unlock progression
After a shift ends, any accumulated **bonus quanta** (from correctly-positioned items) can be spent to unlock one of two advancement options presented to the player:

| Option | Effect | Unlock condition |
|--------|--------|-----------------|
| **Deepen existing type** (e.g. "Resource Systems L2") | In future shifts the C-level dial face for the unlocked type becomes accessible, exposing additional items of that type | Player has used the type for at least one shift |
| **Unlock new item type** (next clockwise on A-level dial) | The next category icon appears on the A-level dial; its B-level items become eligible in future orders | Player has completed at least one full shift |

Both options expand the pool of items eligible for order generation. The upgrade choice is presented on the **Game Over / Shift End** screen before returning to the main menu.

#### Unlock persistence
- Unlock state is stored in `settings.json` alongside dial settings (new `progression` key).
- `OrderGenerator` reads the current unlock state to constrain which items may appear in orders.
- `NavigationController` consults unlock state to hide/lock category icons that have not yet been unlocked.

#### Catalog visibility
- The item catalog defaults to showing **only unlocked items**. A locked-item row (greyed out, padlock icon) may appear to hint at what can be earned, but shows no cost or detail.
- When the player eventually reaches the full unlock state the catalog reverts to the standard view.

**Technical requirements:**
- New `ProgressionManager` (or extend `SettingsManager`) to store and expose unlock state.
- `OrderGenerator` updated to filter the item pool by progression state.
- `Game` scene: show/hide category slots based on unlock state on `NavigationController` setup.
- `GameOver` / shift-end screen: display earned bonus, present two unlock options, persist choice.
- `buildCatalogContent`: filter rows by unlock state; render placeholder rows for locked items.

---

### Dial Corner Buttons
Two small contextual buttons occupy the upper-right and lower-right vertices of the imaginary square that bounds the dial circle. These provide at-a-glance state information and quick actions without cluttering the main dial or central panel.

#### Lower-right corner — Dial Level Indicator (always visible)
A compact badge shows:
- The **icon** of the currently active category (or the default center icon at A-level).
- A **level letter** ("A", "B", "C", …) indicating the current navigation depth.

Examples:
- At A-level (root): default `skill-diagram` icon + label **A**
- After tapping Resources at B-level: Resources category icon + label **B**

This gives a persistent orientation cue so players always know where they are in the hierarchy.

#### Upper-right corner — Quick Catalog (conditional)
Appears **only** when the player is at a B-level dial face for a specific item type (depth = 1, non-terminal). Tapping it opens the catalog panel pre-filtered to show only items of the active type (see Context-Sensitive Item Catalog above).

The button is hidden at A-level, in terminal mode, and at C-level or deeper.

**Technical requirements:**
- Corner button positions are derived from `dialX + dialRadius + margin` and `dialY ± dialRadius + margin` — update dynamically if `dialRadius` is adjusted in DialCalibration.
- Buttons are created as small `Graphics` + `Image` Phaser objects managed by the `Game` scene, updated on `dial:levelChanged` and `dial:goBack` events.
- Lower-right badge redraws on every level change.
- Upper-right button visibility toggled on level change events; tapping it calls the filtered catalog path described above.

---

### New Player Tutorial System
First-time players should be guided through core game concepts via contextual overlays that appear at the right moment and can be dismissed without interrupting play.

**Trigger moments:**
1. **First launch** — brief overlay introduces the dial, the central panel, and the order list.
2. **First item selection** — tooltip points to the terminal action dial and labels SEND / RECALL.
3. **First completed order** — highlight the REV and BONUS counters; explain bonus quanta.
4. **First dial level reached** — explain the center-tap go-back gesture.
5. **First unlock opportunity** (shift end) — explain the unlock choice presented on the end screen.

**Design:**
- Each tutorial step is a semi-transparent overlay panel with a short uppercase bitmap-font message and an arrow or highlight ring pointing at the relevant UI element.
- A single "GOT IT" dismiss button advances or closes the overlay.
- Steps are shown once per install (progress stored in `settings.json` under `tutorial.completedSteps[]`).
- Players can re-enable the tutorial from the Settings tab.
- Tutorial overlays sit at a high Phaser depth so they appear above all game UI but can be layered below a future pause menu.

**Technical requirements:**
- New `TutorialManager` class (non-Phaser, plain TS) that holds step definitions and tracks completion state via `SettingsManager`.
- `Game` scene emits named tutorial trigger events (e.g. `tutorial:itemSelected`); `TutorialManager` subscribes and decides whether to show the relevant step.
- Overlay rendering done in a dedicated `TutorialOverlay` Phaser `Container` created on demand and destroyed on dismiss.
- All tutorial text must be uppercase and compatible with the `clicker` bitmap font.

---
