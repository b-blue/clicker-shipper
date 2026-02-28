import Phaser from 'phaser';
import { toColorString, Colors } from './Colors';

/**
 * Font family constants used throughout the game UI.
 *
 * LABEL   → Minotaur: section headings, button labels, scene titles, item names, action names.
 * READOUT → Hack:     numeric readouts, Q-values, X/Y coordinates, stats counters, flash labels.
 */
export const Fonts = {
  LABEL:   'Minotaur',
  READOUT: 'Hack',
} as const;

export type TextStyle = Phaser.Types.GameObjects.Text.TextStyle;

/**
 * Global scale multiplier applied to every Minotaur (label) font size.
 * Increase to make all label text larger; decrease to shrink it.
 */
const LABEL_SCALE = 1.5;

/**
 * Returns a Phaser TextStyle for heading/label text (Minotaur).
 * @param size   Font size in pixels (before LABEL_SCALE is applied).
 * @param color  Hex color number (e.g. `Colors.HIGHLIGHT_YELLOW`). Defaults to white.
 */
export function labelStyle(size: number, color: number = Colors.WHITE): TextStyle {
  return {
    fontFamily: Fonts.LABEL,
    fontSize:   `${Math.round(size * LABEL_SCALE)}px`,
    color:      toColorString(color),
  };
}

/**
 * Returns a Phaser TextStyle for numeric readout text (Hack).
 * @param size   Font size in pixels.
 * @param color  Hex color number (e.g. `Colors.HIGHLIGHT_YELLOW_BRIGHT`). Defaults to white.
 */
export function readoutStyle(size: number, color: number = Colors.WHITE): TextStyle {
  return {
    fontFamily: Fonts.READOUT,
    fontSize:   `${size}px`,
    color:      toColorString(color),
  };
}
