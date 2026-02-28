/** @jest-environment jsdom */

// Mock ProgressionManager
jest.mock('../../managers/ProgressionManager', () => ({
  ProgressionManager: {
    getInstance: jest.fn(() => ({
      getShiftsCompleted: jest.fn(() => 3),
      getQuantaBank: jest.fn(() => 150),
      getUnlockedCategories: jest.fn(() => [
        { categoryId: 'nav_resources_root', depth: 1 },
      ]),
      canDeepen: jest.fn(() => true),
      getCostToDeepen: jest.fn(() => 30),
      canAfford: jest.fn(() => true),
      getCostToUnlockNew: jest.fn(() => 25),
      getAvailableToUnlock: jest.fn(() => ['nav_armaments_root']),
      deepenCategory: jest.fn(),
      purchaseNewCategory: jest.fn(),
    })),
  },
  CATEGORY_DISPLAY_NAMES: {
    'nav_resources_root': 'RESOURCES',
    'nav_armaments_root': 'ARMAMENTS',
  },
  ALL_CATEGORY_IDS: [
    'nav_resources_root',
    'nav_armaments_root',
  ],
}));

function makeMockScene() {
  const chainable = jest.fn().mockReturnThis();
  const textObj = () => ({
    setOrigin: chainable,
    setTint: chainable,
    setMaxWidth: chainable,
    setText: jest.fn(),
  });
  const rectObj = () => ({
    setStrokeStyle: chainable,
    setInteractive: chainable,
    setFillStyle: chainable,
    on: chainable,
    setMask: chainable,
    setVisible: chainable,
    destroy: jest.fn(),
  });
  const graphicsObj = () => ({
    fillStyle: chainable,
    fillRect: chainable,
    createGeometryMask: jest.fn(() => ({})),
    setVisible: chainable,
  });
  const containerObj = () => ({
    add: chainable,
    setMask: chainable,
    destroy: jest.fn(),
    y: 0,
  });

  return {
    cameras: { main: { width: 480, height: 720 } },
    add: {
      rectangle: jest.fn(() => rectObj()),
      text: jest.fn(() => textObj()),
      graphics: jest.fn(() => graphicsObj()),
      container: jest.fn(() => containerObj()),
    },
    input: {
      on: jest.fn(),
    },
    scene: {
      start: jest.fn(),
    },
    time: { addEvent: jest.fn() },
    tweens: { add: jest.fn() },
  };
}

describe('EndShift scene', () => {
  beforeAll(() => {
    (global as any).Phaser = { Scene: class {} };
  });

  it('creates without throwing', async () => {
    const { EndShift } = await import('../EndShift');
    const scene = new EndShift();
    const mock = makeMockScene();
    Object.assign(scene, mock);
    expect(() => scene.create({})).not.toThrow();
  });

  it('displays SHIFT COMPLETE header text', async () => {
    const { EndShift } = await import('../EndShift');
    const scene = new EndShift();
    const mock = makeMockScene();
    Object.assign(scene, mock);
    scene.create({ revenue: 100, bonus: 20, shiftsCompleted: 5 });
    const calls: string[] = (mock.add.text as jest.Mock).mock.calls.map(c => c[2]);
    expect(calls).toContain('SHIFT COMPLETE');
  });

  it('shows quanta bank balance', async () => {
    const { EndShift } = await import('../EndShift');
    const scene = new EndShift();
    const mock = makeMockScene();
    Object.assign(scene, mock);
    scene.create({ revenue: 50, bonus: 10 });
    const calls: string[] = (mock.add.text as jest.Mock).mock.calls.map(c => c[2]);
    expect(calls.some(t => t.includes('150'))).toBe(true);
  });

  it('shows PLAY AGAIN and MAIN MENU buttons', async () => {
    const { EndShift } = await import('../EndShift');
    const scene = new EndShift();
    const mock = makeMockScene();
    Object.assign(scene, mock);
    scene.create({});
    const calls: string[] = (mock.add.text as jest.Mock).mock.calls.map(c => c[2]);
    expect(calls).toContain('PLAY AGAIN');
    expect(calls).toContain('MAIN MENU');
  });

  it('navigates to Game when PLAY AGAIN is pressed', async () => {
    const { EndShift } = await import('../EndShift');
    const scene = new EndShift();
    const mock = makeMockScene();
    Object.assign(scene, mock);

    const pointerdownCallbacks: Array<() => void> = [];
    (mock.add.rectangle as jest.Mock).mockImplementation(() => {
      const obj = {
        setStrokeStyle: jest.fn().mockReturnThis(),
        setInteractive: jest.fn().mockReturnThis(),
        setFillStyle: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation((event: string, cb: () => void) => {
          if (event === 'pointerdown') pointerdownCallbacks.push(cb);
          return obj;
        }),
        setMask: jest.fn().mockReturnThis(),
        setVisible: jest.fn().mockReturnThis(),
        destroy: jest.fn(),
      };
      return obj;
    });

    scene.create({});
    const cbSnapshot = [...pointerdownCallbacks];
    for (const cb of cbSnapshot) cb();
    expect(mock.scene.start).toHaveBeenCalledWith('Game');
  });

  it('navigates to MainMenu when MAIN MENU is pressed', async () => {
    const { EndShift } = await import('../EndShift');
    const scene = new EndShift();
    const mock = makeMockScene();
    Object.assign(scene, mock);

    const pointerdownCallbacks: Array<() => void> = [];
    (mock.add.rectangle as jest.Mock).mockImplementation(() => {
      const obj = {
        setStrokeStyle: jest.fn().mockReturnThis(),
        setInteractive: jest.fn().mockReturnThis(),
        setFillStyle: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation((event: string, cb: () => void) => {
          if (event === 'pointerdown') pointerdownCallbacks.push(cb);
          return obj;
        }),
        setMask: jest.fn().mockReturnThis(),
        setVisible: jest.fn().mockReturnThis(),
        destroy: jest.fn(),
      };
      return obj;
    });

    scene.create({});
    const cbSnapshot = [...pointerdownCallbacks];
    for (const cb of cbSnapshot) cb();
    expect(mock.scene.start).toHaveBeenCalledWith('MainMenu');
  });
});
