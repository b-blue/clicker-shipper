/** @jest-environment jsdom */
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
      setStrokeStyle: jest.fn().mockReturnThis(),
      setDepth: jest.fn().mockReturnThis(),
    }));
    const bitmapText = jest.fn(() => ({
      setOrigin: jest.fn().mockReturnThis(),
      setTint: jest.fn().mockReturnThis(),
      setDepth: jest.fn().mockReturnThis(),
    }));
    const tileSprite = jest.fn(() => ({
      setOrigin: jest.fn().mockReturnThis(),
      setTileScale: jest.fn().mockReturnThis(),
      setDepth: jest.fn().mockReturnThis(),
      setMask: jest.fn().mockReturnThis(),
    }));
    const sprite = jest.fn(() => ({
      setDisplaySize: jest.fn().mockReturnThis(),
      setDepth: jest.fn().mockReturnThis(),
      play: jest.fn().mockReturnThis(),
    }));

    (scene as any).add = {
      rectangle,
      bitmapText,
      tileSprite,
      sprite,
      existing: jest.fn(),
    };

    (scene as any).textures = {
      exists: jest.fn().mockReturnValue(true),
      get: jest.fn(() => ({ source: [{ width: 100, height: 100 }] })),
    };

    (scene as any).anims = {
      exists: jest.fn().mockReturnValue(true),
    };

    const eventsOn   = jest.fn();
    const eventsOnce = jest.fn();
    (scene as any).events = { on: eventsOn, once: eventsOnce };

    const keyboardOn = jest.fn();
    (scene as any).input = { keyboard: { on: keyboardOn } };

    (scene as any).cameras = { main: { width: 800, height: 600 } };
    (scene as any).scene   = { start: jest.fn(), launch: jest.fn() };

    return { scene, rectangle, bitmapText, sprite, keyboardOn };
  };

  it('displays the game title CYBERPUNKINGTON', async () => {
    const { scene, bitmapText } = await createScene();

    scene.create();

    const labels: string[] = bitmapText.mock.calls.map((c: any[]) => c[3]);
    expect(labels).toContain('CYBERPUNKINGTON');
  });

  it('creates buttons for all four main menu options', async () => {
    const { scene, bitmapText } = await createScene();

    scene.create();

    const labels: string[] = bitmapText.mock.calls.map((c: any[]) => c[3]);
    expect(labels).toContain('START SHIFT');
    expect(labels).toContain('UPGRADES');
    expect(labels).toContain('CALIBRATE DIAL');
    expect(labels).toContain('EXIT');
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
      const size = fitFontSize('CYBERPUNK SHIPPER', availableWidth, 32);
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
      const text = 'CYBERPUNK SHIPPER';
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
      const mobile = fitFontSize('CYBERPUNK CITY SHIPPER', 375 - 40, 32);
      const desktop = fitFontSize('CYBERPUNK CITY SHIPPER', 800 - 40, 32);
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