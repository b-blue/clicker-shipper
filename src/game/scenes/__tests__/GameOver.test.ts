/** @jest-environment jsdom */

describe('GameOver scene', () => {
  beforeAll(() => {
    (global as any).Phaser = { Scene: class {} };
  });

  it('renders the game over text', async () => {
    const { GameOver } = await import('../GameOver');
    const scene = new GameOver();
    const setOrigin = jest.fn().mockReturnThis();
    const text = jest.fn(() => ({ setOrigin }));

    (scene as any).add = { text };

    scene.create({});

    expect(text).toHaveBeenCalledWith(
      400,
      300,
      'Game Over - Stats will appear here',
      { fontSize: '24px', color: '#ffd54a' }
    );
    expect(setOrigin).toHaveBeenCalledWith(0.5);
  });
});
