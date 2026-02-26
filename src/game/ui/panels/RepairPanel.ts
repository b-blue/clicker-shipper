import Phaser from 'phaser';
import { Colors } from '../../constants/Colors';
import { DroneStage } from '../../repair/DroneStage';
import { ReOrientMode } from '../../repair/ReOrientMode';

/**
 * Builds the REPAIR tab visual structure:
 * - Top half: drone screen (drone tween in/out via DroneStage)
 * - Bottom half: item arrangement area (managed by ReOrientMode)
 *
 * NOTE: buildArrangement() is NOT called here; it must be called after
 * the item pool has been populated (see Game.populateRepairPools).
 */
export class RepairPanel {
  private scene: Phaser.Scene;
  private droneStage: DroneStage;
  private reOrientMode: ReOrientMode;

  constructor(scene: Phaser.Scene, droneStage: DroneStage, reOrientMode: ReOrientMode) {
    this.scene = scene;
    this.droneStage  = droneStage;
    this.reOrientMode = reOrientMode;
  }

  build(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const halfH = height / 2;
    const topCX = x;
    const topCY = y + halfH / 2;
    const botCX = x;
    const botCY = y + halfH + halfH / 2;

    this.droneStage.setTopBounds({ cx: topCX, cy: topCY, w: width, h: halfH });
    this.reOrientMode.setBotBounds({ cx: botCX, cy: botCY, w: width, h: halfH });

    // Background rects
    const topBg = this.scene.add.rectangle(topCX, topCY, width, halfH, Colors.PANEL_DARK, 0.6);
    topBg.setStrokeStyle(1, Colors.BORDER_BLUE, 0.45);
    const botBg = this.scene.add.rectangle(botCX, botCY, width, halfH, Colors.PANEL_DARK, 0.3);
    botBg.setStrokeStyle(1, Colors.BORDER_BLUE, 0.2);
    container.add([topBg, botBg]);

    // Spawn the drone into the top half
    this.droneStage.spawn(container);
  }
}
