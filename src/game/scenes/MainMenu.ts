import { toColorString } from '../constants/Colors';
import { Colors } from '../constants/Colors';
import { labelStyle } from '../constants/FontStyle';
import { ParallaxBackground } from '../ui/ParallaxBackground';
import { fitFontSize } from '../utils/UiUtils';

const ARTIFACT_FRAMES = 20;
const SCROLL_SPEED = 55;  // px per second

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

    // ── Upper 2/5: two scrolling rows of artifacts ─────────────────────────────────
    // Alpha row scrolls right, beta row scrolls left.
    const spriteSize = Math.round(H * 0.08);          // ¼ of the old single-sprite size
    const gap        = Math.round(spriteSize * 0.4);
    const step       = spriteSize + gap;
    const totalW     = ARTIFACT_FRAMES * step;        // full wrap width

    const makeRow = (collection: 'alpha' | 'beta', y: number) => {
      const sprs: Phaser.GameObjects.Sprite[] = [];
      for (let n = 1; n <= ARTIFACT_FRAMES; n++) {
        const key = `artifact-${collection}-${n}`;
        const spr = this.add.sprite((n - 1) * step + spriteSize / 2, y, key);
        spr.setDisplaySize(spriteSize, spriteSize).setDepth(10);
        if (this.anims.exists(key)) spr.play(key);
        sprs.push(spr);
      }
      return sprs;
    };

    const scrollRow = (sprs: Phaser.GameObjects.Sprite[], dx: number) => {
      for (const spr of sprs) {
        spr.x += dx;
        if (dx > 0 && spr.x >  W + spriteSize / 2) spr.x -= totalW;
        if (dx < 0 && spr.x < -spriteSize / 2)     spr.x += totalW;
      }
    };

    const alphaRow = makeRow('alpha', H * 0.12);
    const betaRow  = makeRow('beta',  H * 0.27);

    // ── Title between the two rows ────────────────────────────────────────
    const titleText = 'CYBERPUNKINGTON';
    const titleSize = fitFontSize(titleText, W - 40, 24);
    this.add.text(W / 2, H * 0.195, titleText, labelStyle(titleSize))
      .setOrigin(0.5)
      .setDepth(11);

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

    // ── Update: parallax scroll + artifact rows ────────────────────────────────
    this.events.on('update', (_time: number, delta: number) => {
      this.bg?.update(delta);
      const dx = SCROLL_SPEED * delta / 1000;
      scrollRow(alphaRow,  dx);
      scrollRow(betaRow,  -dx);
    }, this);
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
    this.add.text(x, y, text, labelStyle(13)).setOrigin(0.5).setDepth(13);
  }

  punchIn()      { this.scene.start('Game'); }
  openUpgrades() { this.scene.start('EndShift', { revenue: 0, bonus: 0 }); }
  openSettings() { this.scene.start('DialCalibration'); }
  exitGame()     { window.location.href = '/'; }
}

