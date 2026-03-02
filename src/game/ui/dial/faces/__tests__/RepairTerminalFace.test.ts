/** @jest-environment jsdom */
/**
 * Tests for RepairTerminalFace.
 *
 * Coverage goals:
 *   • Constructor stores currentRotationDeg and targetRotationDeg correctly
 *   • _diffFromTarget() computes angular distance to target (not to 0°)
 *   • repairSettled emits success:true only when within 10° of TARGET
 *   • Regression: target=90, current=90 → success (was broken before fix)
 *   • Regression: target=90, current=0  → failure (was erroneously success)
 *   • Wrap-around edge cases (e.g. 350° vs 10° = 20° apart)
 *   • onPointerDown activates drag only inside the ring zone
 *   • onPointerMove emits repairRotated and updates rotation
 *   • onPointerUp center-tap emits goBack
 *   • onPointerMove is a no-op when not active
 *   • second pointer is ignored while one is already tracked
 *   • destroy clears graphics and wobble timer
 */

jest.mock('phaser', () => ({}));

jest.mock('../../../../managers/AssetLoader', () => ({
  AssetLoader: {
    textureExists: jest.fn().mockReturnValue(false),
    getAtlasKey:   jest.fn().mockReturnValue(null),
  },
}));

jest.mock('../../../../constants/Colors', () => ({
  Colors: {
    PANEL_DARK:   0x111111,
    BORDER_BLUE:  0x3399cc,
    WHITE:        0xffffff,
  },
}));

import { RepairTerminalFace } from '../RepairTerminalFace';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Creates a minimal DialContext mock. Dial centred at (200, 200). */
function makeCtx() {
  const emitted: Array<{ type: string; [k: string]: any }> = [];

  const makeGfx = () => ({
    clear:       jest.fn().mockReturnThis(),
    fillStyle:   jest.fn().mockReturnThis(),
    fillCircle:  jest.fn().mockReturnThis(),
    lineStyle:   jest.fn().mockReturnThis(),
    strokeCircle: jest.fn().mockReturnThis(),
    setDepth:    jest.fn().mockReturnThis(),
    beginPath:   jest.fn().mockReturnThis(),
    arc:         jest.fn().mockReturnThis(),
    strokePath:  jest.fn().mockReturnThis(),
    moveTo:      jest.fn().mockReturnThis(),
    lineTo:      jest.fn().mockReturnThis(),
    closePath:   jest.fn().mockReturnThis(),
    destroy:     jest.fn(),
  });

  const timerHandle = { remove: jest.fn() };

  const ctx = {
    dialX:        200,
    dialY:        200,
    sliceRadius:  100,
    centerRadius:  30,
    glowAngle:      0,
    dialFrameGraphic: makeGfx(),
    centerGraphic:    makeGfx(),
    centerImage: {
      setTexture:     jest.fn().mockReturnThis(),
      setPosition:    jest.fn().mockReturnThis(),
      setAngle:       jest.fn().mockReturnThis(),
      setVisible:     jest.fn().mockReturnThis(),
      setDepth:       jest.fn().mockReturnThis(),
    },
    scene: {
      add: {
        graphics: jest.fn().mockImplementation(makeGfx),
      },
      time: {
        addEvent: jest.fn().mockReturnValue(timerHandle),
      },
    },
    emit: jest.fn((ev: any) => { emitted.push(ev); }),
  };

  return { ctx, emitted, timerHandle };
}

/** Builds a minimal MenuItem. */
function item(id = 'icon-alpha') {
  return { id, name: id, icon: id };
}

/**
 * Creates a pointer-shaped object at (x, y) for the default dial position (200, 200).
 * Pass `offsetX` / `offsetY` to place the pointer relative to the dial centre.
 */
function pointer(offsetX: number, offsetY: number = 0, pointerId = 1) {
  return { x: 200 + offsetX, y: 200 + offsetY, pointerId } as any;
}

/**
 * Performs the minimum hand sequence to trigger settlement:
 *   1. activate the face
 *   2. pointerDown on the ring (60px right of centre → distance 60, in range 38–92)
 *   3. pointerUp at the same point (zero drag delta → rotation unchanged)
 *
 * Returns whatever FaceEvents were emitted.
 */
function settle(face: RepairTerminalFace, ctx: ReturnType<typeof makeCtx>['ctx']) {
  face.activate(ctx as any);
  face.onPointerDown(pointer(60));
  face.onPointerUp(pointer(60));
  return ctx.emit.mock.calls.map((c: any[]) => c[0]);
}

// ── Constructor ─────────────────────────────────────────────────────────────

describe('RepairTerminalFace — constructor', () => {
  it('stores item reference', () => {
    const i = item('test-item');
    const face = new RepairTerminalFace(i, 45, 90);
    expect(face.item).toBe(i);
  });

  it('initialises isTriggerActive to false', () => {
    const face = new RepairTerminalFace(item(), 0, 0);
    expect(face.isTriggerActive).toBe(false);
  });
});

// ── _diffFromTarget() — via settlement ────────────────────────────────────

describe('RepairTerminalFace — success condition vs target rotation', () => {
  it('succeeds when current rotation equals target exactly', () => {
    const { ctx, emitted } = makeCtx();
    const face = new RepairTerminalFace(item(), 90, 90);
    settle(face, ctx);
    const ev = emitted.find(e => e.type === 'repairSettled');
    expect(ev).toBeDefined();
    expect(ev!.success).toBe(true);
  });

  it('succeeds when within 10° of target', () => {
    const { ctx, emitted } = makeCtx();
    const face = new RepairTerminalFace(item(), 96, 90);   // diff = 6°
    settle(face, ctx);
    expect(emitted.find(e => e.type === 'repairSettled')!.success).toBe(true);
  });

  it('succeeds at exactly 10° from target', () => {
    const { ctx, emitted } = makeCtx();
    const face = new RepairTerminalFace(item(), 100, 90);  // diff = 10°
    settle(face, ctx);
    expect(emitted.find(e => e.type === 'repairSettled')!.success).toBe(true);
  });

  it('fails when more than 10° from target', () => {
    const { ctx, emitted } = makeCtx();
    const face = new RepairTerminalFace(item(), 120, 90);  // diff = 30°
    settle(face, ctx);
    expect(emitted.find(e => e.type === 'repairSettled')!.success).toBe(false);
  });

  it('fails when current is far from target', () => {
    const { ctx, emitted } = makeCtx();
    const face = new RepairTerminalFace(item(), 0, 90);     // diff = 90°
    settle(face, ctx);
    expect(emitted.find(e => e.type === 'repairSettled')!.success).toBe(false);
  });

  // ── Regression tests ─────────────────────────────────────────────────────

  it('[regression] current=90,target=90 → SUCCESS (was FAIL before fix)', () => {
    // Before the fix the check was Math.abs(normalized) <= 10,
    // so current=90 with any target would fail (|90| > 10).
    const { ctx, emitted } = makeCtx();
    const face = new RepairTerminalFace(item(), 90, 90);
    settle(face, ctx);
    expect(emitted.find(e => e.type === 'repairSettled')!.success).toBe(true);
  });

  it('[regression] current=0,target=90 → FAILURE (was SUCCESS before fix)', () => {
    // Before the fix the check was Math.abs(normalized) <= 10,
    // so current=0 with target=90 would succeed (|0| <= 10) — a false positive.
    const { ctx, emitted } = makeCtx();
    const face = new RepairTerminalFace(item(), 0, 90);
    settle(face, ctx);
    expect(emitted.find(e => e.type === 'repairSettled')!.success).toBe(false);
  });

  it('[regression] target=0 still works (diff from 0°)', () => {
    // When target happens to be 0°, new behaviour should match old for current=5 (success)
    const { ctx, emitted } = makeCtx();
    const face = new RepairTerminalFace(item(), 5, 0);
    settle(face, ctx);
    expect(emitted.find(e => e.type === 'repairSettled')!.success).toBe(true);
  });

  // ── Wrap-around edge cases ────────────────────────────────────────────────

  it('handles wrap-around: 355° vs 5° → 10° apart → success', () => {
    // 355 normalises to -5 (inside -180…180 window), target = 5 → diff = 10 → success
    const { ctx, emitted } = makeCtx();
    const face = new RepairTerminalFace(item(), 355, 5);
    settle(face, ctx);
    expect(emitted.find(e => e.type === 'repairSettled')!.success).toBe(true);
  });

  it('handles wrap-around: 350° vs 10° → 20° apart → failure', () => {
    const { ctx, emitted } = makeCtx();
    const face = new RepairTerminalFace(item(), 350, 10);
    settle(face, ctx);
    expect(emitted.find(e => e.type === 'repairSettled')!.success).toBe(false);
  });

  it('handles negative current rotation: -90 vs target=270 → 0° apart → success', () => {
    // -90 % 360 normalises inside onPointerUp → -90 → diff from 270 = 360-90-270 wraps to 0
    // Actually: -90 % 360 = -90 (JS), normalized: -90 → already in range → stored as -90
    // diff = (-90 - 270) % 360 = -360 → wraps to 0 → success
    const { ctx, emitted } = makeCtx();
    // construct with 270 so normalization gives -90
    const face = new RepairTerminalFace(item(), 270, 270);
    settle(face, ctx);
    expect(emitted.find(e => e.type === 'repairSettled')!.success).toBe(true);
  });
});

// ── onPointerDown — ring zone gating ──────────────────────────────────────

describe('RepairTerminalFace — onPointerDown zone gating', () => {
  it('does NOT activate when pointer is inside the centre circle', () => {
    const { ctx } = makeCtx();
    // distance = 20, innerRing = 30 + 8 = 38 → too close
    const face = new RepairTerminalFace(item(), 90, 90);
    face.activate(ctx as any);
    face.onPointerDown(pointer(20));
    expect(face.isTriggerActive).toBe(false);
  });

  it('does NOT activate when pointer is outside the outer ring', () => {
    const { ctx } = makeCtx();
    // distance = 95, outerRing = 100 - 8 = 92 → too far
    const face = new RepairTerminalFace(item(), 90, 90);
    face.activate(ctx as any);
    face.onPointerDown(pointer(95));
    expect(face.isTriggerActive).toBe(false);
  });

  it('DOES activate when pointer is in the valid ring zone', () => {
    const { ctx } = makeCtx();
    // distance = 60, innerRing = 38, outerRing = 92 → valid
    const face = new RepairTerminalFace(item(), 90, 90);
    face.activate(ctx as any);
    face.onPointerDown(pointer(60));
    expect(face.isTriggerActive).toBe(true);
  });

  it('ignores a second pointer while one is already tracked', () => {
    const { ctx } = makeCtx();
    const face = new RepairTerminalFace(item(), 90, 90);
    face.activate(ctx as any);
    face.onPointerDown(pointer(60, 0, 1));   // first pointer activates
    face.onPointerDown(pointer(60, 0, 2));   // second pointer should be ignored
    // isTriggerActive stays true (not reset by second down)
    expect(face.isTriggerActive).toBe(true);
  });

  it('starts the wobble timer on a valid down', () => {
    const { ctx } = makeCtx();
    const face = new RepairTerminalFace(item(), 90, 90);
    face.activate(ctx as any);
    face.onPointerDown(pointer(60));
    expect((ctx.scene.time.addEvent as jest.Mock).mock.calls.length).toBeGreaterThan(0);
  });
});

// ── onPointerMove ──────────────────────────────────────────────────────────

describe('RepairTerminalFace — onPointerMove', () => {
  it('is a no-op when isTriggerActive is false', () => {
    const { ctx, emitted } = makeCtx();
    const face = new RepairTerminalFace(item(), 0, 0);
    face.activate(ctx as any);
    // don't do pointerDown first
    face.onPointerMove(pointer(70));
    expect(emitted.filter(e => e.type === 'repairRotated')).toHaveLength(0);
  });

  it('emits repairRotated after a drag has started', () => {
    const { ctx, emitted } = makeCtx();
    const face = new RepairTerminalFace(item(), 0, 0);
    face.activate(ctx as any);
    face.onPointerDown(pointer(60));
    // Move to a slightly different position
    face.onPointerMove(pointer(60, 10));
    expect(emitted.filter(e => e.type === 'repairRotated')).toHaveLength(1);
  });

  it('repairRotated carries a numeric rotation value', () => {
    const { ctx, emitted } = makeCtx();
    const face = new RepairTerminalFace(item(), 0, 0);
    face.activate(ctx as any);
    face.onPointerDown(pointer(60));
    face.onPointerMove(pointer(60, 10));
    const ev = emitted.find(e => e.type === 'repairRotated')!;
    expect(typeof ev.rotation).toBe('number');
  });
});

// ── onPointerUp — centre tap emits goBack ─────────────────────────────────

describe('RepairTerminalFace — onPointerUp centre tap', () => {
  it('emits goBack when tapping the centre circle without a drag', () => {
    const { ctx, emitted } = makeCtx();
    const face = new RepairTerminalFace(item(), 90, 90);
    face.activate(ctx as any);
    // Pointer within centerRadius (20 < 30)
    face.onPointerUp(pointer(20));
    expect(emitted.find(e => e.type === 'goBack')).toBeDefined();
  });

  it('does NOT emit goBack when tapping outside the centre and outside active drag', () => {
    const { ctx, emitted } = makeCtx();
    const face = new RepairTerminalFace(item(), 90, 90);
    face.activate(ctx as any);
    // tap in ring but no drag started → neither settled nor goBack
    face.onPointerUp(pointer(60));
    expect(emitted.find(e => e.type === 'goBack')).toBeUndefined();
    expect(emitted.find(e => e.type === 'repairSettled')).toBeUndefined();
  });
});

// ── Settlement once per gesture ────────────────────────────────────────────

describe('RepairTerminalFace — single settlement per gesture', () => {
  it('only fires repairSettled once even if onPointerUp is called twice', () => {
    const { ctx, emitted } = makeCtx();
    const face = new RepairTerminalFace(item(), 90, 90);
    face.activate(ctx as any);
    face.onPointerDown(pointer(60));
    face.onPointerUp(pointer(60));
    face.onPointerUp(pointer(60)); // second call — should be ignored
    expect(emitted.filter(e => e.type === 'repairSettled')).toHaveLength(1);
  });
});

// ── destroy / lifecycle ────────────────────────────────────────────────────

describe('RepairTerminalFace — lifecycle', () => {
  it('destroy removes the wobble timer if one is running', () => {
    const { ctx, timerHandle } = makeCtx();
    const face = new RepairTerminalFace(item(), 90, 90);
    face.activate(ctx as any);
    face.onPointerDown(pointer(60));   // starts timer
    face.destroy();
    expect(timerHandle.remove).toHaveBeenCalled();
  });

  it('does not throw when destroyed before activation', () => {
    const face = new RepairTerminalFace(item(), 90, 90);
    expect(() => face.destroy()).not.toThrow();
  });

  it('redraw is a no-op before activation (no ctx)', () => {
    const face = new RepairTerminalFace(item(), 90, 90);
    expect(() => face.redraw()).not.toThrow();
  });

  it('onPointerDown is a no-op before activation', () => {
    const face = new RepairTerminalFace(item(), 90, 90);
    expect(() => face.onPointerDown(pointer(60))).not.toThrow();
    expect(face.isTriggerActive).toBe(false);
  });
});
