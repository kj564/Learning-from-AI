/**
 * VoxelCraft Engine — WebGL2 fallback renderer
 *
 * Same vertex format as WebGPU renderer (pos.xyz + color.rgb, 24 bytes,
 * non-indexed triangles). GLSL ES 300 shaders. Same view/proj matrix math
 * (column-major), but GL clip space is [-1,1] for Z so we use the GL-flavored
 * perspective projection.
 *
 * Why we have this: not every browser tab has WebGPU yet. Headless Chromium
 * in the dev sandbox frequently loses its WebGPU device after init (the
 * "A valid external Instance reference no longer exists" error), and some
 * users run Firefox < 141 or Safari < 17.4. WebGL2 has been everywhere
 * since 2017, so the fallback gives us a reliable floor for both.
 */

import { mat4perspectiveGL, mat4view, mat4mul } from '../core/math';
import { FOV_DEGREES, NEAR_PLANE, FAR_PLANE } from '../core/types';
import type { MeshData } from './chunk-mesh';
import type { IRenderer } from './irenderer';

const VERT_SRC = `#version 300 es
in vec3 a_pos;
in vec3 a_color;
uniform mat4 u_vp;
out vec3 v_color;
void main() {
  gl_Position = u_vp * vec4(a_pos, 1.0);
  v_color = a_color;
}
`;

const FRAG_SRC = `#version 300 es
precision mediump float;
in vec3 v_color;
out vec4 frag;
void main() {
  // Fake AO: brighten by Y-tint already baked in mesh; just output.
  frag = vec4(v_color, 1.0);
}
`;

interface ChunkGLBuffer {
  vao: WebGLVertexArrayObject;
  vbo: WebGLBuffer;
  vertexCount: number;
}

export class WebGL2Renderer implements IRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private uVP: WebGLUniformLocation | null = null;
  private aPos = -1;
  private aColor = -1;
  private viewProj: Float32Array = new Float32Array(16);
  private proj: Float32Array = new Float32Array(16);
  private view: Float32Array = new Float32Array(16);
  private chunkBuffers: Map<string, ChunkGLBuffer> = new Map();
  ready = false;
  adapterBackend = 'webgl2';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async init(): Promise<boolean> {
    const gl = this.canvas.getContext('webgl2', {
      antialias: true,
      depth: true,
      stencil: false,
      alpha: false,
      powerPreference: 'high-performance',
    }) as WebGL2RenderingContext | null;
    if (!gl) {
      console.error('[VoxelCraft] WebGL2 not available.');
      return false;
    }
    this.gl = gl;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0.55, 0.75, 0.95, 1.0);

    const vs = this.compile(gl.VERTEX_SHADER, VERT_SRC);
    const fs = this.compile(gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) return false;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[VoxelCraft] program link failed:', gl.getProgramInfoLog(prog));
      return false;
    }
    this.program = prog;
    this.uVP = gl.getUniformLocation(prog, 'u_vp');
    this.aPos = gl.getAttribLocation(prog, 'a_pos');
    this.aColor = gl.getAttribLocation(prog, 'a_color');

    this.resize();
    this.ready = true;
    return true;
  }

  private compile(type: number, src: string): WebGLShader | null {
    const gl = this.gl!;
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('[VoxelCraft] shader compile failed:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  resize(): void {
    if (!this.gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(this.canvas.clientWidth * dpr);
    const h = Math.floor(this.canvas.clientHeight * dpr);
    if (w < 1 || h < 1) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
  }

  setCamera(yaw: number, pitch: number, px: number, py: number, pz: number): void {
    const gl = this.gl;
    if (!gl) return;
    const aspect = (this.canvas.width || 1) / (this.canvas.height || 1);
    mat4perspectiveGL(this.proj, (FOV_DEGREES * Math.PI) / 180, aspect, NEAR_PLANE, FAR_PLANE);
    mat4view(this.view, yaw, pitch, px, py, pz);
    mat4mul(this.viewProj, this.proj, this.view);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uVP, false, this.viewProj);
  }

  uploadChunkMesh(cx: number, cz: number, mesh: MeshData): void {
    const gl = this.gl;
    if (!gl || !this.ready) return;
    if (mesh.vertexCount === 0) {
      this.destroyChunkMesh(cx, cz);
      return;
    }
    const key = `${cx},${cz}`;
    const existing = this.chunkBuffers.get(key);
    if (existing) {
      gl.deleteBuffer(existing.vbo);
      gl.deleteVertexArray(existing.vao);
      this.chunkBuffers.delete(key);
    }
    const vao = gl.createVertexArray()!;
    const vbo = gl.createBuffer()!;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(this.aColor);
    gl.vertexAttribPointer(this.aColor, 3, gl.FLOAT, false, 24, 12);
    gl.bindVertexArray(null);
    this.chunkBuffers.set(key, { vao, vbo, vertexCount: mesh.vertexCount });
  }

  destroyChunkMesh(cx: number, cz: number): void {
    const gl = this.gl;
    if (!gl) return;
    const k = `${cx},${cz}`;
    const cb = this.chunkBuffers.get(k);
    if (cb) {
      gl.deleteBuffer(cb.vbo);
      gl.deleteVertexArray(cb.vao);
      this.chunkBuffers.delete(k);
    }
  }

  chunkBufferHas(cx: number, cz: number): boolean {
    return this.chunkBuffers.has(`${cx},${cz}`);
  }

  render(): void {
    const gl = this.gl;
    if (!gl || !this.ready) return;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    for (const cb of this.chunkBuffers.values()) {
      gl.bindVertexArray(cb.vao);
      gl.drawArrays(gl.TRIANGLES, 0, cb.vertexCount);
    }
    gl.bindVertexArray(null);
  }

  destroy(): void {
    const gl = this.gl;
    if (!gl) return;
    for (const cb of this.chunkBuffers.values()) {
      gl.deleteBuffer(cb.vbo);
      gl.deleteVertexArray(cb.vao);
    }
    this.chunkBuffers.clear();
    if (this.program) gl.deleteProgram(this.program);
  }
}
