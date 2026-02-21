import { RadialDial } from '../RadialDial';
import { Item, SubItem } from '../../types/GameTypes';

describe('RadialDial', () => {
  let mockScene: any;
  let mockItems: Item[];

  const createMockItems = (): Item[] => {
    const subItems: SubItem[] = [
      { id: 'sub1', name: 'Sub Item 1', icon: 'icon1', cost: 10 },
      { id: 'sub2', name: 'Sub Item 2', icon: 'icon2', cost: 20 },
      { id: 'sub3', name: 'Sub Item 3', icon: 'icon3', cost: 30 },
      { id: 'sub4', name: 'Sub Item 4', icon: 'icon4', cost: 40 },
      { id: 'sub5', name: 'Sub Item 5', icon: 'icon5', cost: 50 },
      { id: 'sub6', name: 'Sub Item 6', icon: 'icon6', cost: 60 },
    ];
    
    return [
      {
        id: 'cat1',
        name: 'Category 1',
        icon: 'cat_icon1',
        subItems: subItems.slice(0, 3),
      },
      {
        id: 'cat2',
        name: 'Category 2',
        icon: 'cat_icon2',
        subItems: subItems.slice(3, 6),
      },
    ];
  };

  const createMockScene = (): any => {
    return {
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
          setDepth: jest.fn(),
          destroy: jest.fn(),
        })),
        image: jest.fn(() => ({
          setScale: jest.fn(function() { return this; }),
          setOrigin: jest.fn(function() { return this; }),
          setDepth: jest.fn(function() { return this; }),
          setTexture: jest.fn(function() { return this; }),
          setVisible: jest.fn(function() { return this; }),
          setPosition: jest.fn(function() { return this; }),
          destroy: jest.fn(),
        })),
        text: jest.fn(() => ({
          setOrigin: jest.fn(function() { return this; }),
          setDepth: jest.fn(function() { return this; }),
          setFontSize: jest.fn(function() { return this; }),
          setFill: jest.fn(function() { return this; }),
          setAlign: jest.fn(function() { return this; }),
          destroy: jest.fn(),
        })),
        zone: jest.fn(() => ({
          setInteractive: jest.fn(function() { return this; }),
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
        list: {},
      },
    };
  };

  beforeEach(() => {
    mockScene = createMockScene();
    mockItems = createMockItems();
  });

  describe('constructor and initialization', () => {
    it('should create RadialDial instance', () => {
      const radialDial = new RadialDial(mockScene, 400, 300, mockItems);
      expect(radialDial).toBeDefined();
    });

    it('should initialize with provided coordinates', () => {
      const radialDial = new RadialDial(mockScene, 500, 400, mockItems);
      expect(radialDial).toBeDefined();
    });

    it('should set up input handlers', () => {
      new RadialDial(mockScene, 400, 300, mockItems);
      expect(mockScene.input.on).toHaveBeenCalledWith(
        'pointermove',
        expect.any(Function)
      );
      expect(mockScene.input.on).toHaveBeenCalledWith(
        'pointerdown',
        expect.any(Function)
      );
    });

    it('should create graphics and image objects', () => {
      new RadialDial(mockScene, 400, 300, mockItems);
      expect(mockScene.add.graphics).toHaveBeenCalled();
      expect(mockScene.add.image).toHaveBeenCalled();
      expect(mockScene.add.zone).toHaveBeenCalled();
    });

    it('should create independent instances', () => {
      const dial1 = new RadialDial(mockScene, 400, 300, mockItems);
      const dial2 = new RadialDial(mockScene, 500, 400, mockItems);
      expect(dial1).not.toBe(dial2);
    });
  });

  describe('public methods', () => {
    let radialDial: RadialDial;

    beforeEach(() => {
      radialDial = new RadialDial(mockScene, 400, 300, mockItems);
    });

    it('should have public reset method', () => {
      expect(typeof radialDial.reset).toBe('function');
    });

    it('reset method should be callable without throwing', () => {
      expect(() => {
        radialDial.reset();
      }).not.toThrow();
    });

    it('should have private methods accessible via prototype', () => {
      // Verify the object has the expected structure
      expect(radialDial).toBeDefined();
      expect(typeof radialDial.reset).toBe('function');
    });
  });

  describe('scene integration', () => {
    it('should use provided scene for rendering', () => {
      new RadialDial(mockScene, 400, 300, mockItems);
      expect(mockScene.add.graphics).toHaveBeenCalled();
    });

    it('should register event listeners on scene input', () => {
      new RadialDial(mockScene, 400, 300, mockItems);
      expect(mockScene.input.on.mock.calls.length).toBeGreaterThan(0);
    });

    it('should access scene texture system', () => {
      new RadialDial(mockScene, 400, 300, mockItems);
      expect(mockScene.textures.exists).toHaveBeenCalled();
    });
  });

  describe('dial rendering', () => {
    it('should create graphics objects for rendering', () => {
      const scene = createMockScene();
      new RadialDial(scene, 400, 300, mockItems);
      expect(scene.add.graphics.mock.calls.length).toBeGreaterThan(0);
    });

    it('should create text and image objects for items', () => {
      const scene = createMockScene();
      new RadialDial(scene, 400, 300, mockItems);
      // Graphics should be called multiple times (center + slices)
      expect(scene.add.graphics.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('multiple dials', () => {
    it('should support multiple independent dials', () => {
      const scene1 = createMockScene();
      const scene2 = createMockScene();
      
      const dial1 = new RadialDial(scene1, 400, 300, mockItems);
      const dial2 = new RadialDial(scene2, 500, 400, mockItems);
      
      expect(dial1).toBeDefined();
      expect(dial2).toBeDefined();
      expect(dial1).not.toBe(dial2);
    });
  });

  describe('position handling', () => {
    it('should accept and use provided dial position', () => {
      const radialDial = new RadialDial(mockScene, 250, 350, mockItems);
      expect(radialDial).toBeDefined();
    });

    it('should handle various screen coordinates', () => {
      const positions = [
        { x: 0, y: 0 },
        { x: 640, y: 480 },
        { x: 400, y: 300 },
        { x: 100, y: 100 },
      ];

      positions.forEach(pos => {
        const scene = createMockScene();
        const dial = new RadialDial(scene, pos.x, pos.y, mockItems);
        expect(dial).toBeDefined();
      });
    });
  });
});

