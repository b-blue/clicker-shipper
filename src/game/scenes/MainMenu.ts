export class MainMenu extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create() {
    // Display punch-in prompt
    this.add.text(512, 300, 'PUNCH IN', { fontSize: '48px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(512, 400, 'Click to start shift', { fontSize: '24px', color: '#ccc' }).setOrigin(0.5);

    // Click to start
    this.input.once('pointerdown', () => {
      this.punchIn();
    });
  }

  punchIn() {
    // Transition to Game scene
    this.scene.start('Game');
  }
}
