export class MainMenu extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create() {
    // Get responsive viewport dimensions
    const gameWidth = this.cameras.main.width;
    const gameHeight = this.cameras.main.height;

    // Background
    this.add.rectangle(gameWidth / 2, gameHeight / 2, gameWidth, gameHeight, 0x1a1a2e);

    // Title
    const titleText = this.add.text(gameWidth / 2, gameHeight * 0.15, 'INTERGALACTIC SHIPPER', {
      fontSize: '48px',
      color: '#00ff00',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(gameWidth / 2, gameHeight * 0.25, 'Order Fulfillment Terminal', {
      fontSize: '20px',
      color: '#00ccff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Menu buttons
    const buttonY = gameHeight * 0.5;
    const buttonSpacing = 80;

    // Start Shift button
    this.createButton(gameWidth / 2, buttonY, 'START SHIFT', () => this.punchIn(), '#00ff00');

    // Item Manual button
    this.createButton(gameWidth / 2, buttonY + buttonSpacing, 'ITEM MANUAL', () => this.openManual(), '#00ccff');

    // Exit button
    this.createButton(gameWidth / 2, buttonY + buttonSpacing * 2, 'EXIT', () => this.exitGame(), '#ff6600');

    // Footer
    this.add.text(gameWidth / 2, gameHeight * 0.9, 'Press SPACE to START SHIFT • Press M to view MANUAL', {
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
