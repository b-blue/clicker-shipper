import Phaser from 'phaser';
import { FaceEvent } from './FaceEvent';

/**
 * Read-only context injected into every IDialFace on activation.
 * Faces read shared geometry and shared Phaser display objects from here,
 * and fire events back to the coordinator via `emit`.
 */
export interface DialContext {
  readonly scene:            Phaser.Scene;
  readonly dialX:            number;
  readonly dialY:            number;
  readonly sliceRadius:      number;
  readonly centerRadius:     number;
  /** Shared outer-frame + divider-line graphic. Faces call .clear() then fill. */
  readonly dialFrameGraphic: Phaser.GameObjects.Graphics;
  /** Shared center-ring graphic. Faces call .clear() then fill. */
  readonly centerGraphic:    Phaser.GameObjects.Graphics;
  /** Shared persistent center icon image. */
  readonly centerImage:      Phaser.GameObjects.Image;
  /** Current angle of the ambient glow arc, updated by the coordinator's timer. */
  glowAngle: number;
  /** Fire an event back to the RadialDial coordinator. */
  emit(event: FaceEvent): void;
}
