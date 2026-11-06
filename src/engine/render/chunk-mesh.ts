/**
 * VoxelCraft Engine — Chunk mesher
 *
 * Per-face culling using Tile registry's isSolidRender() (translating
 * C++ Tile::isSolidRender() / Tile::shouldRenderFace()).
 *
 * Vertex format: 24 bytes (3 floats pos + 3 floats color).
 * Quad = 2 triangles = 6 vertices. Non-indexed for simplicity.
 *
 * Per-face shading multiplier gives the cube its 3D read without a
 * lighting pass — same face-shading model MCPE 0.6.1 uses (top brightest,
 * sides medium, bottom darkest).
 */

import { CHUNK_SIZE, CHUNK_HEIGHT, TileMVPColor, isSolidBlock, BlockId } from '../core/core-types';
import { Facing } from '../shared/Facing';

type Face = {
  dir: [number, number, number];
  corners: [number, number, number][];
  shade: number;
};

const FACES: Face[] = [
  { dir: [1, 0, 0],  corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]], shade: 0.80 },
  { dir: [-1, 0, 0], corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]], shade: 0.80 },
  { dir: [0, 1, 0],  corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], shade: 1.00 },
  { dir: [0, -1, 0], corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], shade: 0.50 },
  { dir: [0, 0, 1],  corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]], shade: 0.70 },
  { dir: [0, 0, -1], corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]], shade: 0.70 },
];

export interface MeshData {
  vertices: Float32Array;
  vertexCount: number;
}

export function buildChunkMesh(
  chunk: { get(x: number, y: number, z: number): number },
  baseX: number,
  baseZ: number,
  neighborGet: (wx: number, wy: number, wz: number) => number,
): MeshData {
  const maxVerts = CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE * 6 * 6;
  const buf = new Float32Array(maxVerts * 6);
  let n = 0;

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const id = chunk.get(x, y, z);
        if (id === BlockId.AIR) continue;
        if (!isSolidBlock(id)) continue; // skip water/lava/non-solid for now

        const color = TileMVPColor[id] ?? [0.8, 0.2, 0.8];
        const wx = baseX + x;
        const wz = baseZ + z;

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const nx = wx + face.dir[0];
          const ny = y + face.dir[1];
          const nz = wz + face.dir[2];
          // Cull face if neighbor is solid (opaque).
          const nbId = neighborGet(nx, ny, nz);
          if (isSolidBlock(nbId) && nbId !== BlockId.GLASS) continue;

          const r = color[0] * face.shade;
          const g = color[1] * face.shade;
          const b = color[2] * face.shade;

          const order = [0, 1, 2, 0, 2, 3];
          for (const i of order) {
            const c = face.corners[i];
            buf[n++] = wx + c[0];
            buf[n++] = y + c[1];
            buf[n++] = wz + c[2];
            buf[n++] = r; buf[n++] = g; buf[n++] = b;
          }
        }
      }
    }
  }

  const out = buf.slice(0, n);
  return { vertices: out, vertexCount: n / 6 };
}

void Facing; // keep import used (Tile::shouldRenderFace references Facing — future iter)
