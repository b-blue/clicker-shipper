/**
 * Color palette for the game's holographic/cyberpunk UI theme
 */
export const Colors = {
  // Background colors
  BACKGROUND_DARK: 0x0a1022,
  PANEL_DARK: 0x0b1c3a,
  PANEL_MEDIUM: 0x0b1f3a,
  
  // UI accent colors
  HIGHLIGHT_YELLOW: 0xffd54a,
  HIGHLIGHT_YELLOW_BRIGHT: 0xfff2a8,
  LIGHT_BLUE: 0x8fd4ff,
  NEON_BLUE: 0x4aa3ff,
  
  // Button colors
  BUTTON_DARK: 0x102a52,
  BUTTON_HOVER: 0x122a52,
  
  // Dial slice colors
  SLICE_NORMAL: 0x1a4d7c,
  SLICE_HIGHLIGHTED: 0x3a7bc8,
  SLICE_DARK: 0x0f274d,
  
  // Border/line colors
  BORDER_BLUE: 0x1c3e6b,
  BORDER_LIGHT_BLUE: 0x4a6a90,
  
  // Pure colors
  WHITE: 0xffffff,
  BLACK: 0x000000,
} as const;

export type ColorValue = typeof Colors[keyof typeof Colors];
