import Phaser from 'phaser';
import { Colors } from '../../constants/Colors';
import { DroneStage } from '../../repair/DroneStage';
import { ReOrientMode } from '../../repair/ReOrientMode';

/**
 * Builds the REPAIR tab visual structure:
 * - Top 2/5:  drone stage  (clean, no scanlines — drone always fully contained here)
 * - Bottom 3/5: diagnostic panel (scanlines, corner brackets, icon grid via ReOrientMode)
 *
 * NOTE: buildArrangement() is NOT called here; it is called from Game.populateRepairPools
 * after the item pool has been assigned and a drone key has been pre-selected.
 */
export class RepairPanel {
  private scene: Phaser.Scene;
  private droneStage: DroneStage;
  private reOrientMode: ReOrientMode;
  private scanG: Phaser.GameObjects.Graphics | null = null;
  private scanOffset: number = 0;
  private scanLeft: number = 0;
  private scanTop: number = 0;
  private scanWidth: number = 0;
  private scanBotH: number = 0;

  constructor(scene: Phaser.Scene, droneStage: DroneStage, reOrientMode: ReOrientMode) {
    this.scene        = scene;
    this.droneStage   = droneStage;
    this.reOrientMode = reOrientMode;
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
    const botCX = x;
    const botCY = y + topH + botH / 2;

    // Pass bounds to sub-systems
    this.droneStage.setTopBounds({ cx: topCX, cy: topCY, w: width, h: topH });
    this.reOrientMode.setBotBounds({ cx: botCX, cy: botCY, w: width, h: botH });

    // ── Top: clean dark stage for drone ──────────────────────────────────
    const topBg = this.scene.add.rectangle(topCX, topCY, width, topH, Colors.PANEL_DARK, 0.7);
    topBg.setStrokeStyle(1, Colors.BORDER_BLUE, 0.5);

    // ── Bottom: diagnostic panel ──────────────────────────────────────────
    const botBg = this.scene.add.rectangle(botCX, botCY, width, botH, Colors.PANEL_DARK, 0.4);
    botBg.setStrokeStyle(1, Colors.BORDER_BLUE, 0.35);

    // Animated scanlines — stored so onUpdate can redraw them each frame
    this.scanLeft  = botCX - width / 2;
    this.scanTop   = botCY - botH / 2;
    this.scanWidth = width;
    this.scanBotH  = botH;

    const scanG = this.scene.add.graphics();
    scanG.setDepth(2);
    this.scanG = scanG;
    this.drawScanlines();

    container.add([topBg, botBg, scanG]);
    this.scene.events.on('update', this.onUpdate, this);

    // Dividing line between top and bottom sections
    const divG = this.scene.add.graphics();
    divG.setDepth(3);
    divG.lineStyle(1, Colors.BORDER_BLUE, 0.6);
    divG.lineBetween(topCX - width / 2 + 4, topCY + topH / 2, topCX + width / 2 - 4, topCY + topH / 2);
    container.add(divG);

    // Spawn the drone; once it arrives materialize the icon grid
    this.droneStage.spawn(container, () => this.reOrientMode.materialize());
  }

  destroy(): void {
    this.scene.events.off('update', this.onUpdate, this);
    this.scanG?.destroy();
    this.scanG = null;
  }

  private onUpdate(): void {
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
