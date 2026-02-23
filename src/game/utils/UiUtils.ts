/** Assumed ratio of character width to font size for the bitmap font. */
export const FONT_CHAR_RATIO = 0.6;

/**
 * Returns the largest integer font size that fits `text` within `availableWidth`
 * without exceeding `maxSize`. Has no Phaser dependency so it can be unit-tested directly.
 */
export function fitFontSize(text: string, availableWidth: number, maxSize: number): number {
  const maxByWidth = Math.floor(availableWidth / (text.length * FONT_CHAR_RATIO));
  return Math.min(maxSize, Math.max(8, maxByWidth));
}
