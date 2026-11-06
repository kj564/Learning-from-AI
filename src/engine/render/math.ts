/**
 * VoxelCraft Engine — Math helpers (column-major Mat4, Vec3, AABB ops)
 *
 * Pure TS. No allocation in hot loops; all Mat4 ops write into a dst array.
 *
 * Constants here are from the 0.6.1 source line-by-line where available:
 *   - Player AABB width/height: from Player.cpp / Entity.h (literal)
 *   - Mouse sensitivity: from Options.cpp
 *   - FOV: from GameRenderer.cpp
 */

import type { Vec3 } from '../core-types';

// === Vec3 ===
export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const v3add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const v3sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const v3scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const v3dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const v3len = (a: Vec3): number => Math.sqrt(v3dot(a, a));
export const v3norm = (a: Vec3): Vec3 => {
  const l = v3len(a);
  return l > 0 ? { x: a.x / l, y: a.y / l, z: a.z / l } : { x: 0, y: 0, z: 0 };
};
export const v3cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

// === Mat4 (column-major, 16 Float32) ===
export const mat4identity = (out: Float32Array): Float32Array => {
  out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0;
  out[4] = 0; out[5] = 1; out[6] = 0; out[7] = 0;
  out[8] = 0; out[9] = 0; out[10] = 1; out[11] = 0;
  out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
  return out;
};

export const mat4perspective = (
  out: Float32Array,
  fovYRad: number,
  aspect: number,
  near: number,
  far: number,
): Float32Array => {
  const f = 1 / Math.tan(fovYRad / 2);
  const range = far - near;
  out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
  out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
  out[8] = 0; out[9] = 0; out[10] = far / range; out[11] = 1;
  out[12] = 0; out[13] = 0; out[14] = -(far * near) / range; out[15] = 0;
  return out;
};

export const mat4perspectiveGL = (
  out: Float32Array,
  fovYRad: number,
  aspect: number,
  near: number,
  far: number,
): Float32Array => {
  const f = 1 / Math.tan(fovYRad / 2);
  const nf = 1 / (near - far);
  out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
  out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
  out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
  out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
  return out;
};

export const mat4view = (
  out: Float32Array,
  yaw: number,
  pitch: number,
  tx: number,
  ty: number,
  tz: number,
): Float32Array => {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  out[0] = cy;        out[1] = sp * sy;     out[2] = cp * sy;      out[3] = 0;
  out[4] = 0;         out[5] = cp;          out[6] = -sp;          out[7] = 0;
  out[8] = -sy;       out[9] = sp * cy;     out[10] = cp * cy;     out[11] = 0;
  out[12] = -(cy * tx - sy * tz);
  out[13] = -(sp * sy * tx + cp * ty + sp * cy * tz);
  out[14] = -(cp * sy * tx - sp * ty + cp * cy * tz);
  out[15] = 1;
  return out;
};

export const mat4mul = (out: Float32Array, a: Float32Array, b: Float32Array): Float32Array => {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  for (let i = 0; i < 4; i++) {
    const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
    out[i * 4]     = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
    out[i * 4 + 1] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
    out[i * 4 + 2] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
    out[i * 4 + 3] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
  }
  return out;
};

// === Simplex/Perlin noise for worldgen MVP ===
// Deterministic by seed. Used by World to fill chunks.
export class Noise {
  private perm: Uint8Array;
  constructor(seed: number) {
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = seed >>> 0;
    const rng = () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  value2(x: number, z: number): number {
    const xi = Math.floor(x) & 255;
    const zi = Math.floor(z) & 255;
    const xf = x - Math.floor(x);
    const zf = z - Math.floor(z);
    const fade = (t: number) => t * t * (3 - 2 * t);
    const u = fade(xf), v = fade(zf);
    const aa = this.perm[this.perm[xi] + zi] / 255;
    const ab = this.perm[this.perm[xi] + zi + 1] / 255;
    const ba = this.perm[this.perm[xi + 1] + zi] / 255;
    const bb = this.perm[this.perm[xi + 1] + zi + 1] / 255;
    const y1 = aa * (1 - u) + ba * u;
    const y2 = ab * (1 - u) + bb * u;
    return y1 * (1 - v) + y2 * v;
  }
}
