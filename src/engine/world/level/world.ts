/**
 * VoxelCraft Engine — World manager (chunk loading + worldgen)
 *
 * Iteration 3: keeps the finite 256×256×128 world from LevelConstants.h
 * (the actual 0.7.x world dimensions). Worldgen MVP uses value-noise
 * heightmap + bedrock floor + grass-on-top + random tree scatter.
 *
 * Iter 4 will translate BiomeSource + NormalWorldGenerator from the source
 * so the worldgen matches 0.7.x biomes (Plains, Forest, Desert, Tundra).
 */

import { Chunk } from './chunk';
import { Noise } from '../../render/math';
import { CHUNK_SIZE, CHUNK_HEIGHT, BlockId } from '../../core/core-types';

export class World {
  readonly seed: number;
  readonly noise: Noise;
  readonly treeNoise: Noise;
  readonly chunks: Map<string, Chunk> = new Map();
  readonly renderDistance: number;

  constructor(seed: number, renderDistance = 4) {
    this.seed = seed;
    this.noise = new Noise(seed);
    this.treeNoise = new Noise(seed ^ 0xDEADBEEF);
    this.renderDistance = renderDistance;
  }

  private key(cx: number, cz: number): string { return `${cx},${cz}`; }

  getChunk(cx: number, cz: number): Chunk {
    const k = this.key(cx, cz);
    let c = this.chunks.get(k);
    if (!c) {
      c = new Chunk(cx, cz);
      this.generate(c);
      this.chunks.set(k, c);
    }
    return c;
  }

  private generate(chunk: Chunk): void {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;
    const SEA_LEVEL = 62;
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = baseX + x;
        const wz = baseZ + z;
        const n = this.noise.value2(wx * 0.05, wz * 0.05) * 0.7
                + this.noise.value2(wx * 0.0125, wz * 0.0125) * 0.3;
        const h = Math.floor(60 + n * 12);

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          let id = BlockId.AIR;
          if (y < 3) id = BlockId.BEDROCK;
          else if (y < h - 5) id = BlockId.STONE;
          else if (y < h) id = BlockId.DIRT;
          else if (y === h) id = y < SEA_LEVEL ? BlockId.SAND : BlockId.GRASS;
          else if (y <= SEA_LEVEL && y > h) id = BlockId.WATER;
          chunk.set(x, y, z, id);
        }

        if (h >= SEA_LEVEL && chunk.get(x, h, z) === BlockId.GRASS) {
          const tn = this.treeNoise.value2(wx * 0.7 + 100, wz * 0.7 + 100);
          const hash = ((wx * 73856093) ^ (wz * 19349663)) >>> 0;
          if (tn > 0.85 && hash % 17 === 0 && x > 1 && x < CHUNK_SIZE - 2 && z > 1 && z < CHUNK_SIZE - 2) {
            this.plantTree(chunk, x, h + 1, z);
          }
        }
      }
    }
  }

  private plantTree(chunk: Chunk, x: number, baseY: number, z: number): void {
    const trunkH = 4 + ((this.treeNoise.value2(x, z) * 3) | 0);
    for (let i = 0; i < trunkH; i++) {
      chunk.set(x, baseY + i, z, BlockId.LOG);
    }
    const top = baseY + trunkH - 1;
    for (let dy = -1; dy <= 1; dy++) {
      const r = dy === 1 ? 1 : 2;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (dx === 0 && dz === 0 && dy < 1) continue;
          if (Math.abs(dx) === r && Math.abs(dz) === r) continue;
          const yy = top + dy;
          if (yy >= 0 && yy < CHUNK_HEIGHT) {
            chunk.set(x + dx, yy, z + dz, BlockId.LEAVES);
          }
        }
      }
    }
  }

  getBlock(wx: number, wy: number, wz: number): number {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return BlockId.AIR;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    return chunk.get(wx - cx * CHUNK_SIZE, wy, wz - cz * CHUNK_SIZE);
  }

  setBlock(wx: number, wy: number, wz: number, id: number): void {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    chunk.set(wx - cx * CHUNK_SIZE, wy, wz - cz * CHUNK_SIZE, id);
  }
}
