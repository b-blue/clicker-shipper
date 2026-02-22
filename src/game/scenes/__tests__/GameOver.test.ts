/** @jest-environment jsdom */

describe('GameOver scene', () => {
  beforeAll(() => {
    (global as any).Phaser = { Scene: class {} };
  });

  it('renders the game over text', async () => {
    const { GameOver } = await import('../GameOver');
    const scene = new GameOver();
    const setOrigin = jest.fn().mockReturnThis();
    const setTint = jest.fn().mockReturnThis();
    const bitmapText = jest.fn(() => ({ setOrigin, setTint }));

    (scene as any).add = { bitmapText };

    scene.create({});

    expect(bitmapText).toHaveBeenCalledWith(400, 300, 'clicker', 'GAME OVER', 24);
    expect(setOrigin).toHaveBeenCalledWith(0.5);
  });
});
