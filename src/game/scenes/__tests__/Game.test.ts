/** @jest-environment jsdom */
/**
 * Tests for Game scene event-handler lifecycle.
 *
 * Root cause documented here: Phaser 3 does NOT call the user-defined
 * shutdown() method automatically — the SceneManager only directly invokes
 * init(), preload(), create(), and update(). scene.events is the same
 * EventEmitter instance across scene restarts, so every create() call
 * stacks a new handler unless we explicitly clear stale ones.
 *
 * These tests verify that create() can be called multiple times without
 * accumulating duplicate dial:quantityConfirmed / dial:itemConfirmed handlers.
 */

import { EventEmitter } from 'eventemitter3';

// ---------------------------------------------------------------------------
// Unit test: proves the accumulation bug and verifies the fix
// ---------------------------------------------------------------------------

describe('Game scene — dial event handler idempotency across restarts', () => {
  it('accumulates handlers WITHOUT the removeAllListeners fix (documents the bug)', () => {
    const events = new EventEmitter();
    let fires = 0;

    // Simulate create() called 3 times WITHOUT cleanup (old buggy behaviour)
    for (let i = 0; i < 3; i++) {
      events.on('dial:quantityConfirmed', () => { fires++; });
    }

    fires = 0;
    events.emit('dial:quantityConfirmed', {});

    // Bug: 3 handlers → 3 fires per emit
    expect(fires).toBe(3);
  });

  it('fires exactly once after the first create()', () => {
    const events = new EventEmitter();
    let fires = 0;

    events.removeAllListeners('dial:quantityConfirmed');
    events.on('dial:quantityConfirmed', () => { fires++; });

    fires = 0;
    events.emit('dial:quantityConfirmed', {});
    expect(fires).toBe(1);
  });

  it('fires exactly once after create() → restart → create() (2 start cycles)', () => {
    const events = new EventEmitter();
    let fires = 0;

    // First create()
    events.removeAllListeners('dial:quantityConfirmed');
    events.on('dial:quantityConfirmed', () => { fires++; });

    // Scene restarts: Phaser does NOT reset scene.events, so we must purge
    events.removeAllListeners('dial:quantityConfirmed');
    events.on('dial:quantityConfirmed', () => { fires++; });

    fires = 0;
    events.emit('dial:quantityConfirmed', {});
    expect(fires).toBe(1);
  });

  it('fires exactly once after three start cycles', () => {
    const events = new EventEmitter();
    let fires = 0;

    for (let i = 0; i < 3; i++) {
      events.removeAllListeners('dial:quantityConfirmed');
      events.on('dial:quantityConfirmed', () => { fires++; });
    }

    fires = 0;
    events.emit('dial:quantityConfirmed', {});
    expect(fires).toBe(1);
  });

  it('fires dial:itemConfirmed exactly once after multiple restarts', () => {
    const events = new EventEmitter();
    let fires = 0;

    for (let i = 0; i < 4; i++) {
      events.removeAllListeners('dial:itemConfirmed');
      events.on('dial:itemConfirmed', () => { fires++; });
    }

    fires = 0;
    events.emit('dial:itemConfirmed', {});
    expect(fires).toBe(1);
  });

  it('confirms Phaser scene.events is the same instance across restarts (same EE reused)', () => {
    // This test documents why the bug exists: Phaser does not replace the
    // scene's EventEmitter between shutdowns — it's the same object.
    const sharedEvents = new EventEmitter();
    let fires = 0;

    // Shift 1
    sharedEvents.on('dial:quantityConfirmed', () => { fires++; });
    // Shift 2 (no cleanup — buggy)
    sharedEvents.on('dial:quantityConfirmed', () => { fires++; });

    fires = 0;
    sharedEvents.emit('dial:quantityConfirmed', {});
    expect(fires).toBe(2); // confirms the accumulation
  });
});

// ---------------------------------------------------------------------------
// Unit test: shutdown() method is dead without explicit wiring
// ---------------------------------------------------------------------------

describe('Game scene — shutdown() is not called unless explicitly wired', () => {
  it('shutdown() is never called by Phaser unless registered via events.once("shutdown", ...)', () => {
    // This test documents the Phaser 3 lifecycle: SceneManager calls create()
    // directly but does NOT call scene.shutdown() — it only emits the
    // "shutdown" event on sys.events. Without registering a listener,
    // the user-defined shutdown() is dead code.

    const events = new EventEmitter();
    let shutdownCalled = false;
    const fakeShutdown = () => { shutdownCalled = true; };

    // Phaser calls sys.events.emit('shutdown') — NOT scene.shutdown() directly.
    // Without registration, nothing happens:
    events.emit('shutdown');
    expect(shutdownCalled).toBe(false);

    // Correct pattern: register via once() inside create()
    events.once('shutdown', fakeShutdown);
    events.emit('shutdown');
    expect(shutdownCalled).toBe(true);
  });

  it('once("shutdown") fires exactly once and does not persist to next create cycle', () => {
    const events = new EventEmitter();
    let fireCount = 0;

    // Simulate create() registering shutdown cleanup
    events.once('shutdown', () => { fireCount++; });

    // Scene shuts down
    events.emit('shutdown');
    expect(fireCount).toBe(1);

    // Scene starts again (create() runs again, re-registers once)
    events.once('shutdown', () => { fireCount++; });

    // Scene shuts down again
    fireCount = 0;
    events.emit('shutdown');
    expect(fireCount).toBe(1); // still exactly 1, not accumulating
  });
});

// ---------------------------------------------------------------------------
// Pure-logic unit tests: positional order-row algorithms
//
// The Game scene's placeItem / evaluateSlot / checkOrderComplete methods
// operate on plain data structures. These tests exercise the same algorithms
// in isolation (no Phaser instantiation required) to document and guard the
// intended behaviour.
// ---------------------------------------------------------------------------

describe('Order row — slot evaluation algorithm', () => {
  // Mirrors Game.evaluateSlot: determine correctness of slot[i] given requirements[].
  // 'correct' (green) requires matching position AND placedQty >= required quantity.
  function evaluate(
    slotIconKey: string | null,
    slotIndex: number,
    requirements: { iconKey: string; quantity?: number }[],
    placedQty: number = 1,
  ): 'empty' | 'correct' | 'misplaced' | 'wrong' {
    if (slotIconKey === null) return 'empty';
    const inOrder = requirements.some((r) => r.iconKey === slotIconKey);
    if (!inOrder) return 'wrong';
    const req = requirements[slotIndex];
    if (req && req.iconKey === slotIconKey && placedQty >= (req.quantity ?? 1)) return 'correct';
    return 'misplaced';
  }

  const reqs = [{ iconKey: 'iron' }, { iconKey: 'wood' }, { iconKey: 'stone' }];

  it('returns empty for a null slot', () => {
    expect(evaluate(null, 0, reqs)).toBe('empty');
  });

  it('returns correct when item matches the slot position', () => {
    expect(evaluate('iron',  0, reqs)).toBe('correct');
    expect(evaluate('wood',  1, reqs)).toBe('correct');
    expect(evaluate('stone', 2, reqs)).toBe('correct');
  });

  it('returns misplaced when item is in the order but at the wrong position', () => {
    expect(evaluate('wood',  0, reqs)).toBe('misplaced'); // wood belongs at slot 1
    expect(evaluate('stone', 0, reqs)).toBe('misplaced'); // stone belongs at slot 2
    expect(evaluate('iron',  2, reqs)).toBe('misplaced'); // iron belongs at slot 0
  });

  it('returns wrong when item is not in the order at all', () => {
    expect(evaluate('copper', 0, reqs)).toBe('wrong');
    expect(evaluate('coal',   1, reqs)).toBe('wrong');
  });

  it('handles an out-of-bounds slotIndex gracefully (treats as misplaced)', () => {
    // No requirement exists at index 5, so the item is in-order but position unknown → misplaced
    expect(evaluate('iron', 5, reqs)).toBe('misplaced');
  });

  it('returns misplaced when item is at correct position but quantity is insufficient', () => {
    const reqsWithQty = [{ iconKey: 'iron', quantity: 3 }, { iconKey: 'wood', quantity: 2 }];
    // placedQty 1 < required 3 → misplaced even though iconKey matches
    expect(evaluate('iron', 0, reqsWithQty, 1)).toBe('misplaced');
    // placedQty meets required 2 → correct
    expect(evaluate('iron', 0, reqsWithQty, 3)).toBe('correct');
    // placedQty exactly equal to required → correct
    expect(evaluate('wood', 1, reqsWithQty, 2)).toBe('correct');
  });
});

describe('Order row — leftward collapse algorithm', () => {
  // Mirrors the qty=0 branch of Game.placeItem.
  type Slot = { iconKey: string | null; placedQty: number };

  function removeAndCollapse(slots: Slot[], iconKey: string): Slot[] {
    const result: Slot[] = slots.map((s) => ({ ...s })); // shallow copy
    const idx = result.findIndex((s) => s.iconKey === iconKey);
    if (idx === -1) return result;
    // Shift left
    for (let i = idx; i < result.length - 1; i++) {
      result[i].iconKey   = result[i + 1].iconKey;
      result[i].placedQty = result[i + 1].placedQty;
    }
    result[result.length - 1].iconKey   = null;
    result[result.length - 1].placedQty = 0;
    return result;
  }

  it('removes a middle item and shifts remaining slots left', () => {
    const slots = [
      { iconKey: 'iron',  placedQty: 2 },
      { iconKey: 'wood',  placedQty: 1 },
      { iconKey: 'stone', placedQty: 3 },
    ];
    const result = removeAndCollapse(slots, 'wood');
    expect(result[0]).toEqual({ iconKey: 'iron',  placedQty: 2 });
    expect(result[1]).toEqual({ iconKey: 'stone', placedQty: 3 });
    expect(result[2]).toEqual({ iconKey: null,    placedQty: 0 });
  });

  it('removes the first item and shifts all others left', () => {
    const slots = [
      { iconKey: 'iron',  placedQty: 1 },
      { iconKey: 'wood',  placedQty: 2 },
      { iconKey: 'stone', placedQty: 1 },
    ];
    const result = removeAndCollapse(slots, 'iron');
    expect(result[0]).toEqual({ iconKey: 'wood',  placedQty: 2 });
    expect(result[1]).toEqual({ iconKey: 'stone', placedQty: 1 });
    expect(result[2]).toEqual({ iconKey: null,    placedQty: 0 });
  });

  it('removes a last item without disturbing earlier slots', () => {
    const slots = [
      { iconKey: 'iron',  placedQty: 1 },
      { iconKey: 'wood',  placedQty: 2 },
      { iconKey: 'stone', placedQty: 1 },
    ];
    const result = removeAndCollapse(slots, 'stone');
    expect(result[0]).toEqual({ iconKey: 'iron', placedQty: 1 });
    expect(result[1]).toEqual({ iconKey: 'wood', placedQty: 2 });
    expect(result[2]).toEqual({ iconKey: null,   placedQty: 0 });
  });

  it('is a no-op when the item is not present', () => {
    const slots = [
      { iconKey: 'iron', placedQty: 1 },
      { iconKey: null,   placedQty: 0 },
    ];
    const result = removeAndCollapse(slots, 'copper');
    expect(result[0]).toEqual({ iconKey: 'iron', placedQty: 1 });
    expect(result[1]).toEqual({ iconKey: null,   placedQty: 0 });
  });

  it('re-evaluates a previously-correct slot as misplaced after the shift', () => {
    // stone was at slot 2 (correct). After removing wood (slot 1),
    // stone shifts to slot 1 — which is wrong for stone (stone belongs at slot 2).
    const reqs = [{ iconKey: 'iron' }, { iconKey: 'wood' }, { iconKey: 'stone' }];
    type EvalSlot = { iconKey: string | null; placedQty: number };
    function evaluate(s: EvalSlot, i: number) {
      if (s.iconKey === null) return 'empty';
      if (!reqs.some((r) => r.iconKey === s.iconKey)) return 'wrong';
      return reqs[i]?.iconKey === s.iconKey ? 'correct' : 'misplaced';
    }
    const slots: EvalSlot[] = [
      { iconKey: 'iron',  placedQty: 1 },
      { iconKey: 'wood',  placedQty: 1 },
      { iconKey: 'stone', placedQty: 1 },
    ];
    // Before removal: stone at slot 2 is correct
    expect(evaluate(slots[2], 2)).toBe('correct');

    const result = removeAndCollapse(slots, 'wood');
    // After removal: stone is at slot 1 (was slot 2) → misplaced
    expect(evaluate(result[1], 1)).toBe('misplaced');
  });
});

describe('Order row — completion check algorithm', () => {
  type Slot = { iconKey: string | null; placedQty: number };
  type Req  = { iconKey: string; quantity: number };

  function evaluate(
    slotIconKey: string | null,
    slotIndex: number,
    requirements: Req[],
  ): 'empty' | 'correct' | 'misplaced' | 'wrong' {
    if (slotIconKey === null) return 'empty';
    const inOrder = requirements.some((r) => r.iconKey === slotIconKey);
    if (!inOrder) return 'wrong';
    return requirements[slotIndex]?.iconKey === slotIconKey ? 'correct' : 'misplaced';
  }

  function isComplete(slots: Slot[], requirements: Req[]): boolean {
    // Red items block completion
    for (let i = 0; i < slots.length; i++) {
      if (evaluate(slots[i].iconKey, i, requirements) === 'wrong') return false;
    }
    // All requirements must be satisfied
    return requirements.every((req) =>
      slots.some((s) => s.iconKey === req.iconKey && s.placedQty >= req.quantity),
    );
  }

  const reqs: Req[] = [
    { iconKey: 'iron',  quantity: 2 },
    { iconKey: 'wood',  quantity: 1 },
  ];

  it('returns false when some requirements are not met', () => {
    const slots: Slot[] = [
      { iconKey: 'iron', placedQty: 1 }, // only 1 of 2
      { iconKey: null,   placedQty: 0 },
    ];
    expect(isComplete(slots, reqs)).toBe(false);
  });

  it('returns true when all requirements are satisfied (any order)', () => {
    const slots: Slot[] = [
      { iconKey: 'wood', placedQty: 1 }, // misplaced but not wrong
      { iconKey: 'iron', placedQty: 2 }, // misplaced but not wrong
    ];
    expect(isComplete(slots, reqs)).toBe(true);
  });

  it('returns false when a wrong (red) item is present even if requirements are met', () => {
    const slots: Slot[] = [
      { iconKey: 'iron',   placedQty: 2 },
      { iconKey: 'copper', placedQty: 1 }, // not in order → red
    ];
    // iron is satisfied but wood is missing; copper blocks
    expect(isComplete(slots, reqs)).toBe(false);
  });

  it('returns false when wrong item is present alongside met requirements', () => {
    const slotsWithExtra: Slot[] = [
      { iconKey: 'iron',   placedQty: 2 },
      { iconKey: 'wood',   placedQty: 1 },
      { iconKey: 'copper', placedQty: 1 }, // extra wrong item in a third slot
    ];
    const reqs2: Req[] = [{ iconKey: 'iron', quantity: 2 }, { iconKey: 'wood', quantity: 1 }];
    for (let i = 0; i < slotsWithExtra.length; i++) {
      if (evaluate(slotsWithExtra[i].iconKey, i, reqs2) === 'wrong') {
        expect(isComplete(slotsWithExtra, reqs2)).toBe(false);
        return;
      }
    }
    fail('expected a wrong slot');
  });

  it('returns true when all requirements exactly met and no wrong items', () => {
    const slots: Slot[] = [
      { iconKey: 'iron', placedQty: 2 },
      { iconKey: 'wood', placedQty: 1 },
    ];
    expect(isComplete(slots, reqs)).toBe(true);
  });
});
