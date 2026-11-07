/**
 * VoxelCraft Engine — Chunk (16x128x16)
 *
 * Faithful to MCPE 0.7.x chunk dimensions. 0.9.0+ moved to 256 + infinite,
 * but 0.7.x is the classic finite-island era.
 *
 * Storage: Uint8Array CHUNK_VOLUME bytes. Block ID 0 = AIR.
 *
 * Indexing: idx = x + z * CHUNK_SIZE + y * CHUNK_AREA
 * (Y-major so a vertical column reads sequentially in memory — same order
 * as MCPE's ChunkStorage.)
 */

import { CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_AREA, CHUNK_VOLUME, BlockId } from '../core/types';

export class Chunk {
  readonly cx: number;
  readonly cz: number;
  readonly blocks: Uint8Array;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_VOLUME);
  }

  static idx(x: number, y: number, z: number): number {
    return x + z * CHUNK_SIZE + y * CHUNK_AREA;
  }

  get(x: number, y: number, z: number): number {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return BlockId.AIR;
    }
    return this.blocks[Chunk.idx(x, y, z)];
  }

  set(x: number, y: number, z: number, id: number): void {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) return;
    this.blocks[Chunk.idx(x, y, z)] = id;
  }
}
