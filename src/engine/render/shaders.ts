/**
 * VoxelCraft Engine — WGSL shaders (Vulkan-style vertex pipeline via WebGPU)
 *
 * Vertex format: per vertex — position (vec3 f32) + color (vec3 f32) = 24 bytes.
 * MVP uses solid color per block face; texture atlas comes in a later iter.
 *
 * Why WebGPU not raw Vulkan: a browser tab cannot open a VkInstance. WebGPU
 * is the closest API the browser exposes; on desktop Chrome it lowers to
 * Vulkan on Linux, D3D12 on Windows, Metal on macOS — so the user's request
 * "use Vulkan if possible" maps to "request a Vulkan adapter via WebGPU when
 * available". We log navigator.gpu.adapterInfo.backend in the renderer init.
 */

export const SHADER_WGSL = /* wgsl */ `
struct Uniforms {
  viewProj : mat4x4<f32>,
  // model matrix not needed — we bake world position into vertex positions
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
  // Simple directional shading: darken based on face normal inferred from
  // color variation? We don't have normals in MVP, so apply a cheap lambert
  // from a fixed sun direction based on world-space Y (cheap fake AO).
  let y = in.color.y;
  let shade = 0.6 + 0.4 * clamp(y, 0.0, 1.0);
  return vec4<f32>(in.color * shade, 1.0);
}
`;

// Simpler shader: flat color, no shading. Used for fallback.
export const SHADER_FLAT_WGSL = /* wgsl */ `
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
