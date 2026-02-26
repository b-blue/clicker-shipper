/**
 * DiagnosticFXPipeline — PostFX pipeline that renders an animated sprite as a
 * neon wireframe by running a Sobel edge-detection pass on the alpha channel.
 *
 * The sprite body is discarded; only detected edges are emitted, coloured with
 * the configurable `uEdgeColor` uniform (default: #00e864 neon green).
 *
 * Registration (once, in Preloader):
 *   renderer.pipelines.addPostPipeline(DIAGNOSTIC_FX, DiagnosticFXPipeline)
 *
 * Application (per sprite):
 *   sprite.setPostPipeline(DIAGNOSTIC_FX)
 */

/** Pipeline name constant — use this string for both registration and application. */
export const DIAGNOSTIC_FX = 'DiagnosticFX';

// ── Fragment shader ───────────────────────────────────────────────────────────
// Samples the 3×3 neighbourhood of each fragment's alpha channel using a Sobel
// kernel, computes edge magnitude, and outputs only pixels where that magnitude
// exceeds `uThreshold`.  The fill (opaque non-edge pixels) is discarded so the
// drone appears as an outline drawing rather than a solid sprite.
const FRAG_SHADER = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform vec2      uTexelSize;
uniform vec3      uEdgeColor;
uniform float     uThreshold;
uniform float     uGain;

varying vec2 outTexCoord;

void main () {
  vec2 uv = outTexCoord;

  // Sample 3×3 alpha neighbourhood
  float tl = texture2D(uMainSampler, uv + vec2(-uTexelSize.x,  uTexelSize.y)).a;
  float t  = texture2D(uMainSampler, uv + vec2( 0.0,           uTexelSize.y)).a;
  float tr = texture2D(uMainSampler, uv + vec2( uTexelSize.x,  uTexelSize.y)).a;
  float l  = texture2D(uMainSampler, uv + vec2(-uTexelSize.x,  0.0         )).a;
  float r  = texture2D(uMainSampler, uv + vec2( uTexelSize.x,  0.0         )).a;
  float bl = texture2D(uMainSampler, uv + vec2(-uTexelSize.x, -uTexelSize.y)).a;
  float b  = texture2D(uMainSampler, uv + vec2( 0.0,          -uTexelSize.y)).a;
  float br = texture2D(uMainSampler, uv + vec2( uTexelSize.x, -uTexelSize.y)).a;

  // Sobel gradients
  float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
  float gy = -tl - 2.0*t - tr + bl + 2.0*b  + br;
  float edge = sqrt(gx*gx + gy*gy);

  float s = clamp(edge * uGain, 0.0, 1.0);
  if (s < uThreshold) discard;

  gl_FragColor = vec4(uEdgeColor * s, s);
}
`.trim();

// ── Pipeline class ────────────────────────────────────────────────────────────

export class DiagnosticFXPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor (game: Phaser.Game) {
    super({ game, name: DIAGNOSTIC_FX, fragShader: FRAG_SHADER });
  }

  /** Set default uniform values once the pipeline has booted. */
  onBoot (): void {
    this.set3f('uEdgeColor', 0.0, 0.910, 0.392);  // #00e864 neon green
    this.set1f('uThreshold', 0.22);
    this.set1f('uGain',      2.8);
  }

  /**
   * Called each time this pipeline renders a game object.
   * Compute the correct texel size from the render-target dimensions so the
   * Sobel kernel always samples exactly one pixel apart regardless of the
   * sprite's texture or display size.
   */
  onDraw (renderTarget: Phaser.Renderer.WebGL.RenderTarget): void {
    this.set2f('uTexelSize', 1 / renderTarget.width, 1 / renderTarget.height);
    this.bindAndDraw(renderTarget);
  }
}
