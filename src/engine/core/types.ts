/**
 * VoxelCraft 0.7.1 Rebuild — Engine Core Types
 *
 * Faithful rebuild target: MCPE 0.7.1 (X0007010, armv7)
 * Reference: rujukan/pocket-edition-2013 + delta symbols from 0.7.1 binary
 *
 * Rebuild rule: TypeScript-native, WebGPU renderer (Vulkan-backed on desktop,
 * Metal on macOS, D3D12 on Windows — WebGPU is the closest to raw Vulkan a
 * browser will allow).
 *
 * Why TS-native (not Emscripten): the original mcpe-wasm build ran the 2013
 * C++ in a WebGL2 canvas via Emscripten's GLES1 emulation. It worked but the
 * platform seams (multitouch, save, options) all needed C++ recompiles for
 * every fix. A native TS rebuild lets us patch anything in-place.
 */

// === Math primitives ===

export type Vec3 = { x: number; y: number; z: number };
export type Vec2 = { x: number; y: number };

// Column-major 4x4 matrix (WebGPU / WGSL convention)
export type Mat4 = Float32Array; // length 16

// === Chunk dimensions (MCPE 0.7.x — fixed-height 128) ===
// 0.9.0+ moved to 256 + infinite worlds; 0.7.x is classic finite islands.
export const CHUNK_SIZE = 16;       // X, Z
export const CHUNK_HEIGHT = 128;    // Y
export const CHUNK_AREA = CHUNK_SIZE * CHUNK_SIZE;
export const CHUNK_VOLUME = CHUNK_AREA * CHUNK_HEIGHT;

// === Tick rate (MCPE 2013 fixed timestep) ===
// From rujukan Timer.cpp: 20 tps, max 10 ticks per update.
export const TICKS_PER_SECOND = 20;
export const MAX_TICKS_PER_UPDATE = 10;
export const TICK_DT = 1000 / TICKS_PER_SECOND; // ms

// === Player constants (from rujukan Player.cpp, Entity.h) ===
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_WIDTH = 0.6;
export const PLAYER_EYE_HEIGHT = 1.62;
export const PLAYER_REACH = 5.0;
export const PLAYER_WALK_SPEED = 0.1;
export const PLAYER_FLY_SPEED = 0.3;
export const GRAVITY = 0.08;
export const AIR_DRAG = 0.98;
export const GROUND_FRICTION_BASE = 0.6;
export const GROUND_FRICTION_AIR = 0.91;
export const JUMP_VELOCITY = 0.42;

// === Camera / FOV (from rujukan GameRenderer.cpp) ===
export const FOV_DEGREES = 70;
export const NEAR_PLANE = 0.05;
export const FAR_PLANE = 1000;
export const MOUSE_SENSITIVITY = 0.5;

// === Block IDs (MCPE 0.7.x — subset for MVP) ===
export const BlockId = {
  AIR: 0,
  STONE: 1,
  GRASS: 2,
  DIRT: 3,
  COBBLESTONE: 4,
  PLANKS: 5,
  SAPLING: 6,
  BEDROCK: 7,
  WATER: 8,
  WATER_STILL: 9,
  LAVA: 10,
  LAVA_STILL: 11,
  SAND: 12,
  GRAVEL: 13,
  GOLD_ORE: 14,
  IRON_ORE: 15,
  COAL_ORE: 16,
  LOG: 17,
  LEAVES: 18,
  GLASS: 20,
  DIAMOND_ORE: 56,
  CAKE: 92, // NEW in 0.7.x — confirmed from RE: CakeTile class
} as const;

// === Block colors for MVP ===
export const BlockColor: Record<number, [number, number, number]> = {
  [BlockId.STONE]:       [0.50, 0.50, 0.50],
  [BlockId.GRASS]:       [0.45, 0.70, 0.30],
  [BlockId.DIRT]:        [0.55, 0.40, 0.25],
  [BlockId.COBBLESTONE]: [0.40, 0.40, 0.40],
  [BlockId.PLANKS]:      [0.65, 0.50, 0.30],
  [BlockId.BEDROCK]:     [0.20, 0.20, 0.20],
  [BlockId.WATER]:       [0.20, 0.30, 0.85],
  [BlockId.WATER_STILL]: [0.15, 0.25, 0.75],
  [BlockId.LAVA]:        [0.95, 0.40, 0.10],
  [BlockId.LAVA_STILL]:  [0.85, 0.30, 0.05],
  [BlockId.SAND]:        [0.85, 0.78, 0.55],
  [BlockId.GRAVEL]:      [0.50, 0.45, 0.42],
  [BlockId.GOLD_ORE]:    [0.60, 0.55, 0.30],
  [BlockId.IRON_ORE]:    [0.65, 0.55, 0.45],
  [BlockId.COAL_ORE]:    [0.30, 0.30, 0.30],
  [BlockId.LOG]:         [0.45, 0.32, 0.18],
  [BlockId.LEAVES]:      [0.30, 0.55, 0.20],
  [BlockId.GLASS]:       [0.70, 0.85, 0.95],
  [BlockId.DIAMOND_ORE]: [0.30, 0.70, 0.75],
  [BlockId.CAKE]:        [0.95, 0.85, 0.75],
};

// === Hotbar (MCPE 2013: 9 slots) ===
export const HOTBAR_SLOTS = 9;

export const DEFAULT_HOTBAR: number[] = [
  BlockId.GRASS,
  BlockId.STONE,
  BlockId.COBBLESTONE,
  BlockId.PLANKS,
  BlockId.LOG,
  BlockId.LEAVES,
  BlockId.SAND,
  BlockId.GLASS,
  BlockId.CAKE,
];

export const isSolid = (id: number): boolean => id !== BlockId.AIR && id !== BlockId.WATER && id !== BlockId.WATER_STILL;
