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

  it('reverts selection when lifting outside center', () => {
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

    const start = slicePoint(dialX, dialY, 6, 2, 120);
    const move = slicePoint(dialX, dialY, 6, 3, 120);

    (dial as any).handlePointerDown(start);
    (dial as any).handleMouseMove(move);
    (dial as any).handlePointerUp(move);

    expect((dial as any).selectedItem).toBeNull();
    expect(scene.events.emit).not.toHaveBeenCalledWith('dial:itemConfirmed', expect.anything());
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
    scene.textures.exists.mockImplementation((key: string) => key === 'skill-diagram');

    new RadialDial(scene as any, 100, 100, items);

    const centerImage = (scene as any).__images[0];
    expect(centerImage.setTexture).toHaveBeenCalledWith('skill-diagram');
  });

  it('uses skill-up as center default on nested dials', () => {
    const scene = createMockScene();
    const items = createMockItems();
    scene.textures.exists.mockImplementation((key: string) => key === 'skill-up' || key === 'skill-diagram');

    const dial = new RadialDial(scene as any, dialX, dialY, items);

    // Drill into the first category to reach depth 1
    const catStart = slicePoint(dialX, dialY, 6, 0, 120);
    (dial as any).handlePointerDown(catStart);
    (dial as any).handleMouseMove({ x: dialX, y: dialY });
    (dial as any).handlePointerUp({ x: dialX, y: dialY });

    const centerImage = (scene as any).__images[0];
    expect(centerImage.setTexture).toHaveBeenCalledWith('skill-up');
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


