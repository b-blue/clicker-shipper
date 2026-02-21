# Item Manual & Navigation Guide

## Overview
Players now have access to a comprehensive Item Manual that displays all available items with descriptions and costs. Additionally, the radial dial now includes visual indicators to help distinguish items with sub-options from final items.

## Visual Indicators

### Corner Badge (▶)
- **Appearance:** Yellow right-pointing arrow (▶) in the top-right corner of an item
- **Meaning:** This item has sub-options available - click it to drill down
- **Location:** Only appears on Category items (top level of the dial)
- **Color:** Bright yellow (#ffff00) for high visibility

**Example Flow:**
```
Initial View (Top Level)
├─ Ancient Grimoires ▶  (has sub-items)
├─ Metallic Alloys ▶    (has sub-items)
└─ Optical Systems ▶    (has sub-items)

After Clicking "Ancient Grimoires":
├─ Tome of the Gouged Monks     (no badge - final item)
├─ Sellsword's Guide to Law     (no badge - final item)
└─ Book of Sacred Lattices      (no badge - final item)
```

## Item Manual UI

### Access Points
The Item Manual can be opened from:
1. **Main Menu** - Select "Manual" option before starting shift
2. **During Gameplay** - Pause menu while working orders
3. **Keyboard Shortcut** - Press "M" to toggle manual (future enhancement)

### Interface Layout

```
╔════════════════════════════════════════════════════════════════════╗
║                        ITEM MANUAL                            [X]  ║
║               Browse items and their descriptions                  ║
╠════════════════════════════════════════════════════════════════════╣
║                                           │                        ║
║  [Item 1]  [Item 2]  [Item 3]           │  SELECT AN ITEM        ║
║   Ancient   Metallic  Synthetic         │  (Details panel)       ║
║  Grimoires  Alloys    Lubricants        │                        ║
║                                           │  Displays:            ║
║  [Item 4]  [Item 5]  [Item 6]           │  - Item name          ║
║ Electrical Mechanical Optical           │  - Cost (if subitem)  ║
║ Components   Parts    Systems           │  - Description text   ║
║                                           │                        ║
╠════════════════════════════════════════════════════════════════════╣
║  < PREV                    Page 1 of 3               NEXT >        ║
║                      [ CLOSE (ESC) ]                              ║
╚════════════════════════════════════════════════════════════════════╝
```

### How to Use

1. **Browse Items**
   - Items are displayed in a grid (3 columns × 2 rows)
   - Each item shows its icon, name, and cost (if applicable)
   - Page indicator shows current page and total pages

2. **View Details**
   - Click any item to see its full description in the details panel
   - Descriptions include:
     - **Categories:** Overview of the item type
     - **Sub-items:** Specific purpose and use case

3. **Navigate Pages**
   - Use "PREV" and "NEXT" buttons to browse all items
   - Current page shown at bottom

4. **Close Manual**
   - Click "CLOSE (ESC)" button
   - Press ESC key
   - Return to game/menu

## Item Data Structure

### Categories (Top-Level Items)
Each category has a general description of the item class:

```json
{
  "id": "item_2",
  "name": "Metallic Alloys",
  "icon": "metallic",
  "description": "Advanced metal compounds for structural and industrial applications",
  "subItems": [ ... ]
}
```

### Sub-Items (Final Items)
Each sub-item includes cost and specific purpose:

```json
{
  "id": "item_2_1",
  "name": "Titanium Ingot",
  "icon": "titanium_ingot",
  "cost": 20,
  "description": "Incredibly strong yet lightweight, prized for aerospace components"
}
```

## Complete Item Catalog

### 1. Ancient Grimoires (▶)
Rare manuscripts containing arcane knowledge and cosmic wisdom

- **Tome of the Gouged Monks** ($12) - A meditation on sacrifice and enlightenment through pain
- **Sellsword's Guide to Law** ($18) - Pragmatic discourse on honor, contracts, and the mercenary's code
- **Book of Sacred Lattices** ($15) - Geometric patterns revealing the structure of dimensional boundaries
- **Hardy's Epigrams** ($10) - Witty observations on life, death, and the space between them

### 2. Metallic Alloys (▶)
Advanced metal compounds for structural and industrial applications

- **Titanium Ingot** ($20) - Incredibly strong yet lightweight, prized for aerospace components
- **Neutron Steel** ($25) - Treated in a particle accelerator, exhibits quantum-mechanical properties
- **Quantum Bronze** ($16) - Bronze infused with probability-warping crystalline matrices
- **Durasteel Plate** ($19) - Time-tempered alloy known for extreme durability and resilience
- **Iridium Wire** ($11) - Thin conductors with surprising tensile strength and corrosion resistance
- **Chromium Alloy** ($17) - Mirror-finish metal perfect for reflective and aesthetic applications

### 3. Synthetic Lubricants (▶)
Engineered fluids designed to reduce friction in extreme conditions

- **Viscous Compound** ($8) - Thick, protective gel for slow-moving machinery and bearings
- **Plasma Gel** ($13) - Ionized lubricant that adapts to temperature changes dynamically
- **Slipstream Oil** ($9) - Low-viscosity fluid optimized for high-speed engines and turbines
- **Frictionless Fluid** ($12) - Theoretical maximum efficiency: nearly zero coefficient of friction
- **Entropy Lubricant** ($14) - Paradoxical fluid that remains slippery while increasing system stability
- **Quantum Slick** ($10) - Exists in superposition, lubricating multiple components simultaneously

### 4. Electrical Components (▶)
Fundamental building blocks for power systems and circuitry

- **Capacitor Module** ($15) - Stores and releases electrical energy with precision timing
- **Positronic Relay** ($21) - Antimatter-grade switch for high-voltage circuit control
- **Conductor Strip** ($11) - Pure copper pathway for electrical transmission with minimal loss
- **Diode Cell** ($9) - One-way valve for electricity, essential for power regulation
- **Transformer Coil** ($18) - Converts voltage levels through electromagnetic induction
- **Pulse Circuit** ($13) - Generates timed electrical bursts for synchronized system activation

### 5. Mechanical Parts (▶)
Precision-engineered components for movement and force transduction

- **Servo Motor** ($19) - Intelligent actuator that positions itself with remarkable accuracy
- **Piston Assembly** ($16) - Converts pressure into linear motion with steady, reliable force
- **Gear Cluster** ($12) - Interlocking teeth transmit rotational force with mechanical advantage
- **Bearing Ring** ($10) - Distributes load across a circular race, enabling smooth rotation
- **Valve Unit** ($14) - Controls flow direction and pressure with mechanical or electrical actuation
- **Rotor Blade** ($17) - Captures or transfers energy through rotational aerodynamic action

### 6. Optical Systems (▶)
Light manipulation and detection devices for sensing and communication

- **Laser Module** ($24) - Coherent light beam generator for cutting, welding, or measurement
- **Photon Lens** ($20) - Focuses or disperses light with quantum-precision optics
- **Spectrum Prism** ($18) - Separates light into component wavelengths for analysis or art
- **Sensor Array** ($16) - Detects light across multiple spectra for imaging and reconnaissance
- **Mirror Unit** ($11) - Perfect reflection surface for redirecting or magnifying light paths
- **Diffraction Grating** ($13) - Splits light into spectral components for analysis or display effects

## Player Tips

### For Finding Items in Orders
1. Open the Item Manual (Main Menu → Manual or Pause → Manual)
2. Read the order requirement
3. Search for the item in the manual
4. Check its category and sub-item name
5. Return to the dial and navigate to that item

### Understanding Item Costs
- Higher cost items are more valuable but may not fit in low-budget orders
- Cost is displayed both in the manual and in the dial interface
- Plan your selections based on budget constraints shown in order details

### Efficient Navigation
- The corner badge (▶) tells you immediately if you need to drill down
- Sub-items don't have badges - they're final selections
- Use the manual to pre-plan before working orders

## Implementation Notes

### TypeScript Types Updated
- `SubItem` and `Item` interfaces now include optional `description` field
- All existing data queries remain backward compatible
- Descriptions are optional for future flexibility

### Data Location
- Item data: `/public/data/items.json`
- ItemManual component: `src/game/ui/ItemManual.ts`
- RadialDial badges: `src/game/ui/RadialDial.ts` (lines ~210-216)

### Future Enhancements
- [ ] Search functionality in Item Manual
- [ ] Filter by cost range
- [ ] Filter by category
- [ ] Keyboard shortcut to open manual during gameplay
- [ ] Item preview with animated rotation
- [ ] Audio hints for corner badge hover
- [ ] Item recommendation engine based on current order
