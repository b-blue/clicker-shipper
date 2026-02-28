import Phaser from 'phaser';
import { Colors } from '../../constants/Colors';
import { readoutStyle } from '../../constants/FontStyle';
import { DroneStage } from '../../repair/DroneStage';
import { RepairSession } from '../../repair/RepairSession';
import { TaskBounds } from '../../repair/IRepairTask';
import { ParallaxBackground } from '../ParallaxBackground';
import { AssetLoader } from '../../managers/AssetLoader';

const STAGGER_MS       = 80;    // ms between each item fade
const FADE_DUR         = 260;   // ms per individual fade
const REPAIRED_HOLD_MS = 1400;  // ms "DRONE REPAIRED" is visible

/**
 * Builds the REPAIR tab visual structure:
 * - Top 2/5:  drone stage  — parallax scrolling background + drone sprite
 * - Bottom 3/5: diagnostic panel (scanlines, corner brackets, icon grid via ReOrientMode)
 *
 * A random background variant (1 of 16: sets 1–8 × Day/Night) is selected once when
 * the scene is created and scrolls continuously behind the drone.
 *
 * NOTE: buildArrangement() is NOT called here; it is called from Game.populateRepairPools
 * after the item pool has been assigned and a drone key has been pre-selected.
 */
export class RepairPanel {
  private scene: Phaser.Scene;
  private droneStage: DroneStage;
  private scanG: Phaser.GameObjects.Graphics | null = null;
  private bgMaskGfx: Phaser.GameObjects.Graphics | null = null;
  private bg: ParallaxBackground | null = null;
  private scanOffset: number = 0;
  private scanLeft: number = 0;
  private scanTop: number = 0;
  private scanWidth: number = 0;
  private scanBotH: number = 0;

  // ── Session state ─────────────────────────────────────────────────────
  private activeSession: RepairSession | null = null;
  private taskContainer: Phaser.GameObjects.Container | null = null;
  private taskBounds: TaskBounds | null = null;

  constructor(scene: Phaser.Scene, droneStage: DroneStage) {
    this.scene      = scene;
    this.droneStage = droneStage;
  }

  build(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const topH  = height * 2 / 5;
    const botH  = height * 3 / 5;
    const topCX = x;
    const topCY = y + topH / 2;
    const topLeft = x - width / 2;
    const topTop  = y;         // topCY - topH/2
    const botCX = x;
    const botCY = y + topH + botH / 2;

    // Bezel geometry — declared early so setBotBounds can use inner content area.
    const B    = 14;   // top / bottom bar height (extends beyond the screen rect)
    const sW   = 30;   // side bar width — 22 px overlap each side hides display edges
    const ext  = 8;    // how far bezel protrudes beyond the screen rect left/right
    const rail = 14;   // mid-rail height

    // Pass bounds to sub-systems.
    // taskBounds receives the *inner* content area — inset past the side bars
    // (sW − ext = 22 px each side) and the mid-rail overlap (rail/2 = 7 px at top).
    const sideInset = sW - ext;     // 22 px each side
    const topInset  = rail / 2;     //  7 px at top (half the mid-rail)
    this.droneStage.setTopBounds({ cx: topCX, cy: topCY, w: width, h: topH });
    this.taskContainer = container;
    this.taskBounds = {
      cx: botCX,
      cy: botCY + topInset / 2,
      w:  width - 2 * sideInset,
      h:  botH  - topInset,
    };

    // ── Top: dark fallback fill (visible when BG textures are missing) ────
    const topBg = this.scene.add.rectangle(topCX, topCY, width, topH, Colors.PANEL_DARK, 0.85);
    topBg.setStrokeStyle(1, Colors.BORDER_BLUE, 0.5);
    container.add(topBg);

    // ── Top: parallax background ──────────────────────────────────────────
    // Pick one of the 16 variants randomly at scene-create time.
    const choice = Math.floor(Math.random() * 16);
    const setNum = (choice % 8) + 1;
    const tod: 'day' | 'night' = choice < 8 ? 'day' : 'night';

    // Geometry mask to clip tiles to the top area.
    const maskGfx = this.scene.add.graphics();
    maskGfx.fillStyle(0xffffff, 1);
    maskGfx.fillRect(topLeft, topTop, width, topH);
    maskGfx.setVisible(false);
    this.bgMaskGfx = maskGfx;
    const bgMask = maskGfx.createGeometryMask();

    const bg = new ParallaxBackground(this.scene, topLeft, topTop, width, topH, setNum, tod);
    this.bg = bg;
    for (const tile of bg.tiles) {
      tile.setMask(bgMask);
      container.add(tile);          // behind botBg, scanlines, divider, and drone
    }

    // ── Bottom: diagnostic panel ──────────────────────────────────────────
    const botBg = this.scene.add.rectangle(botCX, botCY, width, botH, Colors.PANEL_DARK, 0.4);
    botBg.setStrokeStyle(1, Colors.BORDER_BLUE, 0.35);

    // Animated scanlines — stored so onUpdate can redraw them each frame
    this.scanLeft  = botCX - width / 2;
    this.scanTop   = botCY - botH / 2;
    this.scanWidth = width;
    this.scanBotH  = botH;

    const scanG = this.scene.add.graphics();
    this.scanG = scanG;
    this.drawScanlines();

    container.add([botBg, scanG]);
    this.scene.events.on('update', this.onUpdate, this);

    // Spawn the drone — apply the viewport mask so the sprite is clipped to the
    // top area during enter/exit tweens, preventing bleed onto tabs and other UI.
    this.droneStage.spawn(container, () => this.materialize(), bgMask);

    // ── Bezel — solid chunky frame laid over the entire repair screen ────────
    // Drawn last so it always renders above drone, BG tiles and scanlines.
    // Five filled pieces: top bar · bottom bar · left side · right side · mid rail.
    const right  = topLeft + width;
    const bottom = topTop  + height;
    const divY   = topTop  + topH;

    const bL  = topLeft - ext;           // left edge of bezel
    const bR  = right   + ext;           // right edge of bezel
    const bW  = width   + ext * 2;       // bezel total width
    const bTopY = topTop - B;            // top edge of bezel
    // right side-bar left edge (sW - ext pixels overlap into the screen)
    const rBarX = right - (sW - ext);
    // inner screen-facing edges of side bars
    const lInner = topLeft + (sW - ext);
    const rInner = right   - (sW - ext);

    const BODY = Colors.PANEL_MEDIUM;
    const HL   = Colors.BORDER_LIGHT_BLUE;
    const YEL  = Colors.HIGHLIGHT_YELLOW;

    const bezelG = this.scene.add.graphics();

    // ── 1. Filled body pieces ─────────────────────────────────────────────
    bezelG.fillStyle(BODY, 1);

    // Top bar — B px above the screen + 1 px overlap onto top edge
    bezelG.fillRoundedRect(bL, bTopY, bW, B + 1, { tl: 7, tr: 7, bl: 0, br: 0 });

    // Bottom bar — 1 px overlap onto bottom edge + B px below
    bezelG.fillRoundedRect(bL, bottom - 1, bW, B + 1, { tl: 0, tr: 0, bl: 7, br: 7 });

    // Left side — upper segment (screen top → above mid rail)
    bezelG.fillRect(bL,    topTop + 1,        sW, topH - 1 - rail / 2);
    // Left side — lower segment (below mid rail → screen bottom)
    bezelG.fillRect(bL,    divY + rail / 2,   sW, botH - rail / 2 - 1);

    // Right side — mirrors of left
    bezelG.fillRect(rBarX, topTop + 1,        sW, topH - 1 - rail / 2);
    bezelG.fillRect(rBarX, divY + rail / 2,   sW, botH - rail / 2 - 1);

    // Mid rail — full bezel width, merges seamlessly with both side bars
    bezelG.fillRect(bL, divY - rail / 2, bW, rail);

    // ── 2. Outer border — single rounded stroke around the whole frame ─────
    bezelG.lineStyle(2, Colors.BORDER_BLUE, 1);
    bezelG.strokeRoundedRect(bL - 1, bTopY - 1, bW + 2, B * 2 + height + 2, 9);

    // ── 3. Inner edge highlights — lighter lines on screen-facing faces ────
    bezelG.lineStyle(1, HL, 0.75);
    // Bottom of top bar
    bezelG.lineBetween(bL, topTop + 1, bR, topTop + 1);
    // Top of bottom bar
    bezelG.lineBetween(bL, bottom - 2, bR, bottom - 2);
    // Right edge of left side bar (both segments)
    bezelG.lineBetween(lInner, topTop + 1,      lInner, divY - rail / 2);
    bezelG.lineBetween(lInner, divY + rail / 2, lInner, bottom - 2);
    // Left edge of right side bar (both segments)
    bezelG.lineBetween(rInner, topTop + 1,      rInner, divY - rail / 2);
    bezelG.lineBetween(rInner, divY + rail / 2, rInner, bottom - 2);
    // Top face of mid rail (catch-light running its full width)
    bezelG.lineBetween(bL, divY - rail / 2 + 1, bR, divY - rail / 2 + 1);
    // Bottom face of mid rail
    bezelG.lineBetween(bL, divY + rail / 2 - 1, bR, divY + rail / 2 - 1);
    // Top face of top bar (outer catch-light)
    bezelG.lineStyle(1, HL, 0.35);
    bezelG.lineBetween(bL + 8, bTopY + 1, bR - 8, bTopY + 1);

    // ── 4. Corner L-bracket accents ───────────────────────────────────────
    const cL = 9;   // arm length
    const cI = 4;   // inset from outer corner
    bezelG.lineStyle(2, YEL, 0.75);
    // top-left
    bezelG.lineBetween(bL + cI, bTopY + cI, bL + cI + cL, bTopY + cI);
    bezelG.lineBetween(bL + cI, bTopY + cI, bL + cI,      bTopY + cI + cL);
    // top-right
    bezelG.lineBetween(bR - cI, bTopY + cI, bR - cI - cL, bTopY + cI);
    bezelG.lineBetween(bR - cI, bTopY + cI, bR - cI,      bTopY + cI + cL);
    // bottom-left
    bezelG.lineBetween(bL + cI, bottom + B - cI, bL + cI + cL, bottom + B - cI);
    bezelG.lineBetween(bL + cI, bottom + B - cI, bL + cI,      bottom + B - cI - cL);
    // bottom-right
    bezelG.lineBetween(bR - cI, bottom + B - cI, bR - cI - cL, bottom + B - cI);
    bezelG.lineBetween(bR - cI, bottom + B - cI, bR - cI,      bottom + B - cI - cL);

    // ── 5. Mid-rail centre notch — series of tick lines along the rail ────
    const mx = topLeft + width / 2;
    bezelG.lineStyle(1, YEL, 0.55);
    bezelG.lineBetween(mx - 14, divY,     mx + 14, divY);
    bezelG.lineBetween(mx -  9, divY - 3, mx +  9, divY - 3);
    bezelG.lineBetween(mx -  9, divY + 3, mx +  9, divY + 3);

    // ── 6. Rivet dots at the side-bar / mid-rail junctions ────────────────
    const rV  = 2.5;
    const lRX = bL     + sW / 2;   // x-centre of left rivets
    const rRX = rBarX  + sW / 2;   // x-centre of right rivets
    bezelG.fillStyle(HL, 0.75);
    bezelG.fillCircle(lRX, divY - 5, rV);
    bezelG.fillCircle(lRX, divY + 5, rV);
    bezelG.fillCircle(rRX, divY - 5, rV);
    bezelG.fillCircle(rRX, divY + 5, rV);

    container.add(bezelG);

    this.scene.events.on('repair:itemFailed', this.onItemFailed, this);
  }

  destroy(): void {
    this.scene.events.off('update', this.onUpdate, this);
    this.scene.events.off('repair:itemFailed', this.onItemFailed, this);
    this.bg?.destroy();
    this.bg = null;
    this.bgMaskGfx?.destroy();
    this.bgMaskGfx = null;
    this.scanG?.destroy();
    this.scanG = null;
  }

  // ── Session / animation API ────────────────────────────────────────

  /** Store the new session so materialize/dematerialize can access its items. */
  setSession(session: RepairSession): void {
    this.activeSession = session;
  }

  /**
   * Called when `repair:itemFailed` fires.  Dims the icon, recolours the frame
   * in warning amber, and swaps the badge to the replace (skill-recycle) icon.
   */
  private onItemFailed(data: { iconKey: string }): void {
    const items = this.activeSession?.task.getItems() ?? [];
    const ri = items.find(r => r.iconKey === data.iconKey);
    if (!ri) return;

    // Dim the icon
    this.scene.tweens.add({
      targets: ri.iconObj,
      alpha: 0.3,
      duration: 250,
      ease: 'Sine.easeIn',
    });

    // Redraw frame in amber
    ri.frameObj.clear();
    ri.frameObj.lineStyle(2, Colors.HIGHLIGHT_YELLOW, 0.85);
    const r = Math.round(ri.iconObj.displayWidth / 2) + 2;
    ri.frameObj.strokeCircle(ri.iconObj.x, ri.iconObj.y, r);

    // Redraw badge bg in yellow
    const bR   = Math.round(r * 0.56);
    const bCx  = ri.iconObj.x + r * 0.62;
    const bCy  = ri.iconObj.y + r * 0.62;
    ri.badgeBg.clear();
    ri.badgeBg.fillStyle(Colors.PANEL_DARK, 0.95);
    ri.badgeBg.fillCircle(bCx, bCy, bR);
    ri.badgeBg.lineStyle(1, Colors.HIGHLIGHT_YELLOW, 0.9);
    ri.badgeBg.strokeCircle(bCx, bCy, bR);

    // Swap badge icon to skill-recycle
    const iconKey = 'skill-recycle';
    const atlasKey = AssetLoader.getAtlasKey(iconKey);
    if (atlasKey) {
      ri.badgeIcon.setTexture(atlasKey, iconKey);
    } else {
      ri.badgeIcon.setTexture(iconKey);
    }
    ri.badgeIcon.setAlpha(1);
  }

  /**
   * Build the task arrangement using the stored container and bounds, then
   * activate the task so it subscribes to its own terminal-dial events.
   */
  buildTaskArrangement(count: number, droneKey?: string): void {
    if (!this.taskContainer || !this.taskBounds || !this.activeSession) return;
    this.activeSession.task.buildArrangement(this.taskContainer, this.taskBounds, count, droneKey);
    this.activeSession.task.activate();
  }

  /**
   * Staggered materialize: each icon + frame fades from alpha 0 → 1.
   * Called by DroneStage.spawn once the drone arrives.
   */
  materialize(): void {
    if (!this.activeSession) return;
    const items     = this.activeSession.task.getItems();
    const wireframe = this.activeSession.task.getWireframe();
    wireframe?.reveal();
    const targets = items.flatMap(ri => [ri.bgObj, ri.frameObj, ri.iconObj, ri.badgeBg, ri.badgeIcon]);
    targets.forEach((obj, i) => {
      this.scene.tweens.add({
        targets: obj,
        alpha: { from: 0, to: 1 },
        duration: FADE_DUR,
        delay: i * STAGGER_MS,
        ease: 'Sine.easeOut',
      });
    });
  }

  /**
   * Staggered dematerialize: items fade out, then "DRONE REPAIRED" text
   * appears briefly before onComplete is called.
   */
  dematerialize(onComplete: () => void): void {
    if (!this.activeSession || !this.taskBounds || !this.taskContainer) {
      onComplete();
      return;
    }
    const { cx, cy } = this.taskBounds;
    const items     = this.activeSession.task.getItems();
    const wireframe = this.activeSession.task.getWireframe();

    const allObjs: Phaser.GameObjects.GameObject[] = [
      ...items.flatMap(ri => [ri.bgObj, ri.frameObj, ri.iconObj, ri.badgeBg, ri.badgeIcon]),
      ...(wireframe?.sprite ? [wireframe.sprite] : []),
    ].reverse();

    allObjs.forEach((obj, i) => {
      this.scene.tweens.add({
        targets: obj,
        alpha: { to: 0 },
        duration: Math.round(FADE_DUR * 0.8),
        delay: i * Math.round(STAGGER_MS * 0.5),
        ease: 'Sine.easeIn',
      });
    });

    const totalFade = allObjs.length * STAGGER_MS * 0.5 + FADE_DUR * 0.8;
    const container = this.taskContainer;
    this.scene.time.delayedCall(totalFade + 60, () => {
      const lbl = this.scene.add.text(cx, cy, 'DRONE REPAIRED', readoutStyle(13, 0x00e864))
        .setOrigin(0.5).setDepth(10).setAlpha(0);
      container.add(lbl);

      this.scene.tweens.add({
        targets: lbl,
        alpha: { from: 0, to: 1 },
        duration: 300,
        ease: 'Sine.easeOut',
        onComplete: () => {
          this.scene.time.delayedCall(REPAIRED_HOLD_MS, () => {
            this.scene.tweens.add({
              targets: lbl,
              alpha: { to: 0 },
              duration: 250,
              ease: 'Sine.easeIn',
              onComplete: () => {
                lbl.destroy();
                onComplete();
              },
            });
          });
        },
      });
    });
  }

  private onUpdate(_time: number, delta: number): void {
    this.bg?.update(delta);
    this.scanOffset = (this.scanOffset + 0.4) % 5;
    this.drawScanlines();
  }

  private drawScanlines(): void {
    if (!this.scanG) return;
    this.scanG.clear();
    this.scanG.lineStyle(1, 0x00e864, 0.15);
    const offset = this.scanOffset;
    for (let yy = this.scanTop + offset; yy < this.scanTop + this.scanBotH; yy += 5) {
      this.scanG.lineBetween(this.scanLeft, yy, this.scanLeft + this.scanWidth, yy);
    }
  }
}

