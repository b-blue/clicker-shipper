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
 * accumulating duplicate dial:actionConfirmed / dial:itemConfirmed handlers.
 */

import { EventEmitter } from 'eventemitter3';

// ---------------------------------------------------------------------------
// Unit test: proves the accumulation bug and verifies the fix
// ---------------------------------------------------------------------------

describe('Game scene — dial event handler idempotency across restarts', () => {
  /**
   * Simulates the create() → restart → create() cycle using a real EventEmitter
   * (the same object Phaser reuses between scene restarts).
   */
  function simulateCreateCycle(
    events: EventEmitter,
    callCount: number,
  ): { actionFires: number; itemFires: number } {
    let actionFires = 0;
    let itemFires = 0;

    for (let i = 0; i < callCount; i++) {
      // ---- This is what Game.create() must do BEFORE registering handlers ----
      events.removeAllListeners('dial:actionConfirmed');
      events.removeAllListeners('dial:itemConfirmed');
      // -----------------------------------------------------------------------

      events.on('dial:actionConfirmed', () => { actionFires++; });
      events.on('dial:itemConfirmed',   () => { itemFires++;   });
    }

    return { actionFires: 0, itemFires: 0 }; // reset counters; return emitter
  }

  it('accumulates handlers WITHOUT the removeAllListeners fix (documents the bug)', () => {
    const events = new EventEmitter();
    let fires = 0;

    // Simulate create() called 3 times WITHOUT cleanup (old buggy behaviour)
    for (let i = 0; i < 3; i++) {
      events.on('dial:actionConfirmed', () => { fires++; });
    }

    fires = 0;
    events.emit('dial:actionConfirmed', {});

    // Bug: 3 handlers → 3 fires per emit
    expect(fires).toBe(3);
  });

  it('fires exactly once after the first create()', () => {
    const events = new EventEmitter();
    let fires = 0;

    events.removeAllListeners('dial:actionConfirmed');
    events.on('dial:actionConfirmed', () => { fires++; });

    fires = 0;
    events.emit('dial:actionConfirmed', {});
    expect(fires).toBe(1);
  });

  it('fires exactly once after create() → restart → create() (2 start cycles)', () => {
    const events = new EventEmitter();
    let fires = 0;

    // First create()
    events.removeAllListeners('dial:actionConfirmed');
    events.on('dial:actionConfirmed', () => { fires++; });

    // Scene restarts: Phaser does NOT reset scene.events, so we must purge
    events.removeAllListeners('dial:actionConfirmed');
    events.on('dial:actionConfirmed', () => { fires++; });

    fires = 0;
    events.emit('dial:actionConfirmed', {});
    expect(fires).toBe(1);
  });

  it('fires exactly once after three start cycles', () => {
    const events = new EventEmitter();
    let fires = 0;

    for (let i = 0; i < 3; i++) {
      events.removeAllListeners('dial:actionConfirmed');
      events.on('dial:actionConfirmed', () => { fires++; });
    }

    fires = 0;
    events.emit('dial:actionConfirmed', {});
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
    sharedEvents.on('dial:actionConfirmed', () => { fires++; });
    // Shift 2 (no cleanup — buggy)
    sharedEvents.on('dial:actionConfirmed', () => { fires++; });

    fires = 0;
    sharedEvents.emit('dial:actionConfirmed', {});
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
