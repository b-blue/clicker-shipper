import { RadialDial } from '../ui/RadialDial';
import { GameManager } from '../managers/GameManager';

export class Game extends Phaser.Scene {
  private currentOrderIndex: number = 0;
  private shiftTimer: Phaser.Time.TimerEvent | null = null;
  private eventEmitter: Phaser.Events.EventEmitter;
  private radialDial: RadialDial | null = null;

  constructor() {
    super('Game');
    this.eventEmitter = new Phaser.Events.EventEmitter();
  }

  create() {
    try {
      const gameManager = GameManager.getInstance();
      const items = gameManager.getItems();

      // Calculate dial position based on viewport (responsive)
      const gameWidth = this.cameras.main.width;
      const gameHeight = this.cameras.main.height;
      const dialX = gameWidth - 200;
      const dialY = gameHeight - 150;

      // Create the dial at bottom right of screen with margin
      this.radialDial = new RadialDial(this, dialX, dialY, items);

      // Listen for item confirmation (hold-to-confirm on center)
      this.events.on('dial:itemConfirmed', (data: { item: any }) => {
        console.log('Item confirmed:', data.item.name, 'Cost:', data.item.cost);
        // Add to order bucket, check budget, etc.
      });

      // Listen for level changes (when drilling into sub-items)
      this.events.on('dial:levelChanged', (data: { level: number; item: any }) => {
        console.log('Entered submenu for:', data.item.name);
      });

      // Listen for going back (tap center to return to root)
      this.events.on('dial:goBack', () => {
        console.log('Returned to main menu');
      });

      // Add temporary info text
      this.add.text(50, 50, 'Game Scene - Tap slice to navigate, Hold center to confirm', { fontSize: '16px', color: '#fff' });
    } catch (error) {
      console.error('Error creating Game scene:', error);
      this.add.text(50, 50, 'Error loading game data', { fontSize: '20px', color: '#ff0000' });
    }
  }

  update(time: number, delta: number) {
    // Update shift timer display
  }

  onOrderComplete() {
    // Validate order is within budget
    // Load next order
    // Reset dial to first level
    if (this.radialDial) {
      this.radialDial.reset();
    }
    // If no more orders, end shift
  }

  endShift() {
    // this.scene.start('GameOver', { stats });
  }

  shutdown() {
    if (this.radialDial) {
      this.radialDial.destroy();
    }
  }
}