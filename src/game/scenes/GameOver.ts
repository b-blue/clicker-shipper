import { Colors } from '../constants/Colors';

export class GameOver extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(_data: any) {
    // Display stats from data
    // Show replay button
    this.add.bitmapText(400, 300, 'clicker', 'GAME OVER', 24)
      .setOrigin(0.5);
  }

  replay() {
    // this.scene.start('MainMenu');
  }
}