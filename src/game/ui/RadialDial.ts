import Phaser from 'phaser';
import { Item, SubItem } from '../types/GameTypes';

export class RadialDial {
  private scene: Phaser.Scene;
  private items: Item[];
  private currentLevel: number = 0; // 0 = top level, 1 = sub-items
  private currentParentItem: Item | null = null;
  private currentSubItems: SubItem[] = [];
  private sliceCount: number = 6;
  private readonly minSlices: number = 2;
  private readonly maxSlices: number = 6;
  private sliceRadius: number = 150;
  private centerRadius: number = 50;
  private highlightedSliceIndex: number = -1;
  private selectedItem: Item | SubItem | null = null; // Item shown in center
  private dialX: number;
  private dialY: number;
  private sliceGraphics: Phaser.GameObjects.Graphics[] = [];
  private sliceTexts: Phaser.GameObjects.Text[] = [];
  private sliceImages: Phaser.GameObjects.Image[] = [];
  private centerGraphic: Phaser.GameObjects.Graphics;
  private centerImage: Phaser.GameObjects.Image;
  private progressRing: Phaser.GameObjects.Graphics;
  private inputZone: Phaser.GameObjects.Zone;
  
  // Hold-to-confirm properties
  private isHoldingCenter: boolean = false;
  private holdStartTime: number = 0;
  private holdDuration: number = 1000; // 1 second to confirm
  private holdUpdateTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, items: Item[]) {
    this.scene = scene;
    this.items = items;
    this.dialX = x;
    this.dialY = y;
    this.updateSliceCount();
    
    this.centerGraphic = scene.add.graphics();
    this.progressRing = scene.add.graphics();
    this.centerImage = scene.add.image(x, y, '').setScale(0.6).setOrigin(0.5);
    this.centerImage.setDepth(10);
    
    // Create invisible zone for input detection
    this.inputZone = scene.add.zone(x, y, 400, 400);
    
    this.setUpInputHandlers();
    this.reset();
  }

  private setUpInputHandlers(): void {
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.handleMouseMove(pointer);
    });

    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handlePointerDown(pointer);
    });

    this.scene.input.on('pointerup', () => {
      this.handlePointerUp();
    });
  }

  private handleMouseMove(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.x - this.dialX;
    const dy = pointer.y - this.dialY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // If holding center, don't highlight slices
    if (this.isHoldingCenter) {
      return;
    }

    // Check if pointer is in center
    if (distance < this.centerRadius) {
      if (this.highlightedSliceIndex !== -999) {
        this.highlightedSliceIndex = -999;
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
        this.updateSelectedItem();
        this.redrawDial();
      }
    } else {
      if (this.highlightedSliceIndex !== -1 && this.highlightedSliceIndex !== -999) {
        this.highlightedSliceIndex = -1;
        this.selectedItem = null;
        this.redrawDial();
      }
    }
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.x - this.dialX;
    const dy = pointer.y - this.dialY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Check if center was pressed
    if (distance < this.centerRadius) {
      this.isHoldingCenter = true;
      this.holdStartTime = this.scene.time.now;
      
      // Start update loop to show progress
      this.holdUpdateTimer = this.scene.time.addTimer({
        delay: 50,
        callback: () => this.updateHoldProgress(),
        loop: true
      });
      
      this.redrawDial();
    }
  }

  private handlePointerUp(): void {
    if (this.isHoldingCenter) {
      const holdDuration = this.scene.time.now - this.holdStartTime;

      if (holdDuration >= this.holdDuration) {
        // Hold was long enough - confirm selection
        if (this.selectedItem && this.currentLevel === 1) {
          // Only confirm at level 1 (sub-items)
          this.scene.events.emit('dial:itemConfirmed', { item: this.selectedItem });
        }
      }
      // If hold was too short, nothing happens (player can try again)

      // Clean up
      this.isHoldingCenter = false;
      if (this.holdUpdateTimer) {
        this.holdUpdateTimer.remove();
        this.holdUpdateTimer = null;
      }
      this.redrawDial();
    } else if (this.highlightedSliceIndex === -999) {
      // Tap on center (not hold) = go back
      if (this.currentLevel === 1) {
        this.reset();
        this.scene.events.emit('dial:goBack');
      }
    } else if (this.highlightedSliceIndex >= 0 && !this.isHoldingCenter) {
      // Tap on a slice (not hold)
      if (this.currentLevel === 0) {
        // Navigate to sub-items of this category
        this.currentParentItem = this.items[this.highlightedSliceIndex];
        this.currentSubItems = this.currentParentItem.subItems;
        this.currentLevel = 1;
        this.selectedItem = null;
        this.highlightedSliceIndex = -1;
        this.updateSliceCount();
        this.redrawDial();
        this.scene.events.emit('dial:levelChanged', { level: 1, item: this.currentParentItem });
      }
      // At level 1, taps just select the item (shown in center via pointermove)
      // Player then holds center to confirm
    }
  }

  private updateHoldProgress(): void {
    if (this.isHoldingCenter) {
      this.redrawDial();
    }
  }

  private updateSelectedItem(): void {
    const displayItems = this.currentLevel === 0 ? this.items : this.currentSubItems;
    
    if (this.highlightedSliceIndex >= 0 && this.highlightedSliceIndex < displayItems.length) {
      this.selectedItem = displayItems[this.highlightedSliceIndex];
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

    // Draw center circle with hold indicator
    this.centerGraphic.clear();
    
    if (this.isHoldingCenter) {
      // During hold: show progress with animated color
      const progress = Math.min(1, (this.scene.time.now - this.holdStartTime) / this.holdDuration);
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        new Phaser.Display.Color(51, 51, 51),      // Dark gray (0x333333)
        new Phaser.Display.Color(0, 255, 0),       // Green (0x00ff00)
        1,
        progress
      );
      const hexColor = Phaser.Display.Color.RGBToString(color.r, color.g, color.b);
      this.centerGraphic.fillStyle(parseInt(hexColor.replace('#', '0x')), 1);
    } else if (this.highlightedSliceIndex === -999 && this.currentLevel === 1) {
      // Center is highlighted (back button) - show orange
      this.centerGraphic.fillStyle(0xff6600, 1);
    } else {
      // Normal center
      this.centerGraphic.fillStyle(0x333333, 1);
    }
    
    this.centerGraphic.fillCircle(this.dialX, this.dialY, this.centerRadius);

    // Draw hold progress ring if holding
    if (this.isHoldingCenter) {
      const progress = Math.min(1, (this.scene.time.now - this.holdStartTime) / this.holdDuration);
      const ringRadius = this.centerRadius + 10;
      this.progressRing.clear();
      this.progressRing.lineStyle(3, 0x00ff00, 1);
      this.progressRing.beginPath();
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + (Math.PI * 2 * progress);
      this.progressRing.arc(this.dialX, this.dialY, ringRadius, startAngle, endAngle);
      this.progressRing.strokePath();
      this.progressRing.setDepth(11);
    }

    // Update center display with selected item
    if (this.selectedItem) {
      const itemId = (this.selectedItem as any).id;
      if (this.scene.textures.exists(itemId)) {
        this.centerImage.setTexture(itemId);
        this.centerImage.setPosition(this.dialX, this.dialY);
        this.centerImage.setVisible(true);
      } else {
        this.centerImage.setVisible(false);
      }
    } else if (this.currentLevel === 1 && this.currentParentItem) {
      // Display parent item's sprite when no selection
      const itemId = (this.currentParentItem as Item).id;
      if (this.scene.textures.exists(itemId)) {
        this.centerImage.setTexture(itemId);
        this.centerImage.setPosition(this.dialX, this.dialY);
        this.centerImage.setVisible(true);
      } else {
        this.centerImage.setVisible(false);
      }
    } else {
      // Display root dial icon sprite
      if (this.scene.textures.exists('rootDialIcon')) {
        this.centerImage.setTexture('rootDialIcon');
        this.centerImage.setPosition(this.dialX, this.dialY);
        this.centerImage.setVisible(true);
      } else {
        this.centerImage.setVisible(false);
      }
    }

    // Draw slices
    for (let i = 0; i < this.sliceCount; i++) {
      const startAngle = i * sliceAngle - Math.PI / 2;
      const endAngle = startAngle + sliceAngle;
      const isHighlighted = i === this.highlightedSliceIndex && !this.isHoldingCenter;
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
      graphics.setDepth(0);

      this.sliceGraphics.push(graphics);

      // Draw icon/text for each item
      const midAngle = startAngle + sliceAngle / 2;
      const textDistance = this.sliceRadius - 40;
      const textX = this.dialX + Math.cos(midAngle) * textDistance;
      const textY = this.dialY + Math.sin(midAngle) * textDistance;
      const item = displayItems[i];

      // Try to display sprite for sub-items; fall back to text
      if (this.currentLevel === 1 && 'id' in item) {
        const subItem = item as SubItem;
        if (this.scene.textures.exists(subItem.id)) {
          const image = this.scene.add.image(textX, textY, subItem.id);
          image.setScale(0.5);
          image.setDepth(0);
          this.sliceImages.push(image);
        } else {
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

        // Add corner badge indicator for items with sub-items
        if (this.currentLevel === 0 && 'subItems' in item && (item as Item).subItems.length > 0) {
          const badgeX = textX + 20;
          const badgeY = textY - 20;
          const badgeText = this.scene.add.text(badgeX, badgeY, '▶', {
            fontSize: '16px',
            color: '#ffff00',
            fontStyle: 'bold'
          });
          badgeText.setOrigin(0.5, 0.5);
          badgeText.setDepth(5);
          this.sliceTexts.push(badgeText);
        }
      }
    }

    // Ensure center graphics and image are on top
    this.centerGraphic.setDepth(10);
    this.centerImage.setDepth(10);
  }

  public reset(): void {
    this.currentLevel = 0;
    this.currentParentItem = null;
    this.currentSubItems = [];
    this.highlightedSliceIndex = -1;
    this.selectedItem = null;
    this.isHoldingCenter = false;
    if (this.holdUpdateTimer) {
      this.holdUpdateTimer.remove();
      this.holdUpdateTimer = null;
    }
    this.updateSliceCount();
    this.redrawDial();
  }

  private updateSliceCount(): void {
    const displayItems = this.currentLevel === 0 ? this.items : this.currentSubItems;
    const itemCount = displayItems.length;
    
    this.sliceCount = Math.max(this.minSlices, Math.min(this.maxSlices, itemCount));
  }

  public destroy(): void {
    this.sliceGraphics.forEach(g => g.destroy());
    this.sliceTexts.forEach(t => t.destroy());
    this.sliceImages.forEach(i => i.destroy());
    this.centerGraphic.destroy();
    this.progressRing.destroy();
    this.centerImage.destroy();
    this.inputZone.destroy();
    if (this.holdUpdateTimer) {
      this.holdUpdateTimer.remove();
    }
  }
}