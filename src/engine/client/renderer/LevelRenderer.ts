/**
 * Translation of: client/renderer/LevelRenderer.{h,cpp} (subset)
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/client/renderer/LevelRenderer.{h,cpp}
 *
 * The C++ class drives a display-list-based chunk renderer using GLES1
 * fixed-function pipeline. We keep the high-level structure but bridge to
 * our WebGPU/WebGL2 renderer (renderer.ts + chunk-mesh.ts). Methods that
 * translate cleanly:
 *
 *   - allChanged()           — allocates the chunk array based on view distance
 *   - tick()                 — increments frame counter
 *   - tileChanged/setTilesDirty — adds affected chunks to dirty queue
 *   - setDirty(x0,y0,z0,x1,y1,z1) — mark region dirty
 *   - updateDirtyChunks(player, force) — rebuilds a few chunks per frame
 *
 * Constants preserved from LevelRenderer.h:
 *   - CHUNK_SIZE = 16
 *   - MAX_VISIBLE_REBUILDS_PER_FRAME = 3
 *   - MAX_INVISIBLE_REBUILDS_PER_FRAME = 1
 *
 * Constants preserved from LevelRenderer.cpp allChanged():
 *   - dist = (512 >> 3) << (3 - lastViewDistance)
 *   - dist capped at 400
 *   - xChunks/zChunks = dist / CHUNK_SIZE + 1
 *   - yChunks = 128 / CHUNK_SIZE = 8
 *
 * Not translated (GLES1-specific):
 *   - render(player, layer, alpha) — delegates to our renderer
 *   - renderSky/renderClouds — deferred
 *   - renderHit/renderHitOutline/renderHitSelect — block-highlight overlay (deferred)
 *   - occlusion queries (GL ARB_occlusion_query) — not available in WebGPU
 *   - generateSky — vertex buffer of stars (deferred)
 *   - cull(Culler*) — frustum culling (deferred until proper frustum math)
 */

import { Mth } from '../../util/Mth';
import { CHUNK_SIZE } from '../../core/core-types';
import type { Level } from '../../world/level/Level';
import type { Mob } from '../../world/entity/Mob';
import type { IRenderer } from '../../render/irenderer';
import { buildChunkMesh } from '../../render/chunk-mesh';
import type { World } from '../../world/level/world';

export class LevelRenderer {
  static readonly CHUNK_SIZE = CHUNK_SIZE;
  static readonly MAX_VISIBLE_REBUILDS_PER_FRAME = 3;
  static readonly MAX_INVISIBLE_REBUILDS_PER_FRAME = 1;

  xOld = 0; yOld = 0; zOld = 0;
  destroyProgress = 0;

  level: Level | null = null;
  world: World | null = null;
  renderer: IRenderer | null = null;

  // Dirty chunk coordinates (cx, cz) — same approach as engine.ts uses.
  private dirtyChunks: Set<string> = new Set();
  private chunksLength = 0;
  private xChunks = 0;
  private yChunks = 8; // 128 / 16
  private zChunks = 0;
  private ticks = 0;
  private lastViewDistance = 2;

  // For tracking entity render counts (debug)
  noEntityRenderFrames = 2;
  totalEntities = 0;
  renderedEntities = 0;
  culledEntities = 0;

  constructor(private mc: { options: { viewDistance: number; fancyGraphics: boolean }; cameraTargetPlayer: Mob | null }) {}

  setLevel(level: Level, world: World, renderer: IRenderer): void {
    this.level = level;
    this.world = world;
    this.renderer = renderer;
    this.allChanged();
  }

  // === LevelRenderer::allChanged — translated from LevelRenderer.cpp:148 ===
  allChanged(): void {
    // Tile::leaves->setFancy(...) — would need Tile refs in TS. Skipped for now.
    this.lastViewDistance = this.mc.options.viewDistance;
    let dist = (512 >> 3) << (3 - this.lastViewDistance);
    if (dist > 400) dist = 400;
    this.xChunks = (dist / LevelRenderer.CHUNK_SIZE) + 1;
    this.yChunks = (128 / LevelRenderer.CHUNK_SIZE);
    this.zChunks = (dist / LevelRenderer.CHUNK_SIZE) + 1;
    this.chunksLength = this.xChunks * this.yChunks * this.zChunks;
    this.dirtyChunks.clear();

    // Engine.ts owns chunk meshing via its own chunksToBuild queue.
    // Mark every chunk in our view-distance grid as needing initial build.
    if (this.world && this.renderer) {
      const rd = this.world.renderDistance;
      const pcx = this.mc.cameraTargetPlayer ? Math.floor(this.mc.cameraTargetPlayer.x / CHUNK_SIZE) : 0;
      const pcz = this.mc.cameraTargetPlayer ? Math.floor(this.mc.cameraTargetPlayer.z / CHUNK_SIZE) : 0;
      for (let dx = -rd; dx <= rd; dx++) {
        for (let dz = -rd; dz <= rd; dz++) {
          this.dirtyChunks.add(`${pcx + dx},${pcz + dz}`);
        }
      }
    }
    this.noEntityRenderFrames = 2;
  }

  // === LevelRenderer::tick — verbatim ===
  tick(): void { this.ticks++; }

  // === LevelRenderer::updateDirtyChunks — partial ===
  // The C++ version sorts by distance then rebuilds a few chunks per frame.
  // We mirror that — pop the closest dirty chunk up to MAX_VISIBLE_REBUILDS_PER_FRAME
  // (3) per call.
  updateDirtyChunks(player: Mob, force: boolean): boolean {
    if (!this.world || !this.renderer || !this.level) return true;
    let rebuilt = 0;
    const maxPerFrame = LevelRenderer.MAX_VISIBLE_REBUILDS_PER_FRAME;
    // Sort dirty chunks by distance from player
    const dirtyArr = Array.from(this.dirtyChunks).map(s => {
      const [cx, cz] = s.split(',').map(Number);
      const px = cx * CHUNK_SIZE + CHUNK_SIZE / 2 - player.x;
      const pz = cz * CHUNK_SIZE + CHUNK_SIZE / 2 - player.z;
      return { key: s, cx, cz, d: px * px + pz * pz };
    });
    dirtyArr.sort((a, b) => a.d - b.d);
    for (const item of dirtyArr) {
      if (!force && item.d > 16 * 16 && rebuilt >= maxPerFrame) return false;
      this.remeshChunk(item.cx, item.cz);
      this.dirtyChunks.delete(item.key);
      rebuilt++;
      if (rebuilt >= maxPerFrame && !force) break;
    }
    return this.dirtyChunks.size === 0;
  }

  private remeshChunk(cx: number, cz: number): void {
    if (!this.world || !this.renderer || !this.level) return;
    const chunk = this.world.getChunk(cx, cz);
    const baseX = cx * CHUNK_SIZE, baseZ = cz * CHUNK_SIZE;
    const mesh = buildChunkMesh(chunk, baseX, baseZ, (wx, wy, wz) => this.world!.getBlock(wx, wy, wz));
    this.renderer.uploadChunkMesh(cx, cz, mesh);
  }

  // === LevelRenderer::tileChanged — translated ===
  tileChanged(x: number, y: number, z: number): void {
    this.setDirty(x, y, z, x, y, z);
  }

  // === LevelRenderer::setTilesDirty — translated ===
  setTilesDirty(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    this.setDirty(x0, y0, z0, x1, y1, z1);
  }

  // === LevelRenderer::setDirty — translated ===
  setDirty(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    const cx0 = Math.floor(x0 / CHUNK_SIZE);
    const cx1 = Math.floor(x1 / CHUNK_SIZE);
    const cz0 = Math.floor(z0 / CHUNK_SIZE);
    const cz1 = Math.floor(z1 / CHUNK_SIZE);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cz = cz0; cz <= cz1; cz++) {
        // Mark this chunk + neighbors (for cross-seam face updates).
        this.dirtyChunks.add(`${cx},${cz}`);
        const lx0 = x0 - cx * CHUNK_SIZE;
        const lx1 = x1 - cx * CHUNK_SIZE;
        const lz0 = z0 - cz * CHUNK_SIZE;
        const lz1 = z1 - cz * CHUNK_SIZE;
        if (lx0 === 0) this.dirtyChunks.add(`${cx - 1},${cz}`);
        if (lx1 === CHUNK_SIZE - 1) this.dirtyChunks.add(`${cx + 1},${cz}`);
        if (lz0 === 0) this.dirtyChunks.add(`${cx},${cz - 1}`);
        if (lz1 === CHUNK_SIZE - 1) this.dirtyChunks.add(`${cx},${cz + 1}`);
      }
    }
  }

  // === LevelRenderer listeners (LevelListener interface) ===
  entityAdded(_entity: unknown): void {}
  skyColorChanged(): void {}
  onGraphicsReset(): void { this.allChanged(); }

  // === Helpers ===
  gatherStats1(): string {
    return `chunks: ${this.chunksLength}, dirty: ${this.dirtyChunks.size}, ticks: ${this.ticks}`;
  }

  isDirty(): boolean { return this.dirtyChunks.size > 0; }
}
