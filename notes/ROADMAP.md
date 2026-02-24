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

### Shift Timer Component Extraction
The existing shift countdown timer should be extracted from the `Game` scene into a standalone, reusable `ShiftTimer` component.

**Motivation:**
- The timer logic is currently embedded directly in the `Game` scene, making it difficult to reuse.
- Certain progression items (e.g. upgrade effects, bonus quanta time extensions) will need to reference, pause, or visually reflect the timer independently.
- A self-contained component simplifies testing and future re-skinning.

**Design considerations:**
- `ShiftTimer` encapsulates its own countdown state: `totalDuration`, `remainingMs`, `isPaused`.
- It emits events (`timer:tick`, `timer:expired`) that the `Game` scene and other systems subscribe to.
- The visual representation (bar, arc, or numeric readout) is a separate rendering concern; `ShiftTimer` provides data only, leaving display to a companion `ShiftTimerDisplay` UI class.
- `ShiftTimerDisplay` can be instantiated multiple times targeting the same `ShiftTimer` instance — one for the in-game HUD bar, one as a compact readout on a progression panel.

**Technical requirements:**
- New `ShiftTimer.ts` in `src/game/managers/` (or `src/game/timers/`).
- Exposes `start()`, `pause()`, `resume()`, `reset(duration)`, `getRemainingMs()`, `getProgress()` (0–1).
- Uses Phaser scene `update` delta time rather than `setInterval` to stay frame-accurate.
- `Game` scene delegates all timer logic to `ShiftTimer`; existing HUD display wired to `timer:tick`.
- Unit tests cover `start`, `pause/resume`, `expiry`, and `reset` paths.

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

### In-Panel End Shift Flow
Rather than transitioning the player to a separate `EndShift` Phaser scene when a shift ends, the end-of-shift summary and unlock choices should appear inline within the central display panel.

**Motivation:**
- A full scene transition introduces a visible flash/reload and breaks the sense of a continuous game world.
- The central panel already has an established aesthetic and layout container; reusing it keeps the UI coherent.
- The dial and HUD remain visible and static during the summary, providing a natural idle visual frame.

**Proposed behavior:**
1. When the shift timer expires, a new `END_SHIFT` tab state is activated on the central panel (entered programmatically — no visible tab button added).
2. The panel fades to a summary view: total orders fulfilled, REV earned, bonus quanta accumulated, streak and accuracy stats.
3. Below the stats, two unlock option cards are presented (see Progressive Unlock System). The player taps one to confirm.
4. The panel transitions back to the `ORDERS` tab and the next shift begins with newly unlocked items live.

**Design considerations:**
- `buildEndShiftContent(container)` mirrors the structure of `buildOrderContent` and `buildCatalogContent`.
- No scrolling needed; all summary content must fit within the fixed panel height.
- The existing `EndShift` scene class is retained for standalone testing / deep-link access but is no longer the runtime path.
- Transition uses the existing clear-and-rebuild pattern; a short alpha tween masks the redraw.

**Technical requirements:**
- Add `END_SHIFT` to the panel tab state enum in `Game.ts`.
- Implement `buildEndShiftContent(container)` following the same signature as other content builders.
- `ShiftTimer` (see Shift Timer Component Extraction) emits `timer:expired`; `Game` listens and calls `switchToEndShiftTab()`.
- Unlock selection persists via `ProgressionManager`, then `startNextShift()` resets the panel to `ORDERS`.
- Unit tests cover `buildEndShiftContent` rendering and the state transition path.

---

### Dial Level Naming Convention Correction
The current scheme assigns **A** to the root category-navigation face and **B** to the first item-level face for a type. This should be revised so letter designations begin at **A for the first substantive dial face of each type**, treating the root navigation layer as an un-lettered navigation layer.

**Revised convention:**

| Layer | Old label | New label | Description |
|-------|-----------|-----------|-------------|
| Root category navigation | A | *(nav)* | Navigation layer — no letter designation |
| First item face for a type | B | A | Initial items accessible within a category |
| Second item face for a type | C | B | Deeper items unlocked by progression |
| Third item face for a type | D | C | Further items, etc. |

**Affected systems:**
- `DialCornerHUD` level badge: renders no letter at root, `A` at depth 1, `B` at depth 2, and so on.
- `NavigationController` depth values are unchanged; only the display label mapping updates.
- All notes referring to "B-level dial face" should be understood as "A-level dial face" going forward.
- `DialCalibration` scene instructions, if they cite a level letter.

**Implementation:**
- Add `depthToLevelLabel(depth: number): string` in `UiUtils.ts` mapping `0` to `''`, `1` to `'A'`, `2` to `'B'`, etc.
- Replace any direct depth-to-letter arithmetic with this helper.
- Update unit tests that assert specific level-label strings.

---

## Order Fulfillment Overhaul

The current per-item-click model requires too many interactions for orders with repeated item types. The redesign below consolidates repeated items into quantity-bearing slots and introduces new dial face modes for quantity selection and recipe crafting.

---

### Order Row Slot Model
Each order row displays one slot per **distinct item type** required by the order, rather than one slot per individual item. Quantity is encoded as a badge on each slot.

**Slot layout:**
- A slot is the same size as an existing item icon cell.
- When required quantity is greater than 1, a small badge at the bottom-right corner (matching the dial level indicator style) shows the remaining count.
- A quantity-1 slot has no badge.
- As items are fulfilled, the badge counts down (3 → 2 → 1), then the slot marks complete.

**Capacity constraints:**
- Maximum distinct item types per order: up to the number of unlocked items (e.g. five in the first shift).
- Maximum quantity per type: 3.
- A first-shift order can therefore show at most five slots of three items each (fifteen total), though the existing `generateOrder` hard cap of seven total items remains in force until the slot model is fully integrated.

**Technical requirements:**
- `OrderRequirement` gains a `quantity: number` field (1–3) and a `fulfilled: number` counter.
- `buildFulfillmentBoxRow` renders one cell per requirement entry rather than iterating by quantity.
- Quantity badge rendering reuses the `BitmapText` plus background circle from `DialCornerHUD`.
- `checkOrderComplete` checks `requirement.fulfilled >= requirement.quantity` per entry.
- `onSendItem` increments `requirement.fulfilled` for the matching type and triggers a partial-fill redraw rather than a full row rebuild.

---

### Dial Face: Quantity Selector Mode
When the player navigates the dial to an item required at a quantity greater than 1, the dial face switches from the standard icon-slice layout to a dedicated quantity-selection face.

**Visual design:**
- Standard slice wedges are hidden.
- A **semicircular arc bar** sweeps the bottom 180 degrees of the dial face (left edge to bottom to right edge).
- A small circular **trigger button** sits at the bottom of the arc.
- The player presses and holds the trigger, then drags upward along the arc.
- The arc fills from the bottom as the finger moves; fill colour reflects the active quantity tier.
- The dial center shows the target item icon and a large numeral (1, 2, or 3). The 180-degree arc is divided into three equal segments, one per integer value.
- Releasing the finger confirms the quantity. Releasing before the first threshold, or a brief tap, defaults to 1.

**Transition into this mode:**
- Activated when the current dial item is present in the active order and its required quantity is greater than 1.
- If required quantity is 1, the standard item-confirmation gesture is used instead.

**Technical requirements:**
- New dial face state constant (e.g. `DIAL_FACE_QUANTITY`) or a standalone `QuantitySelectorFace` component.
- Arc fill uses `Graphics.arc`; pointer angle determines fill level and active quantity tier.
- `pointerdown` on trigger activates; `pointermove` updates fill and numeral; `pointerup` / `pointerupoutside` confirms.
- Emits `dial:quantityConfirmed` with `{ itemKey: string, quantity: number }`.
- `Game` scene handles this via an `onSendItems(itemKey, qty)` batch method.
- Unit tests for arc fill calculation and threshold-to-quantity mapping.

---

### Dial Face: Recipe / Crafting Mode
Items assembled from base components present a distinct dial face when navigated to, replacing the standard slice layout with a recipe display.

**Visual design:**
- The dial center shows the **output item** icon.
- The surrounding ring is divided into ingredient slots (minimum 2, maximum 4).
- Each slot shows the required base-item icon and a quantity badge if more than one of that ingredient is needed.
- The player stages ingredients by selecting each slice in any order; a staged slice highlights to confirm receipt.
- When all ingredients are staged, the center icon pulses and a CRAFT confirmation gesture (drag-to-center or tap, per input mode) completes the assembly.

**Transition into this mode:**
- Items in `items.json` may carry an optional `recipe: [ { itemKey, quantity } ]` array.
- When the dial navigates to a recipe item, the `RecipeFace` activates in place of the standard item face.

**Technical requirements:**
- New optional `recipe` field on the `Item` type in `GameTypes.ts`.
- New `RecipeFace` component following the same architecture as `QuantitySelectorFace`.
- `OrderGenerator` may include recipe output items in orders; the player must craft them to fulfill.
- Staged ingredient state lives in `RecipeFace` and is cancelled on back-navigation without confirming.
- Emits `dial:craftConfirmed` with `{ outputItemKey: string }`.
- A small staging-area row in the central panel shows currently staged ingredients for visibility outside the dial.

---

### Powerup System

Purchasable one-time upgrades that alter game behavior. Bought with accumulated quanta, persisted in `ProgressionState.purchasedPowerups`.

**Architecture:**

`src/game/constants/Powerups.ts` is the single source of truth:
- `POWERUP_IDS` — typed `const` object of canonical string keys (e.g. `{ ORDER_HINTS: 'ORDER_HINTS' }`).
- `POWERUP_CATALOG` — metadata per powerup: `name`, `description`, `cost`, and `type`.

`ProgressionManager` exposes three methods:
- `hasPowerup(id)` — the only call site needed in rendering code; returns `true` if permanently owned.
- `purchasePowerup(id)` — deducts quanta and persists.
- `getPowerupCost(id)` — looks up catalog cost.

**`type` field (future-flexibility hook):**

| Value | Meaning | Future storage |
|---|---|---|
| `'permanent'` | Bought once, always active | `purchasedPowerups: string[]` (current) |
| `'consumable'` | Bought per-shift, depleted on use | `consumablePowerups: Record<string, number>` |
| `'toggle'` | Bought once, enabled/disabled per-shift | `activePowerups: string[]` |

Call sites always use `hasPowerup(id)` — internal storage evolves per type without touching rendering.

**Planned powerups:**

| ID | Cost | Description |
|---|---|---|
| `ORDER_HINTS` | Q50 | Show a dimmed ghost icon inside each unfilled order slot, reminding the player what item is required. **Re-entry point:** `buildFulfillmentSlotRow` in `Game.ts` contains the comment `POWERUP[ORDER_HINTS]` marking exactly where to create the `slotIcon` when this powerup is active. |

**Purchase UI:** TBD — candidate locations include the EndShift screen (between shifts) or a new in-panel SHOP tab.

---
