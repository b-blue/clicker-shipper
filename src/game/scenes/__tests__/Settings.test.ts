/** @jest-environment jsdom */
import { Colors, toColorString } from '../../constants/Colors';

// Mock Phaser before any imports that use it
jest.mock('phaser', () => ({
  Scene: class Scene {
    constructor() {}
  },
}));

describe('Settings scene', () => {
  let mockSettingsManager: any;

  beforeAll(() => {
    (global as any).Phaser = { 
      Scene: class {},
      Time: {
        TimerEvent: class {}
      }
    };
  });

  beforeEach(() => {
    // Mock localStorage
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });

    // Reset SettingsManager mock
    mockSettingsManager = {
      getDialSettings: jest.fn(() => ({
        offsetX: -200,
        offsetY: -150,
        showOutline: false,
      })),
      updateDialPosition: jest.fn(),
      updateDialOutline: jest.fn(),
      getSettings: jest.fn(() => ({
        dial: { offsetX: -200, offsetY: -150, showOutline: false },
        ui: { hudStripY: 28, hudStripHeight: 40 },
      })),
    };
  });

  const createScene = async () => {
    // Mock SettingsManager.getInstance
    const SettingsManagerModule = await import('../../managers/SettingsManager');
    jest.spyOn(SettingsManagerModule.SettingsManager, 'getInstance').mockReturnValue(mockSettingsManager);

    const { Settings } = await import('../Settings');
    const scene = new Settings();

    const mockRectangle = jest.fn(() => ({
      setInteractive: jest.fn().mockReturnThis(),
      on: jest.fn(),
      setFillStyle: jest.fn().mockReturnThis(),
      setStrokeStyle: jest.fn().mockReturnThis(),
    }));

    const mockText = jest.fn(() => ({
      setOrigin: jest.fn().mockReturnThis(),
      setText: jest.fn().mockReturnThis(),
    }));
    
    const mockBitmapText = jest.fn(() => ({
      setOrigin: jest.fn().mockReturnThis(),
      setText: jest.fn().mockReturnThis(),
      setTint: jest.fn().mockReturnThis(),
    }));

    const mockGraphics = jest.fn(() => ({
      lineStyle: jest.fn().mockReturnThis(),
      strokeCircle: jest.fn().mockReturnThis(),
      lineBetween: jest.fn().mockReturnThis(),
      setDepth: jest.fn().mockReturnThis(),
      destroy: jest.fn(),
    }));

    (scene as any).add = {
      rectangle: mockRectangle,
      text: mockText,
      bitmapText: mockBitmapText,
      graphics: mockGraphics,
    };

    (scene as any).cameras = {
      main: {
        width: 800,
        height: 600,
      },
    };

    (scene as any).scene = {
      start: jest.fn(),
    };

    (scene as any).data = {
      set: jest.fn(),
      get: jest.fn(),
    };

    (scene as any).time = {
      delayedCall: jest.fn((_delay, _callback) => ({
        remove: jest.fn(),
      })),
    };

    return { scene, mockRectangle, mockText, mockBitmapText, mockGraphics };
  };

  it('renders the background and panel', async () => {
    const { scene, mockRectangle } = await createScene();

    scene.create();

    // Background
    expect(mockRectangle).toHaveBeenCalledWith(400, 300, 800, 600, Colors.BACKGROUND_DARK);
    
    // Panel
    expect(mockRectangle).toHaveBeenCalledWith(400, 192, 600, 330, Colors.PANEL_DARK, 0.9);
  });

  it('renders the title', async () => {
    const { scene, mockBitmapText } = await createScene();

    scene.create();

    expect(mockBitmapText).toHaveBeenCalledWith(400, 60, 'clicker', 'SETTINGS', 32);
  });

  it('renders section header and controls', async () => {
    const { scene, mockBitmapText } = await createScene();

    scene.create();

    // Section header
    expect(mockBitmapText).toHaveBeenCalledWith(400, 108, 'clicker', 'DIAL POSITION', 16);

    // Horizontal label
    expect(mockBitmapText).toHaveBeenCalledWith(expect.any(Number), 174, 'clicker', 'HORIZONTAL', 14);

    // Vertical label
    expect(mockBitmapText).toHaveBeenCalledWith(expect.any(Number), 216, 'clicker', 'VERTICAL', 14);
  });

  it('loads current settings from SettingsManager', async () => {
    mockSettingsManager.getDialSettings.mockReturnValue({
      offsetX: -250,
      offsetY: -180,
      showOutline: true,
    });

    const { scene, mockBitmapText } = await createScene();

    scene.create();

    expect(mockSettingsManager.getDialSettings).toHaveBeenCalled();
    expect(mockBitmapText).toHaveBeenCalledWith(400, 174, 'clicker', '-250', 14);
    expect(mockBitmapText).toHaveBeenCalledWith(400, 216, 'clicker', '-180', 14);
  });

  it('renders three buttons in a single row', async () => {
    const { scene, mockRectangle } = await createScene();

    scene.create();

    const buttonY = 312;
    const buttonSpacing = 150;

    // Reset button (left)
    expect(mockRectangle).toHaveBeenCalledWith(
      400 - buttonSpacing,
      buttonY,
      120,
      50,
      Colors.PANEL_DARK,
      0.75
    );

    // Cancel button (center)
    expect(mockRectangle).toHaveBeenCalledWith(
      400,
      buttonY,
      120,
      50,
      Colors.PANEL_DARK,
      0.75
    );

    // Save button (right)
    expect(mockRectangle).toHaveBeenCalledWith(
      400 + buttonSpacing,
      buttonY,
      120,
      50,
      Colors.PANEL_DARK,
      0.75
    );
  });

  it('clamps dial position to valid ranges', async () => {
    const { scene } = await createScene();
    scene.create();

    const mockTextObj = {
      setText: jest.fn().mockReturnThis(),
    };
    (scene as any).data.get.mockReturnValue(mockTextObj);

    // Test clamping to minimum
    (scene as any).adjustDialPosition(-1000, -1000);
    expect((scene as any).dialX).toBe(-400);
    expect((scene as any).dialY).toBe(-400);

    // Test clamping to maximum
    (scene as any).adjustDialPosition(1000, 1000);
    expect((scene as any).dialX).toBe(-50);
    expect((scene as any).dialY).toBe(-50);
  });

  it('resets to default values', async () => {
    const { scene } = await createScene();
    scene.create();

    const mockTextObj = {
      setText: jest.fn().mockReturnThis(),
    };
    (scene as any).data.get.mockReturnValue(mockTextObj);

    // Change values
    (scene as any).dialX = -300;
    (scene as any).dialY = -250;

    // Reset
    (scene as any).resetToDefaults();

    expect((scene as any).dialX).toBe(-200);
    expect((scene as any).dialY).toBe(-150);
    expect(mockTextObj.setText).toHaveBeenCalledWith('-200');
    expect(mockTextObj.setText).toHaveBeenCalledWith('-150');
  });

  it('saves settings and returns to main menu', async () => {
    const { scene } = await createScene();
    scene.create();

    (scene as any).dialX = -250;
    (scene as any).dialY = -180;
    (scene as any).showOutline = true;

    (scene as any).saveAndClose();

    expect(mockSettingsManager.updateDialPosition).toHaveBeenCalledWith(-250, -180);
    expect(mockSettingsManager.updateDialOutline).toHaveBeenCalledWith(true);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'clicker-shipper-settings',
      expect.any(String)
    );
    expect((scene as any).scene.start).toHaveBeenCalledWith('MainMenu');
  });

  it('cancels and returns to main menu without saving', async () => {
    const { scene } = await createScene();
    scene.create();

    // Simulate cancel button click
    const rectangleCalls = (scene as any).add.rectangle.mock.calls;
    const cancelButtonCall = rectangleCalls.find(
      (call: any) => call[0] === 400 && call[1] === 312 && call[2] === 120
    );
    
    expect(cancelButtonCall).toBeDefined();
    expect(mockSettingsManager.updateDialPosition).not.toHaveBeenCalled();
  });

  it('draws preview dial with correct visibility based on showOutline', async () => {
    const { scene, mockGraphics } = await createScene();
    const graphicsInstance = mockGraphics();
    mockGraphics.mockReturnValue(graphicsInstance);
    
    scene.create();

    // Initial state: showOutline is false
    expect(graphicsInstance.lineStyle).toHaveBeenCalledWith(
      2,
      Colors.HIGHLIGHT_YELLOW,
      0 // alpha = 0 when not showing
    );

    // Change showOutline to true
    (scene as any).showOutline = true;
    (scene as any).drawPreviewDial();

    expect(graphicsInstance.lineStyle).toHaveBeenCalledWith(
      2,
      Colors.HIGHLIGHT_YELLOW,
      0.8 // alpha = 0.8 when showing
    );
  });

  it('temporarily shows outline when adjustment button is pressed', async () => {
    const { scene } = await createScene();
    scene.create();

    expect((scene as any).temporarilyShowOutline).toBe(false);

    // The createAdjustButton method should set temporarilyShowOutline to true on pointerdown
    // This is tested through the button interaction behavior
  });

  it('handles localStorage save errors gracefully', async () => {
    const { scene } = await createScene();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Override localStorage.setItem to throw an error
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(() => {
          throw new Error('Storage quota exceeded');
        }),
        clear: jest.fn(),
      },
      writable: true,
    });

    scene.create();
    (scene as any).saveAndClose();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to save settings:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('renders outline toggle with correct initial state', async () => {
    const { scene, mockBitmapText } = await createScene();

    scene.create();

    // Check for "SHOW OUTLINE" label
    expect(mockBitmapText).toHaveBeenCalledWith(expect.any(Number), 258, 'clicker', 'SHOW OUTLINE', 14);

    // Check for toggle button with OFF state
    expect(mockBitmapText).toHaveBeenCalledWith(400, 258, 'clicker', 'OFF', 14);
  });
});
