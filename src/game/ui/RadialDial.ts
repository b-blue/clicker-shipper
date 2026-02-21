import Phaser from 'phaser';
import { Item, SubItem } from '../types/GameTypes';

export class RadialDial {
  private scene: Phaser.Scene;
  private items: Item[];
  private currentLevel: number = 0; // 0 = top level, 1 = sub-items
  private currentParentItem: Item | null = null;
  private currentSubItems: SubItem[] = [];
  private sliceCount: number = 6; // Will be updated dynamically based on items
  private readonly minSlices: number = 2;
  private readonly maxSlices: number = 6;
  private sliceRadius: number = 150;
  private centerRadius: number = 50;
  private highlightedSliceIndex: number = -1;
  private dialX: number;
  private dialY: number;
  private sliceGraphics: Phaser.GameObjects.Graphics[] = [];
  private sliceTexts: Phaser.GameObjects.Text[] = [];
  private sliceImages: Phaser.GameObjects.Image[] = [];
  private centerGraphic: Phaser.GameObjects.Graphics;
  private centerText: Phaser.GameObjects.Text;
  private centerIcon: Phaser.GameObjects.Text;
  private inputZone: Phaser.GameObjects.Zone;

  constructor(scene: Phaser.Scene, x: number, y: number, items: Item[]) {
    this.scene = scene;
    this.items = items;
    this.dialX = x;
    this.dialY = y;
    this.updateSliceCount();
    
    this.centerGraphic = scene.add.graphics();
    this.centerText = scene.add.text(x, y + 20, '', { fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);
    this.centerIcon = scene.add.text(x, y - 25, '', { fontSize: '48px' }).setOrigin(0.5);
    
    // Create invisible zone for input detection
    this.inputZone = scene.add.zone(x, y, 400, 400);
    
    this.setUpInputHandlers();
    this.reset();
  }

  private setUpInputHandlers(): void {
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.handleMouseMove(pointer);
    });

    this.scene.input.on('pointerdown', () => {
      this.handleClick();
    });
  }

  private handleMouseMove(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.x - this.dialX;
    const dy = pointer.y - this.dialY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Check if pointer is in center (back button)
    if (distance < this.centerRadius) {
      if (this.highlightedSliceIndex !== -999) {
        this.highlightedSliceIndex = -999; // Special index for center
        this.redrawDial();
      }
      return;
    }

    // Check if pointer is within the dial region
    if (distance < this.sliceRadius + 50 && distance > this.centerRadius + 5) {
      const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      const normalizedAngle = (angle + 360) % 360;
      const sliceAngle = 360 / this.sliceCount;
      const sliceIndex = Math.floor(normalizedAngle / sliceAngle);

      if (sliceIndex < this.sliceCount && sliceIndex !== this.highlightedSliceIndex) {
        this.highlightedSliceIndex = sliceIndex;
        this.redrawDial();
      }
    } else {
      if (this.highlightedSliceIndex !== -1 && this.highlightedSliceIndex !== -999) {
        this.highlightedSliceIndex = -1;
        this.redrawDial();
      }
    }
  }

  private handleClick(): void {
    // Check if center (back button) was clicked
    if (this.highlightedSliceIndex === -999) {
      if (this.currentLevel === 1) {
        this.reset();
        this.scene.events.emit('dial:goBack');
      }
      return;
    }

    if (this.highlightedSliceIndex === -1) return;

    if (this.currentLevel === 0) {
      // Navigate to sub-items
      this.currentParentItem = this.items[this.highlightedSliceIndex];
      this.currentSubItems = this.currentParentItem.subItems;
      this.currentLevel = 1;
      this.updateSliceCount();
      this.redrawDial();
      this.scene.events.emit('dial:levelChanged', { level: 1, item: this.currentParentItem });
    } else if (this.currentLevel === 1) {
      // Select the sub-item
      const selectedItem = this.currentSubItems[this.highlightedSliceIndex];
      this.scene.events.emit('dial:itemSelected', { item: selectedItem });
      this.reset();
    }
  }

  private redrawDial(): void {
    // Clear previous graphics and texts
    this.sliceGraphics.forEach(g => g.destroy());
    this.sliceTexts.forEach(t => t.destroy());
    this.sliceImages.forEach(i => i.destroy());
    this.sliceGraphics = [];
    this.sliceTexts = [];
    this.sliceImages = [];

    const displayItems = this.currentLevel === 0 ? this.items : this.currentSubItems;
    const sliceAngle = (Math.PI * 2) / this.sliceCount;

    // Draw center circle
    this.centerGraphic.clear();
    const centerColor = this.highlightedSliceIndex === -999 ? 0xff6600 : 0x333333;
    this.centerGraphic.fillStyle(centerColor, 1);
    this.centerGraphic.fillCircle(this.dialX, this.dialY, this.centerRadius);

    // Update center display
    if (this.currentLevel === 1 && this.currentParentItem) {
      this.centerIcon.setText('←');
      this.centerIcon.setPosition(this.dialX, this.dialY - 25);
      this.centerText.setText('Back');
      this.centerText.setPosition(this.dialX, this.dialY + 20);
    } else {
      this.centerIcon.setText('📡');
      this.centerIcon.setPosition(this.dialX, this.dialY - 25);
      this.centerText.setText('Dial');
      this.centerText.setPosition(this.dialX, this.dialY + 20);
    }

    // Draw slices (behind center)
    for (let i = 0; i < this.sliceCount; i++) {
      const startAngle = i * sliceAngle - Math.PI / 2;
      const endAngle = startAngle + sliceAngle;
      const isHighlighted = i === this.highlightedSliceIndex;
      const color = isHighlighted ? 0xff6600 : 0x0066ff;

      // Draw slice
      const graphics = this.scene.add.graphics();
      graphics.fillStyle(color, 0.7);
      graphics.beginPath();
      graphics.moveTo(this.dialX, this.dialY);
      graphics.lineTo(
        this.dialX + Math.cos(startAngle) * this.sliceRadius,
        this.dialY + Math.sin(startAngle) * this.sliceRadius
      );
      graphics.arc(this.dialX, this.dialY, this.sliceRadius, startAngle, endAngle);
      graphics.lineTo(this.dialX, this.dialY);
      graphics.closePath();
      graphics.fillPath();
      graphics.setDepth(0); // Behind center

      this.sliceGraphics.push(graphics);

      // Draw sprite or text for each item
      const midAngle = startAngle + sliceAngle / 2;
      const textDistance = this.sliceRadius - 40;
      const textX = this.dialX + Math.cos(midAngle) * textDistance;
      const textY = this.dialY + Math.sin(midAngle) * textDistance;
      const item = displayItems[i];

      // Try to display sprite for sub-items; fall back to text
      if (this.currentLevel === 1 && 'id' in item) {
        const subItem = item as SubItem;
        if (this.scene.textures.exists(subItem.id)) {
          // Display sprite
          const image = this.scene.add.image(textX, textY, subItem.id);
          image.setScale(0.5);
          image.setDepth(0);
          this.sliceImages.push(image);
        } else {
          // Fallback to text
          const text = this.scene.add.text(textX, textY, item.name, {
            fontSize: '11px',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: 80 }
          });
          text.setOrigin(0.5, 0.5);
          text.setDepth(0);
          this.sliceTexts.push(text);
        }
      } else {
        // Display text for categories
        const text = this.scene.add.text(textX, textY, item.name, {
          fontSize: '12px',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: 80 }
        });
        text.setOrigin(0.5, 0.5);
        text.setDepth(0);
        this.sliceTexts.push(text);
      }
    }

    // Draw center circle on top
    this.centerGraphic.setDepth(10);
    this.centerIcon.setDepth(10);
    this.centerText.setDepth(10);
  }

  public reset(): void {
    this.currentLevel = 0;
    this.currentParentItem = null;
    this.currentSubItems = [];
    this.highlightedSliceIndex = -1;
    this.updateSliceCount();
    this.redrawDial();
  }

  private updateSliceCount(): void {
    const displayItems = this.currentLevel === 0 ? this.items : this.currentSubItems;
    const itemCount = displayItems.length;
    
    // Clamp between min and max slices
    this.sliceCount = Math.max(this.minSlices, Math.min(this.maxSlices, itemCount));
  }

  public destroy(): void {
    this.sliceGraphics.forEach(g => g.destroy());
    this.sliceTexts.forEach(t => t.destroy());
    this.sliceImages.forEach(i => i.destroy());
    this.centerGraphic.destroy();
    this.centerText.destroy();
    this.centerIcon.destroy();
    this.inputZone.destroy();
  }
}