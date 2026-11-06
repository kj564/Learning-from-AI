/**
 * VoxelCraft Engine — WebGPU renderer
 *
 * Pipeline: device init → configure swapchain → build pipeline → per frame
 * write viewProj uniform buffer + draw all chunk buffers.
 *
 * Adapter selection: prefer 'high-performance'. On Linux/Android Chrome
 * with Vulkan available, adapterInfo.backend will return 'vulkan'.
 */

import { SHADER_WGSL } from './shaders';
import { mat4perspective, mat4view, mat4mul } from './math';
import { FOV_DEGREES, NEAR_PLANE, FAR_PLANE } from '../core/core-types';
import type { MeshData } from './chunk-mesh';
import type { IRenderer } from './irenderer';

const UNIFORM_BUFFER_SIZE = 64;

interface ChunkBuffer {
  buffer: GPUBuffer;
  vertexCount: number;
}

export class WebGPURenderer implements IRenderer {
  readonly canvas: HTMLCanvasElement;
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private format!: GPUTextureFormat;
  private pipeline!: GPURenderPipeline;
  private uniformBuffer!: GPUBuffer;
  private bindGroup!: GPUBindGroup;
  private depthTexture!: GPUTexture;
  private chunkBuffers: Map<string, ChunkBuffer> = new Map();
  private viewProj: Float32Array = new Float32Array(16);
  private proj: Float32Array = new Float32Array(16);
  private view: Float32Array = new Float32Array(16);
  ready = false;
  adapterBackend = 'unknown';
  deviceLost = false;

  constructor(canvas: HTMLCanvasElement) { this.canvas = canvas; }

  async init(): Promise<boolean> {
    if (!navigator.gpu) { console.error('[VoxelCraft] WebGPU not supported.'); return false; }
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) { console.error('[VoxelCraft] No WebGPU adapter.'); return false; }
    try {
      // @ts-expect-error adapterInfo is experimental in some implementations
      const info = adapter.info ?? (await (adapter as any).requestAdapterInfo?.());
      this.adapterBackend = (info as GPUAdapterInfo)?.backend || 'unknown';
    } catch { /* ignore */ }
    console.log(`[VoxelCraft] WebGPU adapter backend: ${this.adapterBackend}`);
    this.device = await adapter.requestDevice();
    this.device.addEventListener('uncapturederror', (e: GPUUncapturedErrorEvent) => {
      console.error('[VoxelCraft] GPU uncaptured error:', (e.error as GPUError)?.message ?? e.error);
    });
    this.device.lost.then((info) => {
      console.error('[VoxelCraft] GPU device lost:', info.reason, info.message);
      this.deviceLost = true;
    });
    this.context = this.canvas.getContext('webgpu') as unknown as GPUCanvasContext;
    if (!this.context) { console.error('[VoxelCraft] webgpu context null'); return false; }
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({ device: this.device, format: this.format, alphaMode: 'opaque' });

    const shaderModule = this.device.createShaderModule({ code: SHADER_WGSL });
    this.pipeline = this.device.createRenderPipeline({
      label: 'voxelcraft-main',
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [{
          arrayStride: 24,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' },
            { shaderLocation: 1, offset: 12, format: 'float32x3' },
          ],
        }],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{ format: this.format }],
      },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus' },
    });
    this.uniformBuffer = this.device.createBuffer({
      size: UNIFORM_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
    });
    this.resize();
    this.ready = true;
    return true;
  }

  resize(): void {
    if (!this.device) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(this.canvas.clientWidth * dpr);
    const h = Math.floor(this.canvas.clientHeight * dpr);
    if (w < 1 || h < 1) return;
    this.canvas.width = w;
    this.canvas.height = h;
    if (this.depthTexture) this.depthTexture.destroy();
    this.depthTexture = this.device.createTexture({
      size: [w, h],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  setCamera(yaw: number, pitch: number, px: number, py: number, pz: number): void {
    const aspect = (this.canvas.width || 1) / (this.canvas.height || 1);
    mat4perspective(this.proj, (FOV_DEGREES * Math.PI) / 180, aspect, NEAR_PLANE, FAR_PLANE);
    mat4view(this.view, yaw, pitch, px, py, pz);
    mat4mul(this.viewProj, this.proj, this.view);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.viewProj);
  }

  uploadChunkMesh(cx: number, cz: number, mesh: MeshData): void {
    if (!this.ready || mesh.vertexCount === 0) {
      this.chunkBuffers.delete(`${cx},${cz}`);
      return;
    }
    const key = `${cx},${cz}`;
    const existing = this.chunkBuffers.get(key);
    if (existing) { existing.buffer.destroy(); this.chunkBuffers.delete(key); }
    const buf = this.device.createBuffer({
      size: mesh.vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(buf, 0, mesh.vertices);
    this.chunkBuffers.set(key, { buffer: buf, vertexCount: mesh.vertexCount });
  }

  chunkBufferHas(cx: number, cz: number): boolean {
    return this.chunkBuffers.has(`${cx},${cz}`);
  }

  destroyChunkMesh(cx: number, cz: number): void {
    const k = `${cx},${cz}`;
    const cb = this.chunkBuffers.get(k);
    if (cb) { cb.buffer.destroy(); this.chunkBuffers.delete(k); }
  }

  render(): void {
    if (!this.ready) return;
    const encoder = this.device.createCommandEncoder();
    const view = this.context.getCurrentTexture().createView();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view,
        clearValue: { r: 0.55, g: 0.75, b: 0.95, a: 1.0 },
        loadOp: 'clear', storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),
        depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store',
      },
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    for (const cb of this.chunkBuffers.values()) {
      pass.setVertexBuffer(0, cb.buffer);
      pass.draw(cb.vertexCount);
    }
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  destroy(): void {
    for (const cb of this.chunkBuffers.values()) cb.buffer.destroy();
    this.chunkBuffers.clear();
    if (this.depthTexture) this.depthTexture.destroy();
    if (this.uniformBuffer) this.uniformBuffer.destroy();
    if (this.device) this.device.destroy();
  }
}
