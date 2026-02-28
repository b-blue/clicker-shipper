import { GameConfig } from '../types/GameTypes';

export interface PendingDelivery {
  iconKey:   string;
  speedTier: number;
  duration:  number;
  progress:  number;  // 0–1
}

/**
 * Manages timed delivery entries.
 *
 * Each entry counts down using `Phaser.Time.TimerEvent` and emits
 * `delivery:completed { iconKey }` on the scene's event emitter when done.
 */
export class DeliveryQueue {
  private entries: PendingDelivery[] = [];
  private timers:  Map<string, Phaser.Time.TimerEvent> = new Map();
  private scene:   Phaser.Scene | null = null;

  /** Must be called once before `enqueue()` so timers can be created. */
  setScene(scene: Phaser.Scene): void {
    this.scene = scene;
  }

  /**
   * Add a new delivery.
   * @param iconKey   The item icon key being replaced.
   * @param speedTier 0=slow · 1=normal · 2=fast
   * @param config    GameConfig (contains deliveryDurations)
   * @param scene     Phaser scene for timer creation (fallback if setScene not called)
   */
  enqueue(iconKey: string, speedTier: number, config: GameConfig, scene: Phaser.Scene): void {
    const s        = this.scene ?? scene;
    const duration = config.deliveryDurations[speedTier] ?? 8000;

    // Cancel any existing delivery for same icon
    this.cancel(iconKey);

    const entry: PendingDelivery = { iconKey, speedTier, duration, progress: 0 };
    this.entries.push(entry);

    // Use a repeating callback every 100 ms to update progress, then a
    // single delayed event to fire completion.
    const startTime = s.time.now;

    const ticker = s.time.addEvent({
      delay:    100,
      loop:     true,
      callback: () => {
        const elapsed = s.time.now - startTime;
        entry.progress = Math.min(1, elapsed / duration);
      },
    });

    const completer = s.time.delayedCall(duration, () => {
      ticker.remove();
      this.timers.delete(`tick_${iconKey}`);
      this.timers.delete(iconKey);
      this.entries = this.entries.filter(e => e.iconKey !== iconKey);
      s.events.emit('delivery:completed', { iconKey });
    });

    this.timers.set(`tick_${iconKey}`, ticker);
    this.timers.set(iconKey, completer);
  }

  /** Cancel a pending delivery without completing it. */
  cancel(iconKey: string): void {
    const ticker    = this.timers.get(`tick_${iconKey}`);
    const completer = this.timers.get(iconKey);
    if (ticker)    ticker.remove();
    if (completer) completer.remove();
    this.timers.delete(`tick_${iconKey}`);
    this.timers.delete(iconKey);
    this.entries = this.entries.filter(e => e.iconKey !== iconKey);
  }

  getAll(): PendingDelivery[] {
    return [...this.entries];
  }

  getEntry(iconKey: string): PendingDelivery | undefined {
    return this.entries.find(e => e.iconKey === iconKey);
  }

  destroy(): void {
    for (const t of this.timers.values()) t.remove();
    this.timers.clear();
    this.entries = [];
    this.scene   = null;
  }
}
