import { Colors, toColorString } from '../constants/Colors';

export class GameOver extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(_data: any) {
    // Display stats from data
    // Show replay button
    this.add.text(400, 300, 'Game Over - Stats will appear here', { fontSize: '24px', color: toColorString(Colors.HIGHLIGHT_YELLOW) }).setOrigin(0.5);
  }

  replay() {
    // this.scene.start('MainMenu');
  }
}