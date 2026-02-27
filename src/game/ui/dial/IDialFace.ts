import Phaser from 'phaser';
import { DialContext } from './DialContext';

/**
 * Common interface for all dial faces.
 *
 * Lifecycle:
 *   new Face(...)  →  activate(ctx)  →  [redraw / pointer events]
 *                 →  deactivate()    ← covered by a child face (non-destructive)
 *                 →  activate(ctx)   ← re-exposed after child is popped
 *                 →  destroy()       ← permanently removed
 *
 * Each face owns its per-frame Phaser objects (slice graphics, arc fills, etc.)
 * and cleans them up in destroy(). Shared objects (dialFrameGraphic, centerImage)
 * are accessed via the DialContext and must NOT be destroyed by a face.
 */
export interface IDialFace {
  /** Called each time this face becomes (or returns to) the top of the stack. */
  activate(context: DialContext): void;
  /** Called when a child face is pushed above this one. Non-destructive. */
  deactivate(): void;
  /** Permanently tear down all Phaser objects owned by this face. */
  destroy(): void;
  /** Re-render current state (called by glow timer and after input changes). */
  redraw(): void;
  onPointerMove(pointer: Phaser.Input.Pointer): void;
  onPointerDown(pointer: Phaser.Input.Pointer): void;
  onPointerUp(pointer:   Phaser.Input.Pointer): void;
}
