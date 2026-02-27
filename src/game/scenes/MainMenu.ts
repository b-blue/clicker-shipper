import { toColorString } from '../constants/Colors';
import { Colors } from '../constants/Colors';
import { ParallaxBackground } from '../ui/ParallaxBackground';

const ARTIFACT_COLLECTIONS = ['root', 'alpha', 'beta'] as const;
const ARTIFACT_FRAMES = 20;

export class MainMenu extends Phaser.Scene {
  private bg: ParallaxBackground | null = null;

  constructor() {
    super('MainMenu');
  }

  create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // ── Parallax background — random set + time-of-day ────────────────────
    const setNum = Math.floor(Math.random() * 8) + 1;
    const tod: 'day' | 'night' = Math.random() < 0.5 ? 'day' : 'night';
    this.bg = new ParallaxBackground(this, 0, 0, W, H, setNum, tod);
    // Tiles are already added to the scene by ParallaxBackground (depths 1–5).

    // ── Upper 2/5: animated artifact ──────────────────────────────────────
    const topCY = H * 0.2;
    const collection = ARTIFACT_COLLECTIONS[Math.floor(Math.random() * ARTIFACT_COLLECTIONS.length)];
    const n = Math.floor(Math.random() * ARTIFACT_FRAMES) + 1;
    const animKey = `artifact-${collection}-${n}`;

    const artifact = this.add.sprite(W / 2, topCY, animKey);
    const maxSize = Math.round(H * 0.4 * 0.80);
    artifact.setDisplaySize(maxSize, maxSize).setDepth(10);
    if (this.anims.exists(animKey)) artifact.play(animKey);

    // ── Lower 3/5: buttons, centred in that zone ──────────────────────────
    const botZoneTop    = H * 0.4;
    const botZoneHeight = H * 0.6;
    const botCY         = botZoneTop + botZoneHeight / 2;
    const buttonSpacing = 70;
    const firstY        = botCY - buttonSpacing * 1.5;

    this.createButton(W / 2, firstY,                    'START SHIFT',    () => this.punchIn());
    this.createButton(W / 2, firstY + buttonSpacing,    'UPGRADES',       () => this.openUpgrades());
    this.createButton(W / 2, firstY + buttonSpacing * 2,'CALIBRATE DIAL', () => this.openSettings());
    this.createButton(W / 2, firstY + buttonSpacing * 3,'EXIT',           () => this.exitGame());

    // Keyboard shortcut unchanged
    this.input.keyboard?.on('keydown-SPACE', () => this.punchIn());

    // ── Scroll update ─────────────────────────────────────────────────────
    this.events.on('update', (_time: number, delta: number) => this.bg?.update(delta), this);
    this.events.once('shutdown', () => {
      this.bg = null;
    }, this);
  }

  private createButton(x: number, y: number, text: string, callback: () => void, colorHex: string = toColorString(Colors.HIGHLIGHT_YELLOW)): void {
    const buttonWidth = 200;
    const buttonHeight = 50;

    const buttonBg = this.add.rectangle(x, y, buttonWidth, buttonHeight, Colors.PANEL_DARK, 0.75);
    buttonBg.setDepth(10).setInteractive();
    buttonBg.on('pointerdown', callback);
    buttonBg.on('pointerover', () => buttonBg.setFillStyle(Colors.BUTTON_HOVER, 0.9));
    buttonBg.on('pointerout',  () => buttonBg.setFillStyle(Colors.PANEL_DARK, 0.75));

    const color = parseInt(colorHex.replace('#', ''), 16);
    this.add.rectangle(x, y, buttonWidth, buttonHeight).setStrokeStyle(2, color).setDepth(11);
    this.add.rectangle(x, y, buttonWidth - 10, 28, Colors.PANEL_MEDIUM, 0.8).setDepth(12);
    this.add.bitmapText(x, y, 'clicker', text, 13).setOrigin(0.5).setDepth(13);
  }

  punchIn()      { this.scene.start('Game'); }
  openUpgrades() { this.scene.start('EndShift', { revenue: 0, bonus: 0 }); }
  openSettings() { this.scene.start('DialCalibration'); }
  exitGame()     { window.location.href = '/'; }
}

