/** @jest-environment jsdom */
/**
 * Tests for RepairPanel.onItemFailed:
 *   • Explosion sprite spawned at icon position when anim key exists
 *   • play() called with an explosion-tiny-{1..3} key
 *   • animationcomplete listener wired for self-destruction
 *   • No explosion spawned when anim key is absent
 *   • badgeRing Graphics created and tween started
 *   • badgeRing NOT re-created if already present on the RepairItem
 */

jest.mock('phaser', () => ({}));

jest.mock('../../../managers/AssetLoader', () => ({
  AssetLoader: { getAtlasKey: jest.fn(() => null) },
}));

jest.mock('../../../repair/DroneStage', () => ({
  DroneStage: class {
    setTopBounds = jest.fn();
    pickKey      = jest.fn();
    spawn        = jest.fn();
    exit         = jest.fn((_cb: () => void) => _cb());
    destroy      = jest.fn();
    getCurrentKey = jest.fn(() => 'drone-1-idle');
    iconCountForCurrentKey = jest.fn(() => 4);
    getSprite    = jest.fn(() => null);
  },
}));

jest.mock('../../ParallaxBackground', () => ({
  ParallaxBackground: class {
    build  = jest.fn();
    update = jest.fn();
    destroy = jest.fn();
  },
}));

jest.mock('../../../constants/Colors', () => ({
  Colors: {
    HIGHLIGHT_YELLOW: 0xffdd44,
    PANEL_DARK:       0x111111,
  },
}));

jest.mock('../../../constants/FontStyle', () => ({
  readoutStyle: {},
}));

import { RepairPanel } from '../RepairPanel';
import { RepairSession } from '../../../repair/RepairSession';

// ── Scene factory ────────────────────────────────────────────────────────────

function makeRepairItem(iconKey = 'test-icon', hasBadgeRing = false) {
  const spriteMock = {
    setScale: jest.fn().mockReturnThis(),
    setDepth: jest.fn().mockReturnThis(),
    play:     jest.fn().mockReturnThis(),
    destroy:  jest.fn(),
    once:     jest.fn(),
    x: 0, y: 0,
  };

  const graphicsMock = () => ({
    clear:       jest.fn(),
    lineStyle:   jest.fn(),
    strokeCircle: jest.fn(),
    fillStyle:   jest.fn(),
    fillCircle:  jest.fn(),
    arc:         jest.fn(),
    strokePath:  jest.fn(),
    setDepth:    jest.fn().mockReturnThis(),
    setPosition: jest.fn().mockReturnThis(),
    destroy:     jest.fn(),
    angle: 0,
  });

  return {
    iconKey,
    startRotationDeg: 0,
    targetRotationDeg: 45,
    currentRotationDeg: 0,
    solved: false,
    requiresReplace: false,
    iconObj: {
      x: 100,
      y: 200,
      displayWidth: 48,
      alpha: 1,
    },
    frameObj:  graphicsMock(),
    bgObj:     graphicsMock(),
    badgeBg:   graphicsMock(),
    badgeIcon: {
      setTexture: jest.fn(),
      setAlpha:   jest.fn(),
    },
    badgeRing: hasBadgeRing ? graphicsMock() : undefined,
    // sprite is the internal sprite reference returned by add.sprite
    _spriteMock: spriteMock,
  };
}

function makeScene(animExists = true) {
  const spriteMock = {
    setScale: jest.fn().mockReturnThis(),
    setDepth: jest.fn().mockReturnThis(),
    play:     jest.fn().mockReturnThis(),
    destroy:  jest.fn(),
    once:     jest.fn(),
    x: 0, y: 0,
  };

  const gfxMock = {
    clear:       jest.fn(),
    lineStyle:   jest.fn(),
    strokeCircle: jest.fn(),
    fillStyle:   jest.fn(),
    fillCircle:  jest.fn(),
    arc:         jest.fn(),
    strokePath:  jest.fn(),
    setDepth:    jest.fn().mockReturnThis(),
    setPosition: jest.fn().mockReturnThis(),
    destroy:     jest.fn(),
    angle: 0,
  };

  const scene = {
    events: {
      on:   jest.fn(),
      off:  jest.fn(),
      emit: jest.fn(),
    },
    tweens: {
      add: jest.fn(),
    },
    anims: {
      exists: jest.fn(() => animExists),
    },
    add: {
      sprite:   jest.fn(() => spriteMock),
      graphics: jest.fn(() => gfxMock),
    },
  };

  return { scene, spriteMock, gfxMock };
}

function makeSession(items: ReturnType<typeof makeRepairItem>[]) {
  return {
    task: {
      getItems: jest.fn(() => items),
    },
  } as unknown as RepairSession;
}

// ── Helper to call the private method ────────────────────────────────────────

function fireItemFailed(panel: RepairPanel, iconKey: string) {
  (panel as any).onItemFailed({ iconKey });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RepairPanel.onItemFailed — explosion effect', () => {
  it('spawns a sprite at the icon position when the anim key exists', () => {
    const { scene, spriteMock } = makeScene(true);
    const panel = new RepairPanel(scene as any, {} as any);
    const item = makeRepairItem('my-icon');
    panel.setSession(makeSession([item]));

    fireItemFailed(panel, 'my-icon');

    expect(scene.add.sprite).toHaveBeenCalledWith(
      item.iconObj.x,
      item.iconObj.y,
      expect.stringMatching(/^explosion-tiny-[123]$/),
    );
    expect(spriteMock.play).toHaveBeenCalledWith(
      expect.stringMatching(/^explosion-tiny-[123]$/),
    );
  });

  it('calls setScale and setDepth on the spawned explosion sprite', () => {
    const { scene, spriteMock } = makeScene(true);
    const panel = new RepairPanel(scene as any, {} as any);
    const item = makeRepairItem('icon-a');
    panel.setSession(makeSession([item]));

    fireItemFailed(panel, 'icon-a');

    expect(spriteMock.setScale).toHaveBeenCalled();
    expect(spriteMock.setDepth).toHaveBeenCalledWith(30);
  });

  it('wires animationcomplete for self-destruction', () => {
    const { scene, spriteMock } = makeScene(true);
    const panel = new RepairPanel(scene as any, {} as any);
    const item = makeRepairItem('icon-b');
    panel.setSession(makeSession([item]));

    fireItemFailed(panel, 'icon-b');

    expect(spriteMock.once).toHaveBeenCalledWith(
      'animationcomplete',
      expect.any(Function),
    );

    // Invoking the callback should call destroy()
    const cb = (spriteMock.once as jest.Mock).mock.calls[0][1] as () => void;
    cb();
    expect(spriteMock.destroy).toHaveBeenCalled();
  });

  it('does NOT spawn a sprite when the anim key does not exist', () => {
    const { scene } = makeScene(false);  // anims.exists returns false
    const panel = new RepairPanel(scene as any, {} as any);
    const item = makeRepairItem('icon-c');
    panel.setSession(makeSession([item]));

    fireItemFailed(panel, 'icon-c');

    expect(scene.add.sprite).not.toHaveBeenCalled();
  });

  it('does nothing when no item matches the given iconKey', () => {
    const { scene } = makeScene(true);
    const panel = new RepairPanel(scene as any, {} as any);
    panel.setSession(makeSession([makeRepairItem('other-icon')]));

    fireItemFailed(panel, 'no-such-icon');

    expect(scene.add.sprite).not.toHaveBeenCalled();
    expect(scene.add.graphics).not.toHaveBeenCalled();
  });

  it('does nothing when there is no active session', () => {
    const { scene } = makeScene(true);
    const panel = new RepairPanel(scene as any, {} as any);
    // No setSession call

    expect(() => fireItemFailed(panel, 'icon-x')).not.toThrow();
    expect(scene.add.sprite).not.toHaveBeenCalled();
  });
});

describe('RepairPanel.onItemFailed — badge ring', () => {
  it('creates a Graphics badge ring when badgeRing is undefined', () => {
    const { scene, gfxMock } = makeScene(false);  // disable explosion to isolate gfx
    const panel = new RepairPanel(scene as any, {} as any);
    const item = makeRepairItem('icon-ring');
    panel.setSession(makeSession([item]));

    fireItemFailed(panel, 'icon-ring');

    expect(scene.add.graphics).toHaveBeenCalled();
    expect(gfxMock.lineStyle).toHaveBeenCalled();
    expect(gfxMock.arc).toHaveBeenCalled();
    expect(gfxMock.strokePath).toHaveBeenCalled();
  });

  it('starts a rotation tween on the badge ring', () => {
    const { scene } = makeScene(false);
    const panel = new RepairPanel(scene as any, {} as any);
    const item = makeRepairItem('icon-ring2');
    panel.setSession(makeSession([item]));

    fireItemFailed(panel, 'icon-ring2');

    const tweenCall = (scene.tweens.add as jest.Mock).mock.calls.find(
      (c: any[]) => c[0].angle === 360,
    );
    expect(tweenCall).toBeDefined();
    expect(tweenCall![0].repeat).toBe(-1);
  });

  it('assigns the created Graphics to ri.badgeRing', () => {
    const { scene } = makeScene(false);
    const panel = new RepairPanel(scene as any, {} as any);
    const item = makeRepairItem('icon-ring3');
    panel.setSession(makeSession([item]));

    fireItemFailed(panel, 'icon-ring3');

    expect(item.badgeRing).toBeDefined();
  });

  it('does NOT create a new ring if badgeRing is already set', () => {
    const { scene } = makeScene(false);
    const panel = new RepairPanel(scene as any, {} as any);
    const item = makeRepairItem('icon-ring4', true /* hasBadgeRing = true */);
    panel.setSession(makeSession([item]));

    fireItemFailed(panel, 'icon-ring4');

    expect(scene.add.graphics).not.toHaveBeenCalled();
  });
});
