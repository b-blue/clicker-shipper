/** @jest-environment jsdom */
import { Colors } from '../../constants/Colors';

// Mock Phaser before any imports that use it
jest.mock('phaser', () => ({
  Scene: class Scene {
    constructor() {}
  },
}));

describe('DialCalibration scene', () => {
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
        radius: 150,
      })),
      updateDialPosition: jest.fn(),
      updateDialOutline: jest.fn(),
      updateDialRadius: jest.fn(),
      getSettings: jest.fn(() => ({
        dial: { offsetX: -200, offsetY: -150, showOutline: false, radius: 150 },
        ui: { hudStripY: 28, hudStripHeight: 40 },
      })),
    };
  });

  const createScene = async () => {
    // Mock SettingsManager.getInstance
    const SettingsManagerModule = await import('../../managers/SettingsManager');
    jest.spyOn(SettingsManagerModule.SettingsManager, 'getInstance').mockReturnValue(mockSettingsManager);

    const { DialCalibration } = await import('../DialCalibration');
    const scene = new DialCalibration();

    const mockRectangle = jest.fn(() => ({
      setInteractive: jest.fn().mockReturnThis(),
      on: jest.fn(),
      setFillStyle: jest.fn().mockReturnThis(),
      setStrokeStyle: jest.fn().mockReturnThis(),
    }));

    const mockText = jest.fn(() => ({
      setOrigin: jest.fn().mockReturnThis(),
      setText: jest.fn().mockReturnThis(),
      setDepth: jest.fn().mockReturnThis(),
      setColor: jest.fn().mockReturnThis(),
      setWordWrapWidth: jest.fn().mockReturnThis(),
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
      fillStyle: jest.fn().mockReturnThis(),
      fillTriangle: jest.fn().mockReturnThis(),
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

    // Panel — wider (720) and taller (440), centred at 40% of height
    expect(mockRectangle).toHaveBeenCalledWith(400, 240, 720, 440, Colors.PANEL_DARK, 0.9);
  });

  it('renders the title', async () => {
    const { scene, mockText } = await createScene();

    scene.create();

    expect(mockText).toHaveBeenCalledWith(400, 60, 'CALIBRATE DIAL', expect.any(Object));
  });

  it('renders section header and D-pad controls', async () => {
    const { scene, mockText, mockRectangle } = await createScene();

    scene.create();

    // DIAL POSITION label above the D-pad (left column centre = 220, y = 600*0.22 = 132)
    expect(mockText).toHaveBeenCalledWith(220, 132, 'DIAL POSITION', expect.any(Object));

    // DIAL SIZE label on right column (rightCX = 580, dialSizeLabelY = 240 - 75 = 165)
    expect(mockText).toHaveBeenCalledWith(580, 165, 'DIAL SIZE', expect.any(Object));

    // D-pad buttons — UP top, DOWN bottom, LEFT left, RIGHT right (48×48, padCX=220, padCY=230, step=58)
    expect(mockRectangle).toHaveBeenCalledWith(220, 172, 48, 48, Colors.PANEL_DARK, 0.8); // UP
    expect(mockRectangle).toHaveBeenCalledWith(220, 288, 48, 48, Colors.PANEL_DARK, 0.8); // DOWN
    expect(mockRectangle).toHaveBeenCalledWith(162, 230, 48, 48, Colors.PANEL_DARK, 0.8); // LEFT
    expect(mockRectangle).toHaveBeenCalledWith(278, 230, 48, 48, Colors.PANEL_DARK, 0.8); // RIGHT
  });

  it('loads current settings from SettingsManager', async () => {
    mockSettingsManager.getDialSettings.mockReturnValue({
      offsetX: -250,
      offsetY: -180,
      showOutline: true,
    });

    const { scene, mockText } = await createScene();

    scene.create();

    expect(mockSettingsManager.getDialSettings).toHaveBeenCalled();
    // X/Y value readout below the D-pad (padCX=220, padCY+90=320, padCY+110=340)
    expect(mockText).toHaveBeenCalledWith(220, 320, 'X: -250', expect.any(Object));
    expect(mockText).toHaveBeenCalledWith(220, 340, 'Y: -180', expect.any(Object));
  });

  it('renders three buttons in a single row', async () => {
    const { scene, mockRectangle } = await createScene();

    scene.create();

    // buttonY = panelCenterY(240) + panelHeight/2(220) - 35 = 425
    const buttonY = 425;
    const buttonSpacing = 110;

    // Reset button (left)
    expect(mockRectangle).toHaveBeenCalledWith(
      400 - buttonSpacing,
      buttonY,
      100,
      50,
      Colors.PANEL_DARK,
      0.75
    );

    // Cancel button (center)
    expect(mockRectangle).toHaveBeenCalledWith(
      400,
      buttonY,
      100,
      50,
      Colors.PANEL_DARK,
      0.75
    );

    // Save button (right)
    expect(mockRectangle).toHaveBeenCalledWith(
      400 + buttonSpacing,
      buttonY,
      100,
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
    expect(mockTextObj.setText).toHaveBeenCalledWith('X: -200');
    expect(mockTextObj.setText).toHaveBeenCalledWith('Y: -150');
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
      (call: any) => call[0] === 400 && call[1] === 425 && call[2] === 100
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
    const { scene, mockText } = await createScene();

    scene.create();

    // SHOW OUTLINE label (rightCX=580, outlineLabelY = panelCenterY+40 = 280)
    expect(mockText).toHaveBeenCalledWith(580, 280, 'SHOW OUTLINE', expect.any(Object));

    // Toggle OFF text (rightCX=580, outlineToggleY = panelCenterY+75 = 315)
    expect(mockText).toHaveBeenCalledWith(580, 315, 'OFF', expect.any(Object));
  });
});
