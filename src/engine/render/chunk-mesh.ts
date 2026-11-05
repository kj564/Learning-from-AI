/**
 * VoxelCraft Engine — Chunk mesher
 *
 * Greedy-meshing is overkill for MVP. We do per-face culling: for each solid
 * voxel, emit a quad for each of its 6 faces IF the neighbor is air/water
 * (i.e. this face is exposed). Each face quad carries the block's color.
 *
 * Vertex format: 24 bytes (3 floats position + 3 floats color).
 * Quad = 2 triangles = 6 vertices. We emit non-indexed for simplicity.
 *
 * To give MVP some depth perception, we apply per-face shading (top brightest,
 * sides medium, bottom darkest) by darkening the block color per face.
 */

import { Chunk } from '../world/chunk';
import { CHUNK_SIZE, CHUNK_HEIGHT, BlockColor, BlockId, isSolid } from '../core/types';

// Face definitions: for each of 6 faces, the 4 corner offsets (CCW from outside)
// and the neighbor offset. Faces are unit cubes from (x,y,z) to (x+1,y+1,z+1).
type Face = {
  dir: [number, number, number];
  corners: [number, number, number][]; // 4 corners
  shade: number; // brightness multiplier
};

const FACES: Face[] = [
  // +X (east)
  { dir: [1, 0, 0], corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]], shade: 0.80 },
  // -X (west)
  { dir: [-1, 0, 0], corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]], shade: 0.80 },
  // +Y (top)
  { dir: [0, 1, 0], corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], shade: 1.00 },
  // -Y (bottom)
  { dir: [0, -1, 0], corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], shade: 0.50 },
  // +Z (south)
  { dir: [0, 0, 1], corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]], shade: 0.70 },
  // -Z (north)
  { dir: [0, 0, -1], corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]], shade: 0.70 },
];

// MeshData returned to the renderer. Non-indexed triangles.
export interface MeshData {
  vertices: Float32Array; // count = vertexCount * 6 floats (pos.xyz + color.rgb)
  vertexCount: number;
}

export function buildChunkMesh(
  chunk: Chunk,
  baseX: number,
  baseZ: number,
  neighborGet: (wx: number, wy: number, wz: number) => number,
): MeshData {
  // Worst-case estimate: 16x128x16 = 32768 cells * 6 faces * 6 verts * 6 floats
  // = ~7M floats = 28 MB. We preallocate then truncate.
  const maxVerts = CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE * 6 * 6;
  const buf = new Float32Array(maxVerts * 6); // pos.xyz + color.rgb per vertex
  let n = 0;

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const id = chunk.get(x, y, z);
        if (id === BlockId.AIR || !isSolid(id)) continue;

        const color = BlockColor[id] ?? [0.8, 0.2, 0.8]; // magenta = unknown
        const wx = baseX + x;
        const wz = baseZ + z;

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const nx = wx + face.dir[0];
          const ny = y + face.dir[1];
          const nz = wz + face.dir[2];

          // Check neighbor: if solid and opaque, skip this face.
          const nbId = neighborGet(nx, ny, nz);
          if (isSolid(nbId) && nbId !== BlockId.GLASS) continue;
          // Glass shows its own face even next to other glass (visual identity).
          // For MVP, water renders transparently only if we add water meshing —
          // skipped in MVP; only solid blocks meshed here.

          const r = color[0] * face.shade;
          const g = color[1] * face.shade;
          const b = color[2] * face.shade;

          // Emit 6 vertices (2 triangles: 0,1,2, 0,2,3)
          const order = [0, 1, 2, 0, 2, 3];
          for (const i of order) {
            const c = face.corners[i];
            buf[n++] = wx + c[0];
            buf[n++] = y + c[1];
            buf[n++] = wz + c[2];
            // Color tinted by face shade so flat-color chunk reads as 3D
            buf[n++] = r;
            buf[n++] = g;
            buf[n++] = b;
          }
        }
      }
    }
  }

  // Slice the buffer to actual length
  const out = buf.slice(0, n);
  return { vertices: out, vertexCount: n / 6 };
}
