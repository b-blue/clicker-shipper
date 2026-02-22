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

const createMockScene = (): MockScene => ({
  add: {
    graphics: jest.fn(() => ({
      clear: jest.fn(),
      fillStyle: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      arc: jest.fn(),
      closePath: jest.fn(),
      fillPath: jest.fn(),
      fillCircle: jest.fn(),
      strokePath: jest.fn(),
      setDepth: jest.fn(),
      lineStyle: jest.fn(),
      strokeCircle: jest.fn(),
      destroy: jest.fn(),
    })),
    image: jest.fn(() => ({
      setScale: jest.fn(function () { return this; }),
      setOrigin: jest.fn(function () { return this; }),
      setDepth: jest.fn(function () { return this; }),
      setTexture: jest.fn(function () { return this; }),
      setVisible: jest.fn(function () { return this; }),
      setPosition: jest.fn(function () { return this; }),
      destroy: jest.fn(),
    })),
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
});

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
});

