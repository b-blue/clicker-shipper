/** @jest-environment jsdom */
import { Colors } from '../../constants/Colors';
import { fitFontSize } from '../../utils/UiUtils';

describe('MainMenu scene', () => {
  beforeAll(() => {
    (global as any).Phaser = { Scene: class {} };
  });

  const createScene = async () => {
    const { MainMenu } = await import('../MainMenu');
    const scene = new MainMenu();

    const rectangle = jest.fn(() => ({
      setInteractive: jest.fn(),
      on: jest.fn(),
      setFillStyle: jest.fn(),
      setStrokeStyle: jest.fn(),
    }));
    const text = jest.fn(() => ({
      setOrigin: jest.fn().mockReturnThis(),
    }));
    const bitmapText = jest.fn(() => ({
      setOrigin: jest.fn().mockReturnThis(),
      setTint: jest.fn().mockReturnThis(),
      setMaxWidth: jest.fn().mockReturnThis(),
    }));

    (scene as any).add = {
      rectangle,
      text,
      bitmapText,
    };

    const keyboardOn = jest.fn();
    (scene as any).input = {
      keyboard: {
        on: keyboardOn,
      },
    };

    (scene as any).cameras = {
      main: {
        width: 800,
        height: 600,
      },
    };

    (scene as any).scene = {
      start: jest.fn(),
      launch: jest.fn(),
    };

    return { scene, rectangle, text, bitmapText, keyboardOn };
  };

  it('renders the background and title', async () => {
    const { scene, rectangle, bitmapText } = await createScene();

    scene.create();

    expect(rectangle).toHaveBeenCalledWith(400, 300, 800, 600, Colors.BACKGROUND_DARK);
    // At 800px width the title should use full max size (32)
    expect(bitmapText).toHaveBeenCalledWith(400, expect.any(Number), 'clicker', 'CHIBA CITY SHIPPER', expect.any(Number));
  });

  it('wires keyboard shortcuts', async () => {
    const { scene, keyboardOn } = await createScene();

    scene.create();

    expect(keyboardOn).toHaveBeenCalledWith('keydown-SPACE', expect.any(Function));
  });

  it('starts the game from punchIn', async () => {
    const { scene } = await createScene();

    scene.punchIn();

    expect((scene as any).scene.start).toHaveBeenCalledWith('Game');
  });

});
describe('fitFontSize', () => {
  const CHAR_RATIO = 0.6;

  describe('desktop viewport (800px)', () => {
    const availableWidth = 800 - 20; // 780

    it('uses full max size for title when viewport is wide enough', () => {
      const size = fitFontSize('CHIBA CITY SHIPPER', availableWidth, 32);
      expect(size).toBe(32);
    });

    it('uses full max size for subtitle when viewport is wide enough', () => {
      const size = fitFontSize('ORDER FULFILLMENT TERMINAL', availableWidth, 16);
      expect(size).toBe(16);
    });

    it('uses full max size for footer when viewport is wide enough', () => {
      const size = fitFontSize('PRESS SPACE TO START SHIFT', availableWidth, 12);
      expect(size).toBe(12);
    });
  });

  describe('mobile viewport (375px)', () => {
    const availableWidth = 375 - 20; // 355

    it('title fits within mobile viewport', () => {
      const text = 'CHIBA CITY SHIPPER';
      const size = fitFontSize(text, availableWidth, 32);
      expect(size * text.length * CHAR_RATIO).toBeLessThanOrEqual(availableWidth);
    });

    it('subtitle fits within mobile viewport', () => {
      const text = 'ORDER FULFILLMENT TERMINAL';
      const size = fitFontSize(text, availableWidth, 16);
      expect(size * text.length * CHAR_RATIO).toBeLessThanOrEqual(availableWidth);
    });

    it('footer fits within mobile viewport', () => {
      const text = 'PRESS SPACE TO START SHIFT';
      const size = fitFontSize(text, availableWidth, 12);
      expect(size * text.length * CHAR_RATIO).toBeLessThanOrEqual(availableWidth);
    });

    it('title font size is smaller than desktop', () => {
      const mobile = fitFontSize('CHIBA CITY SHIPPER', 375 - 40, 32);
      const desktop = fitFontSize('CHIBA CITY SHIPPER', 800 - 40, 32);
      expect(mobile).toBeLessThan(desktop);
    });
  });

  describe('edge cases', () => {
    it('never returns less than 8', () => {
      expect(fitFontSize('A VERY LONG STRING THAT DOES NOT FIT', 40, 32)).toBe(8);
    });

    it('respects maxSize cap', () => {
      expect(fitFontSize('HI', 1000, 14)).toBe(14);
    });

    it('handles single character', () => {
      const size = fitFontSize('A', 100, 32);
      expect(size).toBe(32); // 100 / (1 * 0.6) = 166, capped at 32
    });
  });
});