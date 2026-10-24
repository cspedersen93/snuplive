"use client";

// Kamerafiltre i studiet: "Lys op" og "Slør baggrund".
// Alt kører på sælgerens egen enhed. Billedet bliver ikke sendt nogen steder hen for at blive behandlet.
// Modulet hentes først, når studiet åbner (dynamisk import), så resten af siden ikke bliver tungere.

import * as vision from "@mediapipe/tasks-vision";
import {
  BackgroundTransformer,
  ProcessorWrapper,
  VideoTransformer,
  supportsBackgroundProcessors,
  type BackgroundOptions,
  type TrackTransformerDestroyOptions,
  type VideoTransformerInitOptions,
} from "@livekit/track-processors";

export interface CameraFilters {
  /** Lysere billede i dårligt lys. Ændrer ikke farvetonen. */
  brighten: boolean;
  /** Sløret baggrund bag sælgeren. */
  blur: boolean;
}

export const NO_FILTERS: CameraFilters = { brighten: false, blur: false };
export const FILTER_PROCESSOR = "relived-filtre";
const BLUR_RADIUS = 14;
// MediaPipe-filerne ligger på vores egen server (kopieres fra node_modules ved build).
const ASSETS = "/mediapipe";

export function filtersSupported() {
  try {
    return supportsBackgroundProcessors();
  } catch {
    return false;
  }
}

/* ── Lys op: løfter mørke og mellemtoner, men beholder farvetonen ─────────────────────────── */

const VERT = `#version 300 es
in vec2 p;
out vec2 uv;
void main() {
  uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision mediump float;
in vec2 uv;
uniform sampler2D frame;
out vec4 color;
void main() {
  vec3 c = texture(frame, uv).rgb;
  float y = max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 0.0001);
  float lifted = pow(y, 0.75);
  vec3 o = c * (lifted / y);
  // Samme farvetone: bliver en kanal for lys, skaleres alle tre ned sammen i stedet for at klippe.
  o /= max(1.0, max(o.r, max(o.g, o.b)));
  color = vec4(o, 1.0);
}`;

class Lift {
  private canvas = new OffscreenCanvas(2, 2);
  private gl: WebGL2RenderingContext | null;
  private prog: WebGLProgram | null = null;
  private tex: WebGLTexture | null = null;
  private buf: WebGLBuffer | null = null;

  constructor() {
    this.gl = this.canvas.getContext("webgl2", { alpha: false, antialias: false, premultipliedAlpha: false }) as WebGL2RenderingContext | null;
    const gl = this.gl;
    if (!gl) return;
    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader");
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "program");
    this.prog = prog;
    this.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.useProgram(prog);
    gl.uniform1i(gl.getUniformLocation(prog, "frame"), 0);
  }

  /** Et lysere billede, eller null, hvis enheden ikke kan. */
  apply(frame: VideoFrame): VideoFrame | null {
    const gl = this.gl;
    if (!gl || !this.prog) return null;
    const w = frame.displayWidth;
    const h = frame.displayHeight;
    if (!w || !h) return null;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return new VideoFrame(this.canvas, { timestamp: frame.timestamp, duration: frame.duration ?? undefined });
  }

  close() {
    const gl = this.gl;
    if (!gl) return;
    gl.deleteTexture(this.tex);
    gl.deleteBuffer(this.buf);
    gl.deleteProgram(this.prog);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    this.gl = null;
  }
}

/* ── Begge filtre i én behandling af kamerabilledet ──────────────────────────────────────── */

class RelivedTransformer extends BackgroundTransformer {
  want: CameraFilters;
  private lift: Lift | null = null;
  private liftFailed = false;
  private loading: Promise<boolean> | null = null;

  constructor(want: CameraFilters) {
    // Baggrunden er slået fra, til modellen til at finde personen er hentet.
    super({ backgroundDisabled: true });
    this.want = want;
  }

  async init(opts: VideoTransformerInitOptions) {
    // Kun opsætningen af billedbehandlingen. Modellen hentes først, når baggrunden skal sløres,
    // så "Lys op" alene ikke koster en stor download.
    await VideoTransformer.prototype.init.call(this, opts);
    this.imageSegmenter = undefined;
    await this.applyWant();
    if (this.want.blur) void this.loadSegmenter();
  }

  async destroy(opts?: TrackTransformerDestroyOptions) {
    await super.destroy(opts);
    this.imageSegmenter = undefined;
    this.loading = null;
    this.lift?.close();
    this.lift = null;
  }

  /** Skift filtre, mens kameraet kører. Giver false, hvis baggrunden ikke kan sløres på enheden. */
  async setWant(want: CameraFilters): Promise<boolean> {
    this.want = want;
    await this.applyWant();
    if (want.blur && !this.imageSegmenter) return this.loadSegmenter();
    return true;
  }

  private loadSegmenter(): Promise<boolean> {
    if (this.imageSegmenter) return Promise.resolve(true);
    if (this.loading) return this.loading;
    const canvas = this.canvas;
    if (!canvas) return Promise.resolve(false);
    this.loading = (async () => {
      try {
        const files = await vision.FilesetResolver.forVisionTasks(`${location.origin}${ASSETS}`);
        const seg = await vision.ImageSegmenter.createFromOptions(files, {
          baseOptions: { modelAssetPath: `${location.origin}${ASSETS}/selfie_segmenter.tflite`, delegate: "GPU" },
          canvas,
          runningMode: "VIDEO",
          outputCategoryMask: true,
          outputConfidenceMasks: false,
        });
        // Kameraet er skiftet eller slukket imens: modellen hører til det gamle billede.
        if (this.canvas !== canvas || this.isDisabled) {
          seg.close();
          return false;
        }
        this.imageSegmenter = seg;
        await this.applyWant();
        return true;
      } catch (e) {
        console.warn("[relived] baggrunden kan ikke sløres:", e);
        return false;
      } finally {
        this.loading = null;
      }
    })();
    return this.loading;
  }

  private async applyWant() {
    // Sløring kræver modellen. Uden den sendes billedet videre som det er (ellers går billedet i stå).
    const blur = this.want.blur && !!this.imageSegmenter;
    await this.update({ blurRadius: blur ? BLUR_RADIUS : undefined, imagePath: undefined, backgroundDisabled: !blur });
  }

  async transform(frame: VideoFrame, controller: TransformStreamDefaultController<VideoFrame>) {
    if (this.want.brighten && !this.liftFailed && !this.isDisabled && frame.codedWidth) {
      try {
        this.lift ??= new Lift();
        const lit = this.lift.apply(frame);
        if (lit) {
          frame.close();
          frame = lit;
        }
      } catch (e) {
        console.warn("[relived] lys op virker ikke på denne enhed:", e);
        this.liftFailed = true;
      }
    }
    return super.transform(frame, controller);
  }
}

export type FilterProcessor = ProcessorWrapper<BackgroundOptions, RelivedTransformer>;

export function createFilterProcessor(want: CameraFilters): FilterProcessor {
  return new ProcessorWrapper<BackgroundOptions, RelivedTransformer>(new RelivedTransformer(want), FILTER_PROCESSOR);
}

export function filterTransformer(p: unknown): RelivedTransformer | null {
  const t = (p as { transformer?: unknown } | null | undefined)?.transformer;
  return t instanceof RelivedTransformer ? t : null;
}
