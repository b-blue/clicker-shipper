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

    // Scanlines only on the bottom section
    const scanG = this.scene.add.graphics();
    scanG.setDepth(2);
    scanG.lineStyle(1, 0x00e864, 0.07);
    const scanTop  = botCY - botH / 2;
    const scanLeft = botCX - width / 2;
    for (let yy = scanTop; yy < scanTop + botH; yy += 5) {
      scanG.lineBetween(scanLeft, yy, scanLeft + width, yy);
    }

    container.add([topBg, botBg, scanG]);

    // Dividing line between top and bottom sections
    const divG = this.scene.add.graphics();
    divG.setDepth(3);
    divG.lineStyle(1, Colors.BORDER_BLUE, 0.6);
    divG.lineBetween(topCX - width / 2 + 4, topCY + topH / 2, topCX + width / 2 - 4, topCY + topH / 2);
    container.add(divG);

    // Spawn the drone into the top section (wireframe FX applied inside DroneStage)
    this.droneStage.spawn(container);
  }
}
