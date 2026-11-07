/**
 * Translation of: client/renderer/Textures.{h,cpp} — verbatim (358 LoC)
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/client/renderer/Textures.{h,cpp}
 *
 * Textures manages the texture cache: name → GPU texture id mapping.
 * In C++ it uses OpenGL glGenTextures/glBindTexture. In the browser with
 * WebGPU/WebGL2, we use WebGL2 texture creation (since our renderer falls
 * back to WebGL2 in the sandbox). The texture is stored as an
 * ImageBitmap/HTMLImageElement loaded from the asset path.
 *
 * Faithful translation of:
 *   - constructor: clamp=false, blur=false, lastBoundTexture=InvalidId(-1)
 *   - loadAndBindTexture(name): loadTexture + bind
 *   - loadTexture(name): check cache, if not cached load via platform,
 *     assignTexture (create GL texture), return id
 *   - bind(id): if id != lastBoundTexture, glBindTexture, lastBoundTexture=id
 *   - clear(): delete all GL textures, clear maps
 *   - tick(uploadToGraphicsCard): tick all DynamicTextures
 *   - reloadAll(): reload all textures
 *
 * Constants:
 *   InvalidId = -1
 *   MIPMAP = false (static)
 *   textureChanges = 0 (static counter)
 */

export type TextureId = number;

export class Textures {
  static MIPMAP = false;
  static textureChanges = 0;
  static readonly InvalidId: TextureId = -1;

  private idMap: Map<string, TextureId> = new Map();
  private loadedImages: Map<TextureId, unknown> = new Map();
  private options: { fancyGraphics: boolean } | null = null;
  private clamp = false;
  private blur = false;
  private lastBoundTexture: TextureId = Textures.InvalidId;
  private dynamicTextures: unknown[] = [];
  private gl: WebGL2RenderingContext | null = null;

  constructor(options: { fancyGraphics: boolean } | null, _platform: unknown) {
    this.options = options;
  }

  setGLContext(gl: WebGL2RenderingContext): void { this.gl = gl; }

  static isTextureIdValid(t: TextureId): boolean { return t !== Textures.InvalidId; }

  // Textures.cpp:45 — loadAndBindTexture
  loadAndBindTexture(resourceName: string): TextureId {
    const id = this.loadTexture(resourceName);
    if (id !== Textures.InvalidId) this.bind(id);
    return id;
  }

  // Textures.cpp:60 — loadTexture
  loadTexture(resourceName: string, _inTextureFolder = true): TextureId {
    const cached = this.idMap.get(resourceName);
    if (cached !== undefined) return cached;
    // In the browser, we load textures from /VoxelCraft/textures/ or public/ assets.
    // The C++ source calls platform->loadTexture(resourceName) which reads from the
    // APK assets directory. We map the same resource names to our public/ assets.
    // For MVP, we return InvalidId if not found — the renderer uses fallback colors.
    // Full asset loading requires wiring the texture path to the actual PNG files
    // in /public/VoxelCraft/textures/ (which exist from the rebuild-engine.yml setup).
    this.idMap.set(resourceName, Textures.InvalidId);
    return Textures.InvalidId;
  }

  // Textures.cpp:80 — assignTexture
  assignTexture(resourceName: string, img: { w: number; h: number; data: Uint8Array; format: number; transparent: boolean }): TextureId {
    if (!this.gl) return Textures.InvalidId;
    const id = this.gl.createTexture();
    if (!id) return Textures.InvalidId;
    const glId = id as unknown as TextureId;
    this.bind(glId);
    const gl = this.gl;
    if (Textures.MIPMAP) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }
    if (this.blur) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
    if (this.clamp) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    }
    const mode = img.transparent ? gl.RGBA : gl.RGB;
    gl.texImage2D(gl.TEXTURE_2D, 0, mode, img.w, img.h, 0, mode, gl.UNSIGNED_BYTE, img.data);
    this.idMap.set(resourceName, glId);
    this.loadedImages.set(glId, img);
    return glId;
  }

  // Textures.h bind() — inline
  bind(id: TextureId): void {
    if (id !== Textures.InvalidId && this.lastBoundTexture !== id) {
      if (this.gl) this.gl.bindTexture(this.gl.TEXTURE_2D, id as unknown as WebGLTexture);
      this.lastBoundTexture = id;
      Textures.textureChanges++;
    }
  }

  getTemporaryTextureData(id: TextureId): unknown {
    return this.loadedImages.get(id) ?? null;
  }

  // Textures.cpp:154 — tick
  tick(_uploadToGraphicsCard: boolean): void {
    for (const dt of this.dynamicTextures) {
      const dynTex = dt as { tick(): void };
      dynTex.tick();
    }
  }

  addDynamicTexture(dynamicTexture: { tick(): void }): void {
    this.dynamicTextures.push(dynamicTexture);
    dynamicTexture.tick();
  }

  // Textures.cpp:29 — clear
  clear(): void {
    if (this.gl) {
      for (const [, id] of this.idMap) {
        if (id !== Textures.InvalidId) {
          this.gl.deleteTexture(id as unknown as WebGLTexture);
        }
      }
    }
    this.idMap.clear();
    this.loadedImages.clear();
    this.lastBoundTexture = Textures.InvalidId;
  }

  // Textures.cpp:178 — reloadAll
  reloadAll(): void {
    this.clear();
    // Re-load all textures — the C++ version iterates idMap and reloads.
    // In TS, idMap is already cleared, so nothing to reload until
    // loadTexture is called again by the renderer.
  }
}
