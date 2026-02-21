export class MainMenu extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create() {
    // Background
    this.add.rectangle(512, 384, 1024, 768, 0x1a1a2e);

    // Title
    const titleText = this.add.text(512, 150, 'INTERGALACTIC SHIPPER', {
      fontSize: '48px',
      color: '#00ff00',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(512, 220, 'Order Fulfillment Terminal', {
      fontSize: '20px',
      color: '#00ccff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Menu buttons
    const buttonY = 400;
    const buttonSpacing = 80;

    // Start Shift button
    this.createButton(512, buttonY, 'START SHIFT', () => this.punchIn(), '#00ff00');

    // Item Manual button
    this.createButton(512, buttonY + buttonSpacing, 'ITEM MANUAL', () => this.openManual(), '#00ccff');

    // Exit button
    this.createButton(512, buttonY + buttonSpacing * 2, 'EXIT', () => this.exitGame(), '#ff6600');

    // Footer
    this.add.text(512, 700, 'Press SPACE to START SHIFT • Press M to view MANUAL', {
      fontSize: '12px',
      color: '#666666',
      align: 'center',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Keyboard shortcuts
    this.input.keyboard?.on('keydown-SPACE', () => this.punchIn());
    this.input.keyboard?.on('keydown-M', () => this.openManual());
  }

  private createButton(x: number, y: number, text: string, callback: () => void, color: string = '#00ff00'): void {
    const buttonWidth = 200;
    const buttonHeight = 50;

    // Button background
    const buttonBg = this.add.rectangle(x, y, buttonWidth, buttonHeight, 0x003300, 0.7);
    buttonBg.setInteractive();
    buttonBg.on('pointerdown', callback);
    buttonBg.on('pointerover', () => {
      buttonBg.setFillStyle(0x004400, 0.9);
    });
    buttonBg.on('pointerout', () => {
      buttonBg.setFillStyle(0x003300, 0.7);
    });

    // Button border
    this.add.rectangle(x, y, buttonWidth, buttonHeight).setStrokeStyle(2, color);

    // Button text
    this.add.text(x, y, text, {
      fontSize: '18px',
      color: color,
      fontStyle: 'bold',
      fontFamily: 'monospace',
      align: 'center'
    }).setOrigin(0.5);
  }

  punchIn() {
    // Transition to Game scene
    this.scene.start('Game');
  }

  openManual() {
    // Launch ItemManual scene as overlay
    this.scene.launch('ItemManual');
  }

  exitGame() {
    // Return to main page or close game
    window.location.href = '/';
  }
}
