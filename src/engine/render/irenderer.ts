/**
 * VoxelCraft Engine — Renderer interface
 *
 * Two implementations: WebGPURenderer (preferred, Vulkan/Metal/D3D12 backend)
 * and WebGL2Renderer (fallback, ubiquitous). Engine picks based on
 * navigator.gpu availability.
 *
 * Same MeshData shape flows into both, so the chunk mesher doesn't care
 * which backend is live. MVP vertex format: 24 bytes (pos.xyz + color.rgb),
 * non-indexed triangles.
 */

import type { MeshData } from './chunk-mesh';

export interface IRenderer {
  ready: boolean;
  adapterBackend: string;
  init(): Promise<boolean>;
  resize(): void;
  setCamera(yaw: number, pitch: number, px: number, py: number, pz: number): void;
  uploadChunkMesh(cx: number, cz: number, mesh: MeshData): void;
  destroyChunkMesh(cx: number, cz: number): void;
  chunkBufferHas(cx: number, cz: number): boolean;
  render(): void;
  destroy(): void;
}
