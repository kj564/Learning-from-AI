/**
 * VoxelCraft Engine — WGSL shaders (Vulkan-style vertex pipeline via WebGPU)
 *
 * Vertex format: per vertex — position (vec3 f32) + color (vec3 f32) = 24 bytes.
 * MVP uses solid color per block face; texture atlas comes in iter 4.
 */

export const SHADER_WGSL = /* wgsl */ `
struct Uniforms {
  viewProj : mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

struct VertexIn {
  @location(0) position : vec3<f32>,
  @location(1) color    : vec3<f32>,
};

struct VertexOut {
  @builtin(position) clipPosition : vec4<f32>,
  @location(0) color : vec3<f32>,
};

@vertex
fn vs_main(in : VertexIn) -> VertexOut {
  var out : VertexOut;
  out.clipPosition = uniforms.viewProj * vec4<f32>(in.position, 1.0);
  out.color = in.color;
  return out;
}

@fragment
fn fs_main(in : VertexOut) -> @location(0) vec4<f32> {
  return vec4<f32>(in.color, 1.0);
}
`;
