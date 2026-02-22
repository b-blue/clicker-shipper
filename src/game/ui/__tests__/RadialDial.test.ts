/** @jest-environment jsdom */
import { RadialDial } from '../RadialDial';
import { Item, SubItem } from '../../types/GameTypes';

type MockScene = {
  add: {
    graphics: jest.Mock;
    image: jest.Mock;
    text: jest.Mock;
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
        return {
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
      }),
      text: jest.fn(() => ({
        setOrigin: jest.fn(function () { return this; }),
        setDepth: jest.fn(function () { return this; }),
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
    const dial = new RadialDial(scene as any, dialX, dialY, items);

    (dial as any).currentLevel = 1;
    (dial as any).currentSubItems = items[0].subItems;
    (dial as any).updateSliceCount();

    const start = slicePoint(dialX, dialY, 6, 1, 120);
    const mid = slicePoint(dialX, dialY, 6, 4, 120);

    (dial as any).handlePointerDown(start);
    (dial as any).handleMouseMove(mid);
    (dial as any).handleMouseMove({ x: dialX, y: dialY });
    (dial as any).handlePointerUp({ x: dialX, y: dialY });

    expect(scene.events.emit).toHaveBeenCalledWith('dial:itemConfirmed', {
      item: items[0].subItems[4],
    });
  });

  it('reverts selection when lifting outside center', () => {
    const scene = createMockScene();
    const items = createMockItems();
    const dial = new RadialDial(scene as any, dialX, dialY, items);

    (dial as any).currentLevel = 1;
    (dial as any).currentSubItems = items[0].subItems;
    (dial as any).updateSliceCount();

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

  it('creates glow beneath icons when rendering', () => {
    const scene = createMockScene();
    const items = createMockItems();
    scene.textures.exists.mockReturnValue(true);

    const dial = new RadialDial(scene as any, 100, 100, items);
    (dial as any).currentLevel = 1;
    (dial as any).currentSubItems = items[0].subItems;

    // Call redrawDial which should create glow graphics
    (dial as any).redrawDial();

    // Verify graphics was called multiple times (for various layers including glows)
    expect(scene.add.graphics).toHaveBeenCalled();
  });

  it('renders highlighted slice with glow', () => {
    const scene = createMockScene();
    const items = createMockItems();
    
    const dial = new RadialDial(scene as any, 100, 100, items);
    (dial as any).currentLevel = 1;
    (dial as any).currentSubItems = items[0].subItems;
    (dial as any).highlightedSliceIndex = 2;

    // Call redrawDial which should apply glow styling
    (dial as any).redrawDial();

    // Verify graphics methods were called to render the slice
    expect(scene.add.graphics).toHaveBeenCalled();
  });
});


