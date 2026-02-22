export interface DialSettings {
  offsetX: number;
  offsetY: number;
  description?: string;
}

export interface UISettings {
  hudStripY: number;
  hudStripHeight: number;
}

export interface GameSettings {
  dial: DialSettings;
  ui: UISettings;
}

export class SettingsManager {
  private static instance: SettingsManager;
  private settings: GameSettings | null = null;

  private constructor() {}

  static getInstance(): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager();
    }
    return SettingsManager.instance;
  }

  async loadSettings(): Promise<void> {
    try {
      const response = await fetch('data/settings.json');
      if (!response.ok) {
        throw new Error(`Failed to load settings.json: ${response.statusText}`);
      }
      this.settings = await response.json();
    } catch (error) {
      console.error('Error loading settings:', error);
      // Use default settings if loading fails
      this.settings = {
        dial: { offsetX: -200, offsetY: -150 },
        ui: { hudStripY: 28, hudStripHeight: 40 }
      };
    }
  }

  getSettings(): GameSettings {
    if (!this.settings) {
      // Return defaults if settings haven't been loaded yet
      return {
        dial: { offsetX: -200, offsetY: -150 },
        ui: { hudStripY: 28, hudStripHeight: 40 }
      };
    }
    return this.settings;
  }

  getDialSettings(): DialSettings {
    return this.getSettings().dial;
  }

  getUISettings(): UISettings {
    return this.getSettings().ui;
  }

  updateDialPosition(offsetX: number, offsetY: number): void {
    if (this.settings) {
      this.settings.dial.offsetX = offsetX;
      this.settings.dial.offsetY = offsetY;
    }
  }
}
