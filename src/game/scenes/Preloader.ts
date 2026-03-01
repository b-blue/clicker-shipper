import { GameManager } from '../managers/GameManager';
import { SettingsManager } from '../managers/SettingsManager';
import { AssetLoader } from '../managers/AssetLoader';
import { DiagnosticFXPipeline, DIAGNOSTIC_FX } from '../fx/DiagnosticFXPipeline';
import { RadDialConfig } from '../types/RadDialTypes';

export class Preloader extends Phaser.Scene {
  constructor() {
    super('Preloader');
  }

  preload() {
    // Wire up loading-bar progress so the indeterminate sweep transitions to a
    // deterministic fill once Phaser starts reporting actual load progress.
    const fill = document.getElementById('loading-bar-fill');
    if (fill) {
      this.load.on('progress', (value: number) => {
        fill.style.animation  = 'none';
        fill.style.transform  = 'none';
        fill.style.width      = `${Math.round(value * 100)}%`;
      });
    }

    // Load config and core data
    this.load.json('config',   'data/config.json');
    this.load.json('rad-dial', 'data/rad-dial.json');

    // Queue per-mode item files immediately after rad-dial.json is registered
    // so they all download in parallel.  Each file is cached under the action id
    // (e.g. 'action_reorient') which GameManager reads back in create().
    // We read the JSON synchronously here because the file list is embedded in
    // a tiny inline config object, not a network request — Phaser queues it
    // before the XHR batch fires, so the keys are set when progress reaches 1.
    //
    // Note: a proper two-pass load (load rad-dial first, callback to load mode
    // files) would require an extra Phaser load cycle. Instead we replicate the
    // action list here as a constant that must stay in sync with rad-dial.json.
    // The runtime path (GameManager.buildModeStores) is tolerant of missing keys.
    const radDial = this.cache?.json?.get('rad-dial') as RadDialConfig | null;
    if (radDial) {
      for (const action of radDial.actions) {
        if (action.itemsFile) {
          this.load.json(action.id, action.itemsFile);
        }
      }
    } else {
      // Fallback: rad-dial.json not yet in cache (first call before XHR batch).
      // Hardcode the mode file list so they still load in the same batch.
      const MODE_FILES: Array<[string, string]> = [
        ['action_reorient', 'data/modes/reorient/items.json'],
        ['action_replace',  'data/modes/replace/items.json'],
        ['action_rewire',   'data/modes/rewire/items.json'],
        ['action_rebuild',  'data/modes/rebuild/items.json'],
        ['action_refuel',   'data/modes/refuel/items.json'],
        ['action_recharge', 'data/modes/recharge/items.json'],
      ];
      for (const [key, path] of MODE_FILES) {
        this.load.json(key, path);
      }
    }

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

      ['drone-16-idle',      'assets/drones/16/Idle.png'],

      ['drone-17-idle',      'assets/drones/17/Idle.png'],

      // ── Robots 1-11 ───────────────────────────────────────────────────
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

      ['robot-11-idle',      'assets/robots/11/Idle.png'],
    ];
    for (const [key, path] of DRONE_FILE_MANIFEST) {
      this.load.image(key, path);
    }

    // Explosion effects — 4 size tiers × 3 variants each.
    // All strips are horizontal with square frames; height equals frame size.
    // Keys: explosion-tiny-{1-3}, explosion-low-{1-3}, explosion-mid-{1-3}, explosion-high-{1-3}
    const EXPLOSION_MANIFEST: Array<[string, string, number]> = [
      ['explosion-tiny-1', 'assets/effects/explosions/1 Tiny/1.png',    32],
      ['explosion-tiny-2', 'assets/effects/explosions/1 Tiny/2.png',    32],
      ['explosion-tiny-3', 'assets/effects/explosions/1 Tiny/3.png',    32],
      ['explosion-low-1',  'assets/effects/explosions/2 Low/1.png',     48],
      ['explosion-low-2',  'assets/effects/explosions/2 Low/2.png',     48],
      ['explosion-low-3',  'assets/effects/explosions/2 Low/3.png',     48],
      ['explosion-mid-1',  'assets/effects/explosions/3 Middle/1.png',  72],
      ['explosion-mid-2',  'assets/effects/explosions/3 Middle/2.png',  72],
      ['explosion-mid-3',  'assets/effects/explosions/3 Middle/3.png',  72],
      ['explosion-high-1', 'assets/effects/explosions/4 High/1.png',    96],
      ['explosion-high-2', 'assets/effects/explosions/4 High/2.png',    96],
      ['explosion-high-3', 'assets/effects/explosions/4 High/3.png',    96],
    ];
    for (const [key, path, frameSize] of EXPLOSION_MANIFEST) {
      this.load.spritesheet(key, path, { frameWidth: frameSize, frameHeight: frameSize });
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

    // Artifact animations — alpha and beta collections, 20 spritesheets each; 4 frames of 20×20 px.
    // Keys: artifact-alpha-{n}, artifact-beta-{n}
    for (let n = 1; n <= 20; n++) {
      this.load.spritesheet(`artifact-alpha-${n}`, `assets/artifacts/alpha/${n}.png`,  { frameWidth: 20, frameHeight: 20 });
      this.load.spritesheet(`artifact-beta-${n}`,  `assets/artifacts/beta/${n}.png`,   { frameWidth: 20, frameHeight: 20 });
    }

    // Sprite atlases — queued here so they download in parallel with the
    // drone/robot/background sprites rather than after a sequential create() chain.
    AssetLoader.preloadAtlases(this);
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

      // Initialize managers in parallel — GameManager reads from the Phaser JSON
      // cache (populated in preload()); SettingsManager reads localStorage or
      // fetches the tiny settings.json. Neither blocks on a network round-trip.
      const gameManager     = GameManager.getInstance();
      const settingsManager = SettingsManager.getInstance();
      await Promise.all([
        gameManager.initialize(this, 'data/config.json'),
        settingsManager.loadSettings(),
      ]);

      const config = gameManager.getConfig();

      // If a one-off root-dial icon is configured, load it now (rare case).
      if (config.rootDialIconPath) {
        this.load.image('rootDialIcon', config.rootDialIconPath);
        this.load.start();
        await new Promise<void>(resolve => this.load.once('complete', resolve));
      }
      
      // Register artifact animations (4-frame horizontal strips at 8 fps).
      for (const col of ['alpha', 'beta']) {
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

      // Register explosion animations — play-once at 12 fps.
      // Phaser knows the frame count because these were loaded as spritesheets.
      for (const tier of ['tiny', 'low', 'mid', 'high']) {
        for (let n = 1; n <= 3; n++) {
          const key = `explosion-${tier}-${n}`;
          if (!this.anims.exists(key) && this.textures.exists(key)) {
            this.anims.create({
              key,
              frames:    this.anims.generateFrameNumbers(key, { start: 0, end: -1 }),
              frameRate: 12,
              repeat:    0,
            });
          }
        }
      }

      // Warm up web fonts: the hidden font-primer elements in index.html force the
      // browser to download the font files via CSS. document.fonts.ready resolves
      // only after all referenced @font-face fonts finish loading.
      await document.fonts.ready;

      // Probe Text objects prime the Phaser/canvas font metric cache so the canvas
      // 2D context has measured the glyphs before any visible scene draws.
      const _m = this.add.text(-9999, -9999, 'AaBbCc', { fontFamily: 'Minotaur', fontSize: '16px', color: '#000000' });
      const _h = this.add.text(-9999, -9999, '0123456789', { fontFamily: 'Hack', fontSize: '16px', color: '#000000' });

      // One rAF tick so the canvas context actually renders (and caches) the probes.
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

      // All assets and fonts are ready — dismiss the HTML loading screen.
      document.getElementById('loading-screen')?.remove();

      // Transition to MainMenu
      this.scene.start('MainMenu');
      _m.destroy();
      _h.destroy();
    } catch (error) {
      console.error('Failed to initialize game:', error);
      document.getElementById('loading-screen')?.remove();
      // Fallback to MainMenu anyway for now
      this.scene.start('MainMenu');
    }
  }
}