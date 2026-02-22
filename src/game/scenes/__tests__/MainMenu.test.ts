/** @jest-environment jsdom */
import { Colors } from '../../constants/Colors';

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

    (scene as any).add = {
      rectangle,
      text,
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

    return { scene, rectangle, text, keyboardOn };
  };

  it('renders the background and title', async () => {
    const { scene, rectangle, text } = await createScene();

    scene.create();

    expect(rectangle).toHaveBeenCalledWith(400, 300, 800, 600, Colors.BACKGROUND_DARK);
    expect(text).toHaveBeenCalledWith(
      400,
      90,
      'INTERGALACTIC SHIPPER',
      expect.objectContaining({ fontSize: '48px' })
    );
  });

  it('wires keyboard shortcuts', async () => {
    const { scene, keyboardOn } = await createScene();

    scene.create();

    expect(keyboardOn).toHaveBeenCalledWith('keydown-SPACE', expect.any(Function));
    expect(keyboardOn).toHaveBeenCalledWith('keydown-M', expect.any(Function));
  });

  it('starts the game from punchIn', async () => {
    const { scene } = await createScene();

    scene.punchIn();

    expect((scene as any).scene.start).toHaveBeenCalledWith('Game');
  });

  it('launches the manual from openManual', async () => {
    const { scene } = await createScene();

    scene.openManual();

    expect((scene as any).scene.launch).toHaveBeenCalledWith('ItemManual');
  });
});
