export class GameOver extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(data: any) {
    // Display stats from data
    // Show replay button
    this.add.text(400, 300, 'Game Over - Stats will appear here', { fontSize: '24px', color: '#ffd54a' }).setOrigin(0.5);
  }

  replay() {
    // this.scene.start('MainMenu');
  }
}