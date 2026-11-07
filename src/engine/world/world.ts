/**
 * VoxelCraft Engine — World manager (chunk loading + worldgen)
 *
 * MVP: keep a fixed NxN grid of chunks centered on the player (render distance).
 * Worldgen is a simple value-noise heightmap with stone/grass/dirt/bedrock
 * stratification. Trees are random log+leaves columns — faithful to MCPE
 * classic-tree shape (4-tall trunk, 5x5x3 leaves).
 *
 * Reference: rujukan BiomeSource.cpp / NormalWorldGenerator — MVP version,
 * real 0.7.x biome system (Biome, BiomeSource, BirchFeature, CanyonFeature,
 * DungeonFeature, LakeFeature) is in later iterations.
 */

import { Chunk } from './chunk';
import { Noise } from '../core/math';
import { CHUNK_SIZE, CHUNK_HEIGHT, BlockId } from '../core/types';

export class World {
  readonly seed: number;
  readonly noise: Noise;
  readonly treeNoise: Noise;
  readonly chunks: Map<string, Chunk> = new Map();
  readonly renderDistance: number; // chunks in each direction (MVP: 4)

  constructor(seed: number, renderDistance = 4) {
    this.seed = seed;
    this.noise = new Noise(seed);
    this.treeNoise = new Noise(seed ^ 0xDEADBEEF);
    this.renderDistance = renderDistance;
  }

  private key(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

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

  // Worldgen — heightmap-based for MVP. Real 0.7.x has biome-aware generation
  // but the math is similar (per-column heightmap + ore scatter + trees).
  private generate(chunk: Chunk): void {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;
    const SEA_LEVEL = 62; // MCPE 2013 sea level
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = baseX + x;
        const wz = baseZ + z;
        // Two-octave value noise for slightly rolling hills
        const n = this.noise.value2(wx * 0.05, wz * 0.05) * 0.7
                + this.noise.value2(wx * 0.0125, wz * 0.0125) * 0.3;
        const h = Math.floor(60 + n * 12); // 60..72

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          let id = BlockId.AIR;
          if (y < 3) {
            id = BlockId.BEDROCK;
          } else if (y < h - 5) {
            id = BlockId.STONE;
          } else if (y < h) {
            id = BlockId.DIRT;
          } else if (y === h) {
            id = y < SEA_LEVEL ? BlockId.SAND : BlockId.GRASS;
          } else if (y <= SEA_LEVEL && y > h) {
            id = BlockId.WATER;
          }
          chunk.set(x, y, z, id);
        }

        // Trees: low-frequency noise check, only on grass above sea level
        if (h >= SEA_LEVEL && chunk.get(x, h, z) === BlockId.GRASS) {
          // Deterministic tree position: treeNoise value > 0.96 AND column corner check
          const tn = this.treeNoise.value2(wx * 0.7 + 100, wz * 0.7 + 100);
          // Use raw hash for a sparse scatter; avoid trees in adjacent cells
          const hash = ((wx * 73856093) ^ (wz * 19349663)) >>> 0;
          if (tn > 0.85 && hash % 17 === 0 && x > 1 && x < CHUNK_SIZE - 2 && z > 1 && z < CHUNK_SIZE - 2) {
            this.plantTree(chunk, x, h + 1, z);
          }
        }
      }
    }
  }

  private plantTree(chunk: Chunk, x: number, baseY: number, z: number): void {
    const trunkH = 4 + ((this.treeNoise.value2(x, z) * 3) | 0); // 4..6
    for (let i = 0; i < trunkH; i++) {
      chunk.set(x, baseY + i, z, BlockId.LOG);
    }
    const top = baseY + trunkH - 1;
    // Leaves: 3 layers, lower 2 are 5x5 with trimmed corners, top is 3x3.
    for (let dy = -1; dy <= 1; dy++) {
      const r = dy === 1 ? 1 : 2;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (dx === 0 && dz === 0 && dy < 1) continue; // leave trunk alone
          // trim corners on the wide layer for roundness
          if (Math.abs(dx) === r && Math.abs(dz) === r) continue;
          const yy = top + dy;
          if (yy >= 0 && yy < CHUNK_HEIGHT) {
            chunk.set(x + dx, yy, z + dz, BlockId.LEAVES);
          }
        }
      }
    }
  }

  // Public API for block lookup in world coordinates (used by renderer + player).
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
