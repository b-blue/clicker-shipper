import { GameManager } from '../managers/GameManager';
import { SettingsManager } from '../managers/SettingsManager';
import { AssetLoader } from '../managers/AssetLoader';
import { DiagnosticFXPipeline, DIAGNOSTIC_FX } from '../fx/DiagnosticFXPipeline';

export class Preloader extends Phaser.Scene {
  constructor() {
    super('Preloader');
  }

  preload() {
    // Load config and items data
    this.load.json('config', 'data/config.json');
    this.load.json('items', 'data/items.json');
    this.load.json('rad-dial', 'data/rad-dial.json');

    // Load bitmap font
    this.load.bitmapFont('clicker', 'assets/fonts/clicker.png', 'assets/fonts/clicker.fnt');

    // Drone + robot animation strips — plain images; frame layout detected at runtime.
    // Key convention:  drone-{N}-{anim}  /  robot-{N}-{anim}
    // All paths are case-sensitive matches to the files on disk.
    const DRONE_FILE_MANIFEST: Array<[string, string]> = [
      // ── Drones 1-15 ───────────────────────────────────────────────────
      ['drone-1-death',      'assets/drones/1/Death.png'],
      ['drone-1-idle',       'assets/drones/1/Idle.png'],
      ['drone-1-scan',       'assets/drones/1/Scan.png'],
      ['drone-1-walk',       'assets/drones/1/Walk.png'],
      ['drone-1-walkscan',   'assets/drones/1/Walk_scan.png'],

      ['drone-2-back',       'assets/drones/2/Back.png'],
      ['drone-2-death',      'assets/drones/2/Death.png'],
      ['drone-2-fire1',      'assets/drones/2/Fire1.png'],
      ['drone-2-fire2',      'assets/drones/2/Fire2.png'],
      ['drone-2-fire3',      'assets/drones/2/Fire3.png'],
      ['drone-2-forward',    'assets/drones/2/Forward.png'],
      ['drone-2-idle',       'assets/drones/2/Idle.png'],

      ['drone-3-death',      'assets/drones/3/Death.png'],
      ['drone-3-idle',       'assets/drones/3/Idle.png'],
      ['drone-3-landing',    'assets/drones/3/Landing.png'],
      ['drone-3-walk',       'assets/drones/3/Walk.png'],

      ['drone-4-death',      'assets/drones/4/Death.png'],
      ['drone-4-idle',       'assets/drones/4/Idle.png'],
      ['drone-4-walk',       'assets/drones/4/Walk.png'],

      ['drone-5-death',      'assets/drones/5/Death.png'],
      ['drone-5-idle',       'assets/drones/5/Idle.png'],
      ['drone-5-walk',       'assets/drones/5/Walk.png'],

      ['drone-6-capsule',    'assets/drones/6/Capsule.png'],
      ['drone-6-drop',       'assets/drones/6/Drop.png'],
      ['drone-6-walk',       'assets/drones/6/Walk.png'],
      ['drone-6-walk2',      'assets/drones/6/Walk2.png'],

      ['drone-7-attack',     'assets/drones/7/Attack.png'],
      ['drone-7-death',      'assets/drones/7/Death.png'],
      ['drone-7-hurt',       'assets/drones/7/Hurt.png'],
      ['drone-7-idle',       'assets/drones/7/Idle.png'],
      ['drone-7-walk',       'assets/drones/7/Walk.png'],

      ['drone-8-attack',     'assets/drones/8/Attack.png'],
      ['drone-8-death',      'assets/drones/8/Death.png'],
      ['drone-8-hurt',       'assets/drones/8/Hurt.png'],
      ['drone-8-idle',       'assets/drones/8/Idle.png'],
      ['drone-8-walk',       'assets/drones/8/Walk.png'],

      ['drone-9-attack1',    'assets/drones/9/Attack1.png'],
      ['drone-9-attack2',    'assets/drones/9/Attack2.png'],
      ['drone-9-attack3',    'assets/drones/9/Attack3.png'],
      ['drone-9-death',      'assets/drones/9/Death.png'],
      ['drone-9-hurt',       'assets/drones/9/Hurt.png'],
      ['drone-9-idle',       'assets/drones/9/Idle.png'],
      ['drone-9-walk',       'assets/drones/9/Walk.png'],

      ['drone-10-attack',    'assets/drones/10/Attack.png'],
      ['drone-10-death',     'assets/drones/10/Death.png'],
      ['drone-10-hurt',      'assets/drones/10/Hurt.png'],
      ['drone-10-idle',      'assets/drones/10/Idle.png'],
      ['drone-10-walk',      'assets/drones/10/Walk.png'],

      ['drone-11-attack',    'assets/drones/11/Attack.png'],
      ['drone-11-death',     'assets/drones/11/Death.png'],
      ['drone-11-fireball',  'assets/drones/11/Fireball.png'],
      ['drone-11-hurt',      'assets/drones/11/Hurt.png'],
      ['drone-11-idle',      'assets/drones/11/Idle.png'],
      ['drone-11-walk',      'assets/drones/11/Walk.png'],

      ['drone-12-attack',    'assets/drones/12/Attack.png'],
      ['drone-12-death',     'assets/drones/12/Death.png'],
      ['drone-12-hurt',      'assets/drones/12/Hurt.png'],
      ['drone-12-idle',      'assets/drones/12/Idle.png'],
      ['drone-12-walk',      'assets/drones/12/Walk.png'],

      ['drone-13-attack',    'assets/drones/13/Attack.png'],
      ['drone-13-death',     'assets/drones/13/Death.png'],
      ['drone-13-hurt',      'assets/drones/13/Hurt.png'],
      ['drone-13-idle',      'assets/drones/13/Idle.png'],
      ['drone-13-walk',      'assets/drones/13/Walk.png'],

      ['drone-14-attack',    'assets/drones/14/Attack.png'],
      ['drone-14-death',     'assets/drones/14/Death.png'],
      ['drone-14-hurt',      'assets/drones/14/Hurt.png'],
      ['drone-14-idle',      'assets/drones/14/Idle.png'],
      ['drone-14-walk',      'assets/drones/14/Walk.png'],

      ['drone-15-boom',      'assets/drones/15/BOOM.png'],
      ['drone-15-bomb',      'assets/drones/15/Bomb.png'],
      ['drone-15-death',     'assets/drones/15/Death.png'],
      ['drone-15-hurt',      'assets/drones/15/Hurt.png'],
      ['drone-15-idle',      'assets/drones/15/Idle.png'],
      ['drone-15-run',       'assets/drones/15/Run.png'],

      // ── Robots 1-10 ───────────────────────────────────────────────────
      ['robot-1-attack',     'assets/robots/1/Attack.png'],
      ['robot-1-death',      'assets/robots/1/Death.png'],
      ['robot-1-hurt',       'assets/robots/1/Hurt.png'],
      ['robot-1-idle',       'assets/robots/1/Idle.png'],
      ['robot-1-walk',       'assets/robots/1/Walk.png'],

      ['robot-2-alarm',      'assets/robots/2/Alarm.png'],
      ['robot-2-death',      'assets/robots/2/Death.png'],
      ['robot-2-hurt',       'assets/robots/2/Hurt.png'],
      ['robot-2-idle',       'assets/robots/2/Idle.png'],
      ['robot-2-run',        'assets/robots/2/Run.png'],

      ['robot-3-attack',     'assets/robots/3/Attack.png'],
      ['robot-3-death',      'assets/robots/3/Death.png'],
      ['robot-3-hurt',       'assets/robots/3/Hurt.png'],
      ['robot-3-idle',       'assets/robots/3/Idle.png'],
      ['robot-3-walk',       'assets/robots/3/Walk.png'],

      ['robot-4-attack',     'assets/robots/4/Attack.png'],
      ['robot-4-death',      'assets/robots/4/Death.png'],
      ['robot-4-hurt',       'assets/robots/4/Hurt.png'],
      ['robot-4-idle',       'assets/robots/4/Idle.png'],
      ['robot-4-run',        'assets/robots/4/Run.png'],

      ['robot-5-attack',     'assets/robots/5/Attack.png'],
      ['robot-5-bullet',     'assets/robots/5/Bullet.png'],
      ['robot-5-death',      'assets/robots/5/Death.png'],
      ['robot-5-hurt',       'assets/robots/5/Hurt.png'],
      ['robot-5-idle',       'assets/robots/5/Idle.png'],
      ['robot-5-walk',       'assets/robots/5/Walk.png'],

      ['robot-6-attack',     'assets/robots/6/Attack.png'],
      ['robot-6-ball1',      'assets/robots/6/Ball1.png'],
      ['robot-6-ball2',      'assets/robots/6/Ball2.png'],
      ['robot-6-death',      'assets/robots/6/Death.png'],
      ['robot-6-hurt',       'assets/robots/6/Hurt.png'],
      ['robot-6-idle',       'assets/robots/6/Idle.png'],
      ['robot-6-walk',       'assets/robots/6/Walk.png'],

      ['robot-7-attack',     'assets/robots/7/Attack.png'],
      ['robot-7-death',      'assets/robots/7/Death.png'],
      ['robot-7-hurt',       'assets/robots/7/Hurt.png'],
      ['robot-7-idle',       'assets/robots/7/Idle.png'],
      ['robot-7-walk',       'assets/robots/7/Walk.png'],

      ['robot-8-attack',     'assets/robots/8/Attack.png'],
      ['robot-8-attackdust', 'assets/robots/8/Attack_dust.png'],
      ['robot-8-bullet',     'assets/robots/8/Bullet.png'],
      ['robot-8-death',      'assets/robots/8/Death.png'],
      ['robot-8-hurt',       'assets/robots/8/Hurt.png'],
      ['robot-8-idle',       'assets/robots/8/Idle.png'],
      ['robot-8-walk',       'assets/robots/8/Walk.png'],

      ['robot-9-attack',     'assets/robots/9/Attack.png'],
      ['robot-9-death',      'assets/robots/9/Death.png'],
      ['robot-9-hurt',       'assets/robots/9/Hurt.png'],
      ['robot-9-idle',       'assets/robots/9/Idle.png'],
      ['robot-9-walk',       'assets/robots/9/Walk.png'],

      ['robot-10-attack1',   'assets/robots/10/Attack1.png'],
      ['robot-10-attack2',   'assets/robots/10/Attack2.png'],
      ['robot-10-death',     'assets/robots/10/Death.png'],
      ['robot-10-hurt',      'assets/robots/10/Hurt.png'],
      ['robot-10-idle',      'assets/robots/10/Idle.png'],
      ['robot-10-uo',        'assets/robots/10/Uo.png'],
    ];
    for (const [key, path] of DRONE_FILE_MANIFEST) {
      this.load.image(key, path);
    }

    // Parallax background layers — 8 sets × 2 time-of-day variants × 5 layers = 80 images.
    // Key convention: `bg-{set}-{tod}-{layer}`  e.g. `bg-3-night-2`
    for (let set = 1; set <= 8; set++) {
      for (const tod of ['Day', 'Night'] as const) {
        for (let layer = 1; layer <= 5; layer++) {
          this.load.image(
            `bg-${set}-${tod.toLowerCase()}-${layer}`,
            `assets/backgrounds/${set}/${tod}/${layer}.png`,
          );
        }
      }
    }

    // Artifact animations — 3 collections × 20 spritesheets each; 4 frames of 20×20 px.
    // Keys: artifact-{collection}-{n}  (e.g. artifact-alpha-3)
    for (let n = 1; n <= 20; n++) {
      this.load.spritesheet(`artifact-root-${n}`,  `assets/artifacts/${n}.png`,        { frameWidth: 20, frameHeight: 20 });
      this.load.spritesheet(`artifact-alpha-${n}`, `assets/artifacts/alpha/${n}.png`,  { frameWidth: 20, frameHeight: 20 });
      this.load.spritesheet(`artifact-beta-${n}`,  `assets/artifacts/beta/${n}.png`,   { frameWidth: 20, frameHeight: 20 });
    }
  }

  async create() {
    try {
      // Register diagnostic wireframe PostFX pipeline (WebGL only — no-op in Canvas)
      if (this.game.renderer.type === Phaser.WEBGL) {
        const r = this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
        if (!r.pipelines.has(DIAGNOSTIC_FX)) {
          r.pipelines.addPostPipeline(DIAGNOSTIC_FX, DiagnosticFXPipeline);
        }
      }

      // Initialize GameManager with loaded data
      const gameManager = GameManager.getInstance();
      await gameManager.initialize(this, 'data/config.json', 'data/items.json');
      
      // Initialize SettingsManager
      const settingsManager = SettingsManager.getInstance();
      await settingsManager.loadSettings();
      
      const config = gameManager.getConfig();

      // Now load root dial icon (if path is specified)
      if (config.rootDialIconPath) {
        this.load.image('rootDialIcon', config.rootDialIconPath);
      }

      // Load all sprite atlases (replaces the individual per-sprite loads)
      AssetLoader.preloadAtlases(this);
      
      // Start load and wait for completion
      this.load.start();
      
      // Wait for all assets to load
      await new Promise<void>((resolve) => {
        this.load.once('complete', () => {
          resolve();
        });
      });
      
      // Register artifact animations (4-frame horizontal strips at 8 fps).
      for (const col of ['root', 'alpha', 'beta']) {
        for (let n = 1; n <= 20; n++) {
          const key = `artifact-${col}-${n}`;
          if (!this.anims.exists(key) && this.textures.exists(key)) {
            this.anims.create({
              key,
              frames:    this.anims.generateFrameNumbers(key, { start: 0, end: 3 }),
              frameRate: 8,
              repeat:    -1,
            });
          }
        }
      }

      // Transition to MainMenu
      this.scene.start('MainMenu');
    } catch (error) {
      console.error('Failed to initialize game:', error);
      // Fallback to MainMenu anyway for now
      this.scene.start('MainMenu');
    }
  }
}