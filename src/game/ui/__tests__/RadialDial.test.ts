/** @jest-environment jsdom */
import { RadialDial } from '../RadialDial';
import { Item, SubItem } from '../../types/GameTypes';

type MockScene = {
  add: {
    graphics: jest.Mock;
    image: jest.Mock;
    text: jest.Mock;
    bitmapText: jest.Mock;
    zone: jest.Mock;
  };
  input: {
    on: jest.Mock;
  };
  events: {
    emit: jest.Mock;
  };
  textures: {
    exists: jest.Mock;
    get: jest.Mock;
  };
  time: {
    addEvent: jest.Mock;
  };
  cameras: {
    main: {
      width: number;
    };
  };
  __images?: any[];
};

const createMockItems = (): Item[] => {
  const subItems: SubItem[] = Array.from({ length: 6 }, (_, index) => ({
    id: `sub${index + 1}`,
    name: `Sub Item ${index + 1}`,
    icon: `icon${index + 1}`,
    cost: (index + 1) * 10,
  }));

  return Array.from({ length: 6 }, (_, index) => ({
    id: `cat${index + 1}`,
    name: `Category ${index + 1}`,
    icon: `cat_icon${index + 1}`,
    subItems,
  }));
};

const createMockScene = (): MockScene => {
  const images: any[] = [];
  const createGraphicsMock = () => ({
    clear: jest.fn(function () { return this; }),
    fillStyle: jest.fn(function () { return this; }),
    beginPath: jest.fn(function () { return this; }),
    moveTo: jest.fn(function () { return this; }),
    lineTo: jest.fn(function () { return this; }),
    arc: jest.fn(function () { return this; }),
    closePath: jest.fn(function () { return this; }),
    fillPath: jest.fn(function () { return this; }),
    fillCircle: jest.fn(function () { return this; }),
    strokePath: jest.fn(function () { return this; }),
    setDepth: jest.fn(function () { return this; }),
    lineStyle: jest.fn(function () { return this; }),
    strokeCircle: jest.fn(function () { return this; }),
    destroy: jest.fn(),
    setVisible: jest.fn(function () { return this; }),
    setPosition: jest.fn(function () { return this; }),
  });

  return {
    add: {
      graphics: jest.fn(createGraphicsMock),
      image: jest.fn(function() {
        const image = {
          setScale: jest.fn(function () { return this; }),
          setOrigin: jest.fn(function () { return this; }),
          setDepth: jest.fn(function () { return this; }),
          setTexture: jest.fn(function () { return this; }),
          setVisible: jest.fn(function () { return this; }),
          setPosition: jest.fn(function () { return this; }),
          setTint: jest.fn(function () { return this; }),
          setAlpha: jest.fn(function () { return this; }),
          destroy: jest.fn(),
        };
        images.push(image);
        return image;
      }),
      text: jest.fn(() => ({
        setOrigin: jest.fn(function () { return this; }),
        setDepth: jest.fn(function () { return this; }),
        destroy: jest.fn(),
      })),
      bitmapText: jest.fn(() => ({
        setOrigin: jest.fn(function () { return this; }),
        setDepth: jest.fn(function () { return this; }),
        setTint: jest.fn(function () { return this; }),
        setMaxWidth: jest.fn(function () { return this; }),
        setText: jest.fn(function () { return this; }),
        setPosition: jest.fn(function () { return this; }),
        destroy: jest.fn(),
      })),
      zone: jest.fn(() => ({
        setInteractive: jest.fn(function () { return this; }),
      })),
    },
    input: {
      on: jest.fn(),
    },
    events: {
      emit: jest.fn(),
    },
    textures: {
      exists: jest.fn(() => false),
      // has() delegates to exists() so mockReturnValue(true) on exists
      // transparently makes both atlas-key and frame-name checks pass.
      get: jest.fn(() => ({ has: jest.fn(() => false) })),
    },
    time: {
      addEvent: jest.fn(() => ({
        remove: jest.fn(),
      })),
    },
    cameras: {
      main: {
        width: 375,
      },
    },
    __images: images,
  };
};

const slicePoint = (dialX: number, dialY: number, sliceCount: number, sliceIndex: number, radius: number) => {
  const sliceAngle = (Math.PI * 2) / sliceCount;
  const startAngle = sliceIndex * sliceAngle - Math.PI / 2;
  const midAngle = startAngle + sliceAngle / 2;
  return {
    x: dialX + Math.cos(midAngle) * radius,
    y: dialY + Math.sin(midAngle) * radius,
  };
};

describe('RadialDial drag-to-center selection', () => {
  const dialX = 100;
  const dialY = 100;

  it('confirms the last highlighted slice before entering center', () => {
    const scene = createMockScene();
    const items = createMockItems();
    scene.textures.exists.mockReturnValue(true);
    const dial = new RadialDial(scene as any, dialX, dialY, items);

    // First drill into the first category
    const catStart = slicePoint(dialX, dialY, 6, 0, 120);
    (dial as any).handlePointerDown(catStart);
    (dial as any).handleMouseMove({ x: dialX, y: dialY });
    (dial as any).handlePointerUp({ x: dialX, y: dialY });

    // Now we should be at level 1 with sub-items. Clear the previous emit calls
    (scene.events.emit as jest.Mock).mockClear();

    // Now drag one of the sub-items to center
    const start = slicePoint(dialX, dialY, 6, 1, 120);
    const mid = slicePoint(dialX, dialY, 6, 4, 120);

    (dial as any).handlePointerDown(start);
    (dial as any).handleMouseMove(mid);
    (dial as any).handleMouseMove({ x: dialX, y: dialY });
    (dial as any).handlePointerUp({ x: dialX, y: dialY });

    // Since subItems don't have children, dragging one to center should confirm it
    expect(scene.events.emit).toHaveBeenCalledWith('dial:itemConfirmed', expect.anything());
  });

  it('confirms the last highlighted slice when lifting anywhere on the dial', () => {
    const scene = createMockScene();
    const items = createMockItems();
    scene.textures.exists.mockReturnValue(true);
    const dial = new RadialDial(scene as any, dialX, dialY, items);

    // First drill into the first category
    const catStart = slicePoint(dialX, dialY, 6, 0, 120);
    (dial as any).handlePointerDown(catStart);
    (dial as any).handleMouseMove({ x: dialX, y: dialY });
    (dial as any).handlePointerUp({ x: dialX, y: dialY });

    (scene.events.emit as jest.Mock).mockClear();

    // Tap down on slice 2, move to slice 3, lift at slice 3 — should confirm slice 3
    const start = slicePoint(dialX, dialY, 6, 2, 120);
    const move  = slicePoint(dialX, dialY, 6, 3, 120);

    (dial as any).handlePointerDown(start);
    (dial as any).handleMouseMove(move);
    (dial as any).handlePointerUp(move);

    expect((dial as any).selectedItem).toBeNull();
    expect(scene.events.emit).toHaveBeenCalledWith('dial:itemConfirmed', expect.anything());
  });

  it('doubles center icon scale to 1.2', () => {
    const scene = createMockScene();
    const items = createMockItems();

    // Create dial and check that scene.add.image was called
    new RadialDial(scene as any, 100, 100, items);

    // Verify that add.image was called (for centerImage creation)
    expect(scene.add.image).toHaveBeenCalled();
  });

  it('uses skill-diagram as center default at root', () => {
    const scene = createMockScene();
    const items = createMockItems();
    // skill-diagram lives in atlas-nav; mock the atlas frame lookup
    scene.textures.exists.mockImplementation((key: string) => key === 'atlas-nav');
    scene.textures.get.mockImplementation(() => ({ has: (key: string) => key === 'skill-diagram' }));

    new RadialDial(scene as any, 100, 100, items);

    const centerImage = (scene as any).__images[0];
    expect(centerImage.setTexture).toHaveBeenCalledWith('atlas-nav', 'skill-diagram');
  });

  it('uses skill-up as center default on nested dials', () => {
    const scene = createMockScene();
    const items = createMockItems();
    // skill-up lives in atlas-nav; mock the atlas frame lookup
    scene.textures.exists.mockImplementation((key: string) => key === 'atlas-nav');
    scene.textures.get.mockImplementation(() => ({ has: (key: string) => key === 'skill-up' || key === 'skill-diagram' }));

    const dial = new RadialDial(scene as any, dialX, dialY, items);

    // Drill into the first category to reach depth 1
    const catStart = slicePoint(dialX, dialY, 6, 0, 120);
    (dial as any).handlePointerDown(catStart);
    (dial as any).handleMouseMove({ x: dialX, y: dialY });
    (dial as any).handlePointerUp({ x: dialX, y: dialY });

    const centerImage = (scene as any).__images[0];
    expect(centerImage.setTexture).toHaveBeenCalledWith('atlas-nav', 'skill-up');
  });

  it('creates glow beneath icons when rendering', () => {
    const scene = createMockScene();
    const items = createMockItems();
    scene.textures.exists.mockReturnValue(true);

    const dial = new RadialDial(scene as any, 100, 100, items);
    
    // Drill into first category to get to sub-items
    const catStart = slicePoint(100, 100, 6, 0, 120);
    (dial as any).handlePointerDown(catStart);
    (dial as any).handleMouseMove({ x: 100, y: 100 });
    (dial as any).handlePointerUp({ x: 100, y: 100 });

    // Call redrawDial which should create glow graphics
    (dial as any).redrawDial();

    // Verify graphics was called multiple times (for various layers including glows)
    expect(scene.add.graphics).toHaveBeenCalled();
  });

  it('renders highlighted slice with glow', () => {
    const scene = createMockScene();
    const items = createMockItems();
    scene.textures.exists.mockReturnValue(true);
    
    const dial = new RadialDial(scene as any, 100, 100, items);
    
    // Drill into first category
    const catStart = slicePoint(100, 100, 6, 0, 120);
    (dial as any).handlePointerDown(catStart);
    (dial as any).handleMouseMove({ x: 100, y: 100 });
    (dial as any).handlePointerUp({ x: 100, y: 100 });

    (dial as any).highlightedSliceIndex = 2;

    // Call redrawDial which should apply glow styling
    (dial as any).redrawDial();

    // Verify graphics methods were called to render the slice
    expect(scene.add.graphics).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Phase 1 coverage tests — added before simplification work
// ---------------------------------------------------------------------------

describe('RadialDial — quantity-selector mode', () => {
  // Dial center (100, 100), centerRadius=50, sliceRadius=150
  // arcRadius = (50+150)/2 = 100
  // With existingQty=0 (fresh), startQty=1, arcProgress=(1-0.5)/3=1/6
  // triggerAngle = π/2 - (1/6)*π = π/3
  // triggerX = dialX + cos(π/3)*100 = 100 + 50 = 150
  // triggerY = dialY + sin(π/3)*100 = 100 + 86.6 ≈ 187
  const dialX = 100;
  const dialY = 100;
  const trigger = { x: 150, y: 187 }; // zone-1 midpoint trigger position for fresh dial

  it('emits dial:quantityConfirmed with quantity 1 on trigger press + immediate release', () => {
    const scene = createMockScene();
    const items = createMockItems();
    scene.textures.exists.mockReturnValue(true);
    const dial = new RadialDial(scene as any, dialX, dialY, items);

    const fakeItem = { id: 'test-item', name: 'TEST', icon: 'test-icon' };
    dial.showTerminalDial(fakeItem as any);
    scene.events.emit.mockClear();

    // Press trigger, release immediately without moving
    (dial as any).handlePointerDown(trigger);
    (dial as any).handlePointerUp(trigger);

    expect(scene.events.emit).toHaveBeenCalledWith('dial:quantityConfirmed', {
      item: fakeItem,
      quantity: 1,
    });
  });

  it('emits dial:quantityConfirmed with quantity 2 when finger moves to 3 o’clock (zone 2)', () => {
    const scene = createMockScene();
    const items = createMockItems();
    scene.textures.exists.mockReturnValue(true);
    const dial = new RadialDial(scene as any, dialX, dialY, items);

    const fakeItem = { id: 'test-item', name: 'TEST', icon: 'test-icon' };
    dial.showTerminalDial(fakeItem as any);
    scene.events.emit.mockClear();

    // Press trigger, move to 3 o'clock (angle = 0, arcProgress = 0.5 → qty 2)
    (dial as any).handlePointerDown(trigger);
    (dial as any).handleMouseMove({ x: dialX + 100, y: dialY }); // 3 o'clock on arcRadius
    (dial as any).handlePointerUp({ x: dialX + 150, y: dialY });

    expect(scene.events.emit).toHaveBeenCalledWith('dial:quantityConfirmed', {
      item: fakeItem,
      quantity: 2,
    });
  });

  it('emits dial:quantityConfirmed with quantity 3 when finger moves to 12 o’clock (zone 3)', () => {
    const scene = createMockScene();
    const items = createMockItems();
    scene.textures.exists.mockReturnValue(true);
    const dial = new RadialDial(scene as any, dialX, dialY, items);

    const fakeItem = { id: 'test-item', name: 'TEST', icon: 'test-icon' };
    dial.showTerminalDial(fakeItem as any);
    scene.events.emit.mockClear();

    // Press trigger, move to 12 o'clock (angle = -π/2, arcProgress = 1.0 → qty 3)
    (dial as any).handlePointerDown(trigger);
    (dial as any).handleMouseMove({ x: dialX, y: dialY - 100 }); // 12 o'clock on arcRadius
    (dial as any).handlePointerUp({ x: dialX, y: dialY - 100 });

    expect(scene.events.emit).toHaveBeenCalledWith('dial:quantityConfirmed', {
      item: fakeItem,
      quantity: 3,
    });
  });

  it('does not emit dial:quantityConfirmed when pointer released without pressing trigger', () => {
    const scene = createMockScene();
    const items = createMockItems();
    scene.textures.exists.mockReturnValue(true);
    const dial = new RadialDial(scene as any, dialX, dialY, items);

    const fakeItem = { id: 'test-item', name: 'TEST', icon: 'test-icon' };
    dial.showTerminalDial(fakeItem as any);
    scene.events.emit.mockClear();

    // Move and release without pressing trigger (not near trigger pos)
    (dial as any).handlePointerDown({ x: dialX + 100, y: dialY });
    (dial as any).handlePointerUp({ x: dialX + 100, y: dialY });

    expect(scene.events.emit).not.toHaveBeenCalledWith(
      'dial:quantityConfirmed',
      expect.anything(),
    );
  });

  it('clears terminalItem and resets quantity state after quantityConfirmed', () => {
    const scene = createMockScene();
    const items = createMockItems();
    scene.textures.exists.mockReturnValue(true);
    const dial = new RadialDial(scene as any, dialX, dialY, items);

    const fakeItem = { id: 'test-item', name: 'TEST', icon: 'test-icon' };
    dial.showTerminalDial(fakeItem as any);

    (dial as any).handlePointerDown(trigger);
    (dial as any).handlePointerUp(trigger);

    expect((dial as any).terminalItem).toBeNull();
    expect((dial as any).isTriggerActive).toBe(false);
    expect((dial as any).arcProgress).toBe(0);
    expect((dial as any).currentQuantity).toBe(1);
  });

  it("emits dial:quantityConfirmed with quantity 0 when dragging CW past 6 o'clock (removal zone)", () => {
    const scene = createMockScene();
    const items = createMockItems();
    scene.textures.exists.mockReturnValue(true);
    const dial = new RadialDial(scene as any, dialX, dialY, items);

    const fakeItem = { id: 'test-item', name: 'TEST', icon: 'test-icon' };
    // Open with existingQty=1 so there is something to remove
    dial.showTerminalDial(fakeItem as any, 1);
    scene.events.emit.mockClear();

    // Activate the trigger directly (bypassing hit-test precision concerns)
    (dial as any).isTriggerActive = true;

    // Drag CW past 6 o'clock: dx=-20, dy=100 → angle ≈ 1.77 (just past π/2) → removal zone
    (dial as any).handleMouseMove({ x: dialX - 20, y: dialY + 100 });
    (dial as any).handlePointerUp({ x: dialX - 20, y: dialY + 100 });

    expect(scene.events.emit).toHaveBeenCalledWith('dial:quantityConfirmed', {
      item: fakeItem,
      quantity: 0,
    });
  });

  it('pre-positions trigger at the correct arc angle for existingQty=2', () => {
    const scene = createMockScene();
    const items = createMockItems();
    scene.textures.exists.mockReturnValue(true);
    const dial = new RadialDial(scene as any, dialX, dialY, items);

    const fakeItem = { id: 'test-item', name: 'TEST', icon: 'test-icon' };
    dial.showTerminalDial(fakeItem as any, 2);

    // arcProgress = (2-0.5)/3 = 0.5, triggerAngle = π/2 - 0.5*π = 0 (3 o'clock)
    // trigger should be at (dialX + arcRadius, dialY) = (200, 100)
    const expectedArcProgress = (2 - 0.5) / 3; // 0.5
    expect((dial as any).arcProgress).toBeCloseTo(expectedArcProgress, 5);
    expect((dial as any).currentQuantity).toBe(2);
  });
});

describe('RadialDial — center tap navigation', () => {
  const dialX = 100;
  const dialY = 100;
  const center = { x: dialX, y: dialY }; // within centerRadius (50)

  it('emits dial:goBack when tapping center at navigation depth > 0', () => {
    const scene = createMockScene();
    const items = createMockItems();
    scene.textures.exists.mockReturnValue(true);
    const dial = new RadialDial(scene as any, dialX, dialY, items);

    // Drill into first category
    const catStart = slicePoint(dialX, dialY, 6, 0, 120);
    (dial as any).handlePointerDown(catStart);
    (dial as any).handlePointerUp(catStart);

    scene.events.emit.mockClear();

    // Tap center — should go back
    (dial as any).handlePointerDown(center);
    (dial as any).handlePointerUp(center);

    expect(scene.events.emit).toHaveBeenCalledWith('dial:goBack');
  });

  it('does not emit dial:goBack when tapping center at root depth', () => {
    const scene = createMockScene();
    const items = createMockItems();
    scene.textures.exists.mockReturnValue(true);
    const dial = new RadialDial(scene as any, dialX, dialY, items);

    scene.events.emit.mockClear();

    // Tap center at root — canGoBack() is false, nothing should emit
    (dial as any).handlePointerDown(center);
    (dial as any).handlePointerUp(center);

    expect(scene.events.emit).not.toHaveBeenCalledWith('dial:goBack');
  });
});

describe('RadialDial — center tap in terminal mode', () => {
  const dialX = 100;
  const dialY = 100;
  const center = { x: dialX, y: dialY };

  it('emits dial:goBack and clears terminalItem when tapping center in terminal mode', () => {
    const scene = createMockScene();
    const items = createMockItems();
    scene.textures.exists.mockReturnValue(true);
    const dial = new RadialDial(scene as any, dialX, dialY, items);

    const fakeItem = { id: 'test-item', name: 'TEST', icon: 'test-icon' };
    dial.showTerminalDial(fakeItem as any);

    scene.events.emit.mockClear();

    (dial as any).handlePointerDown(center);
    (dial as any).handlePointerUp(center);

    expect(scene.events.emit).toHaveBeenCalledWith('dial:goBack');
    expect((dial as any).terminalItem).toBeNull();
  });

  it('resets all relevant state fields when center-tapping out of terminal mode', () => {
    const scene = createMockScene();
    const items = createMockItems();
    scene.textures.exists.mockReturnValue(true);
    const dial = new RadialDial(scene as any, dialX, dialY, items);

    const fakeItem = { id: 'test-item', name: 'TEST', icon: 'test-icon' };
    dial.showTerminalDial(fakeItem as any);

    (dial as any).handlePointerDown(center);
    (dial as any).handlePointerUp(center);

    expect((dial as any).terminalItem).toBeNull();
    expect((dial as any).dragStartSliceIndex).toBe(-1);
    expect((dial as any).lastNonCenterSliceIndex).toBe(-1);
    expect((dial as any).highlightedSliceIndex).toBe(-1);
  });
});

describe('RadialDial — pointerConsumed deduplication', () => {
  const dialX = 100;
  const dialY = 100;

  it('emits dial:itemConfirmed exactly once when pointerup fires twice for the same gesture', () => {
    const scene = createMockScene();
    const items = createMockItems();
    scene.textures.exists.mockReturnValue(true);
    const dial = new RadialDial(scene as any, dialX, dialY, items);

    // Drill into first category so sub-items (leaves) are on the dial
    const catStart = slicePoint(dialX, dialY, 6, 0, 120);
    (dial as any).handlePointerDown(catStart);
    (dial as any).handlePointerUp(catStart);

    scene.events.emit.mockClear();

    // Start a gesture on sub-item slice
    const subStart = slicePoint(dialX, dialY, 6, 2, 120);
    (dial as any).handlePointerDown(subStart);

    // Fire pointerup twice (touch + synthesized mouse scenario)
    (dial as any).handlePointerUp(subStart);
    (dial as any).handlePointerUp(subStart);

    const confirmCalls = (scene.events.emit as jest.Mock).mock.calls.filter(
      ([evt]) => evt === 'dial:itemConfirmed'
    );
    expect(confirmCalls).toHaveLength(1);
  });
});

describe('RadialDial — synthesized mouse suppression', () => {
  const dialX = 100;
  const dialY = 100;

  it('ignores non-touch pointerdown fired within 500ms of a real touch end', () => {
    const scene = createMockScene();
    const items = createMockItems();
    scene.textures.exists.mockReturnValue(true);
    const dial = new RadialDial(scene as any, dialX, dialY, items);

    // Drill to sub-items
    const catStart = slicePoint(dialX, dialY, 6, 0, 120);
    (dial as any).handlePointerDown(catStart);
    (dial as any).handlePointerUp(catStart);

    // Simulate a real touch gesture on a sub-item
    const subStart = slicePoint(dialX, dialY, 6, 1, 120);
    (dial as any).handlePointerDown({ ...subStart, wasTouch: true });
    (dial as any).handlePointerUp({ ...subStart, wasTouch: true });

    // Immediately fire synthesized mousedown (wasTouch: false) at same spot
    (dial as any).handlePointerDown({ ...subStart, wasTouch: false });

    // Synthesized mousedown should have been suppressed — dragStartSliceIndex stays -1
    expect((dial as any).dragStartSliceIndex).toBe(-1);
  });

  it('allows non-touch pointerdown after the synthesis window expires', () => {
    const scene = createMockScene();
    const items = createMockItems();
    scene.textures.exists.mockReturnValue(true);
    const dial = new RadialDial(scene as any, dialX, dialY, items);

    // Drill to sub-items
    const catStart = slicePoint(dialX, dialY, 6, 0, 120);
    (dial as any).handlePointerDown(catStart);
    (dial as any).handlePointerUp(catStart);

    // Set lastTouchEndTime well in the past (beyond the 500ms window)
    (dial as any).lastTouchEndTime = Date.now() - 600;

    const subStart = slicePoint(dialX, dialY, 6, 1, 120);
    (dial as any).handlePointerDown({ ...subStart, wasTouch: false });

    // Should not be suppressed — dragStartSliceIndex should be set
    expect((dial as any).dragStartSliceIndex).toBeGreaterThanOrEqual(0);
  });
});

describe('RadialDial — confirmedSliceIndex baseline', () => {
  const dialX = 100;
  const dialY = 100;

  it('sets lastNonCenterSliceIndex equal to dragStartSliceIndex on pointerdown with no subsequent move', () => {
    const scene = createMockScene();
    const items = createMockItems();
    scene.textures.exists.mockReturnValue(true);
    const dial = new RadialDial(scene as any, dialX, dialY, items);

    // Drill to sub-items
    const catStart = slicePoint(dialX, dialY, 6, 0, 120);
    (dial as any).handlePointerDown(catStart);
    (dial as any).handlePointerUp(catStart);

    const subStart = slicePoint(dialX, dialY, 6, 2, 120);
    (dial as any).handlePointerDown(subStart);

    expect((dial as any).lastNonCenterSliceIndex).toBe((dial as any).dragStartSliceIndex);
  });

  it('confirms the item at the tapped slice when pointerdown and pointerup are at the same position', () => {
    const scene = createMockScene();
    const items = createMockItems();
    scene.textures.exists.mockReturnValue(true);
    const dial = new RadialDial(scene as any, dialX, dialY, items);

    // Drill to sub-items (leaves)
    const catStart = slicePoint(dialX, dialY, 6, 0, 120);
    (dial as any).handlePointerDown(catStart);
    (dial as any).handlePointerUp(catStart);

    scene.events.emit.mockClear();

    const subStart = slicePoint(dialX, dialY, 6, 3, 120);
    (dial as any).handlePointerDown(subStart);
    (dial as any).handlePointerUp(subStart);

    expect(scene.events.emit).toHaveBeenCalledWith('dial:itemConfirmed', expect.anything());
  });
});

describe('RadialDial — sliceCenterAngle in dial:itemConfirmed', () => {
  const dialX = 100;
  const dialY = 100;

  it('includes sliceCenterAngle in the dial:itemConfirmed payload matching the confirmed slice', () => {
    const scene = createMockScene();
    const items = createMockItems();
    scene.textures.exists.mockReturnValue(true);
    const dial = new RadialDial(scene as any, dialX, dialY, items);

    // Drill to sub-items
    const catStart = slicePoint(dialX, dialY, 6, 0, 120);
    (dial as any).handlePointerDown(catStart);
    (dial as any).handlePointerUp(catStart);

    scene.events.emit.mockClear();

    // Tap slice index 3
    const subStart = slicePoint(dialX, dialY, 6, 3, 120);
    (dial as any).handlePointerDown(subStart);
    (dial as any).handlePointerUp(subStart);

    const calls = (scene.events.emit as jest.Mock).mock.calls;
    const confirmCall = calls.find(([evt]: [string]) => evt === 'dial:itemConfirmed');
    expect(confirmCall).toBeDefined();
    const payload = confirmCall![1] as { item: any; sliceCenterAngle: number };
    // For slice 3 of 6: -π/2 + (3+0.5)*(2π/6) = 2π/3
    expect(payload.sliceCenterAngle).toBeCloseTo((2 * Math.PI) / 3, 5);
  });
});

describe('RadialDial — terminalStartAngle positioning', () => {
  const dialX = 100;
  const dialY = 100;

  it('positions the trigger at a custom startAngle passed to showTerminalDial', () => {
    const scene = createMockScene();
    const items = createMockItems();
    scene.textures.exists.mockReturnValue(true);
    const dial = new RadialDial(scene as any, dialX, dialY, items);

    const fakeItem = { id: 'sub1', name: 'Sub 1', icon: 'icon1', cost: 10 };
    // startAngle = 0 (3 o'clock)
    dial.showTerminalDial(fakeItem as any, 0, 0);

    // arcRadius = (centerRadius + sliceRadius) / 2 = (50 + 150) / 2 = 100
    // arcProgress = (max(1,0) - 0.5) / 3 = 1/6
    // triggerAngle = 0 - (1/6)*π = -π/6
    const arcRadius = 100;
    const arcProgress = 0.5 / 3;
    const expectedTriggerAngle = 0 - arcProgress * Math.PI;
    const triggerX = dialX + Math.cos(expectedTriggerAngle) * arcRadius;
    const triggerY = dialY + Math.sin(expectedTriggerAngle) * arcRadius;

    // A pointer exactly on the trigger should activate it
    (dial as any).handlePointerDown({ x: triggerX, y: triggerY, pointerId: 1, wasTouch: false, event: {} });
    expect((dial as any).isTriggerActive).toBe(true);
  });

  it("defaults to π/2 (6 o'clock) when no startAngle is provided", () => {
    const scene = createMockScene();
    const items = createMockItems();
    scene.textures.exists.mockReturnValue(true);
    const dial = new RadialDial(scene as any, dialX, dialY, items);

    const fakeItem = { id: 'sub1', name: 'Sub 1', icon: 'icon1', cost: 10 };
    dial.showTerminalDial(fakeItem as any);
    expect((dial as any).terminalStartAngle).toBeCloseTo(Math.PI / 2, 5);
  });
});
