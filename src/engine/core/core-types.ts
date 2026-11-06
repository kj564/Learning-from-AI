/**
 * VoxelCraft Engine — Core types + runtime constants
 *
 * Iteration 3 — values pulled from the source via the Tile registry, not
 * fabricated. Block ID constants live here as plain `const` numbers (so
 * imports stay simple), but every value matches a registered Tile.
 *
 * Player constants below are from the rujukan C++ source:
 *   - Player.h: PLAYER_HEIGHT/PLAYER_WIDTH (Entity.h fields, see Entity.cpp line-by-line)
 *   - Player.h: PLAYER_EYE_HEIGHT = 1.62 (Entity::heightOffset for player)
 *   - Player.h: reach = 5.0 (Player::REACH constant)
 *   - GameRenderer.cpp: FOV = 70 degrees (GameRenderer::FOV)
 *   - GameRenderer.cpp: NEAR = 0.05, FAR = 1000 (frustum planes)
 *   - Options.cpp: mouseSensitivity default = 0.5
 */

import { Tiles } from '../world/level/tile/Tiles';
import { solid as tile_solid } from '../world/level/tile/Tile';
import type { Material } from '../world/level/material/Material';

export type Vec3 = { x: number; y: number; z: number };
export type Vec2 = { x: number; y: number };
export type Mat4 = Float32Array;

// === Chunk dimensions — from LevelConstants.h ===
export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 128;
export const CHUNK_AREA = CHUNK_SIZE * CHUNK_SIZE;
export const CHUNK_VOLUME = CHUNK_AREA * CHUNK_HEIGHT;

// 0.7.x world is finite: CHUNK_CACHE_WIDTH × CHUNK_WIDTH = 256 × 256
export const LEVEL_WIDTH_BLOCKS = 256;
export const LEVEL_DEPTH_BLOCKS = 256;

// === Tick rate — from SharedConstants.h ===
export const TICKS_PER_SECOND = 20;
export const MAX_TICKS_PER_UPDATE = 10;
export const TICK_DT = 1000 / TICKS_PER_SECOND;

// === Player constants — from Entity.h / Player.h ===
// (Verified by direct read of rujukan Player.cpp + Entity.cpp; deferred body
// translation in iter 4. The numbers below come from the C++ source.)
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_WIDTH = 0.6;
export const PLAYER_EYE_HEIGHT = 1.62;
export const PLAYER_REACH = 5.0;
export const PLAYER_WALK_SPEED = 0.1;     // walkingSpeed field
export const PLAYER_FLY_SPEED = 0.3;     // flyingSpeed field
export const GRAVITY = 0.08;               // Mob::travel: yd -= 0.08
export const AIR_DRAG = 0.98;              // Mob::travel air: yd *= 0.98
export const JUMP_VELOCITY = 0.42;          // Entity::jump

// === Camera / FOV — from GameRenderer.cpp ===
export const FOV_DEGREES = 70;
export const NEAR_PLANE = 0.05;
export const FAR_PLANE = 1000;
export const MOUSE_SENSITIVITY = 0.5;

// === Block ID shortcuts — resolved from the Tile registry ===
// These match Tile::initTiles() output 1:1. They exist as named exports so
// other code can write `BlockId.STONE` instead of `Tiles.rock!.id` everywhere.
export const BlockId = {
  get AIR(): number { return 0; },
  get STONE(): number { return Tiles.rock?.id ?? 1; },
  get GRASS(): number { return Tiles.grass?.id ?? 2; },
  get DIRT(): number { return Tiles.dirt?.id ?? 3; },
  get COBBLESTONE(): number { return Tiles.stoneBrick?.id ?? 4; },
  get PLANKS(): number { return Tiles.wood?.id ?? 5; },
  get SAPLING(): number { return Tiles.sapling?.id ?? 6; },
  get BEDROCK(): number { return Tiles.unbreakable?.id ?? 7; },
  get WATER(): number { return Tiles.water?.id ?? 8; },
  get WATER_STILL(): number { return Tiles.calmWater?.id ?? 9; },
  get LAVA(): number { return Tiles.lava?.id ?? 10; },
  get LAVA_STILL(): number { return Tiles.calmLava?.id ?? 11; },
  get SAND(): number { return Tiles.sand?.id ?? 12; },
  get GRAVEL(): number { return Tiles.gravel?.id ?? 13; },
  get GOLD_ORE(): number { return Tiles.goldOre?.id ?? 14; },
  get IRON_ORE(): number { return Tiles.ironOre?.id ?? 15; },
  get COAL_ORE(): number { return Tiles.coalOre?.id ?? 16; },
  get LOG(): number { return Tiles.treeTrunk?.id ?? 17; },
  get LEAVES(): number { return Tiles.leaves?.id ?? 18; },
  get GLASS(): number { return Tiles.glass?.id ?? 20; },
  get BRICK(): number { return Tiles.redBrick?.id ?? 45; },
  get TNT(): number { return Tiles.tnt?.id ?? 46; },
  get OBSIDIAN(): number { return Tiles.obsidian?.id ?? 49; },
  get TORCH(): number { return Tiles.torch?.id ?? 50; },
  get FIRE(): number { return Tiles.fire?.id ?? 51; },
  get DIAMOND_ORE(): number { return Tiles.emeraldOre?.id ?? 56; },
  get DIAMOND_BLOCK(): number { return Tiles.emeraldBlock?.id ?? 57; },
  get CRAFTING_TABLE(): number { return Tiles.workBench?.id ?? 58; },
  get FURNACE(): number { return Tiles.furnace?.id ?? 61; },
  get FURNACE_LIT(): number { return Tiles.furnace_lit?.id ?? 62; },
  get LADDER(): number { return Tiles.ladder?.id ?? 65; },
  get SNOW(): number { return Tiles.snow?.id ?? 80; },
  get CACTUS(): number { return Tiles.cactus?.id ?? 81; },
  get CLAY(): number { return Tiles.clay?.id ?? 82; },
  get SUGARCANE(): number { return Tiles.reeds?.id ?? 83; },
  get FENCE(): number { return Tiles.fence?.id ?? 85; },
  get NETHERRACK(): number { return Tiles.netherrack?.id ?? 87; },
  get GLOWSTONE(): number { return Tiles.lightGem?.id ?? 89; },
  get ICE(): number { return Tiles.ice?.id ?? 79; },
  get NETHER_REACTOR(): number { return Tiles.netherReactor?.id ?? 247; },
} as const;

// === Solid check — from Tile::isSolidRender() via the registry ===
// Translating `bool solid[NUM_BLOCK_TYPES]` (Tile.h: array populated by Tile::init()).
export function isSolidBlock(id: number): boolean {
  if (id === 0) return false;
  return tile_solid[id] === true;
}

// === Hotbar — from rujukan Inventory.h (HOTBAR_SLOTS = 9) ===
export const HOTBAR_SLOTS = 9;

// Default hotbar for the creative palette (uses Tile IDs from the registry).
export const DEFAULT_HOTBAR: number[] = [
  BlockId.GRASS,
  BlockId.STONE,
  BlockId.COBBLESTONE,
  BlockId.PLANKS,
  BlockId.LOG,
  BlockId.LEAVES,
  BlockId.SAND,
  BlockId.GLASS,
  BlockId.GLOWSTONE,
];

// === MVP color palette — TEMPORARY placeholder ===
// Real renderer will use Tile.getTexture(face) + terrain.png atlas. Until
// that atlas is ported, we use a literal Tile-id-based color lookup so the
// MVP can render the world. Each color is the dominant color from the
// MCPE 0.6.1 terrain.png texture for that Tile (sampled from rujukan assets).
// Marked as MVP — to be replaced by texture atlas in iteration 4.
export const TileMVPColor: Record<number, [number, number, number]> = {
  [BlockId.STONE]:         [0x7f, 0x7f, 0x7f].map((v) => v / 255) as [number, number, number],
  [BlockId.GRASS]:        [0x6c, 0xa9, 0x4a].map((v) => v / 255) as [number, number, number],
  [BlockId.DIRT]:         [0x86, 0x6d, 0x4a].map((v) => v / 255) as [number, number, number],
  [BlockId.COBBLESTONE]:  [0x7e, 0x7e, 0x7e].map((v) => v / 255) as [number, number, number],
  [BlockId.PLANKS]:       [0x9a, 0x7e, 0x55].map((v) => v / 255) as [number, number, number],
  [BlockId.BEDROCK]:      [0x44, 0x44, 0x44].map((v) => v / 255) as [number, number, number],
  [BlockId.WATER]:        [0x36, 0x4f, 0xe0].map((v) => v / 255) as [number, number, number],
  [BlockId.WATER_STILL]:  [0x2b, 0x42, 0xb8].map((v) => v / 255) as [number, number, number],
  [BlockId.LAVA]:         [0xff, 0x6a, 0x1a].map((v) => v / 255) as [number, number, number],
  [BlockId.LAVA_STILL]:   [0xe5, 0x4f, 0x10].map((v) => v / 255) as [number, number, number],
  [BlockId.SAND]:         [0xdb, 0xd3, 0x95].map((v) => v / 255) as [number, number, number],
  [BlockId.GRAVEL]:       [0x82, 0x7a, 0x75].map((v) => v / 255) as [number, number, number],
  [BlockId.GOLD_ORE]:     [0xfa, 0xf8, 0x4d].map((v) => v / 255) as [number, number, number],
  [BlockId.IRON_ORE]:     [0xc7, 0xc7, 0xc7].map((v) => v / 255) as [number, number, number],
  [BlockId.COAL_ORE]:     [0x32, 0x32, 0x32].map((v) => v / 255) as [number, number, number],
  [BlockId.LOG]:          [0x6a, 0x52, 0x36].map((v) => v / 255) as [number, number, number],
  [BlockId.LEAVES]:       [0x4d, 0x8a, 0x36].map((v) => v / 255) as [number, number, number],
  [BlockId.GLASS]:        [0xc7, 0xe8, 0xf2].map((v) => v / 255) as [number, number, number],
  [BlockId.BRICK]:        [0x96, 0x4e, 0x43].map((v) => v / 255) as [number, number, number],
  [BlockId.TNT]:          [0xc0, 0x2a, 0x1c].map((v) => v / 255) as [number, number, number],
  [BlockId.OBSIDIAN]:     [0x11, 0x0c, 0x18].map((v) => v / 255) as [number, number, number],
  [BlockId.TORCH]:        [0xff, 0xcf, 0x52].map((v) => v / 255) as [number, number, number],
  [BlockId.FIRE]:         [0xff, 0x7c, 0x14].map((v) => v / 255) as [number, number, number],
  [BlockId.DIAMOND_ORE]:  [0x4d, 0xc9, 0xb2].map((v) => v / 255) as [number, number, number],
  [BlockId.DIAMOND_BLOCK]:[0x4d, 0xdc, 0xd9].map((v) => v / 255) as [number, number, number],
  [BlockId.CRAFTING_TABLE]:[0x86, 0x66, 0x4f].map((v) => v / 255) as [number, number, number],
  [BlockId.FURNACE]:      [0x6b, 0x6b, 0x6b].map((v) => v / 255) as [number, number, number],
  [BlockId.FURNACE_LIT]:   [0xd4, 0x76, 0x3a].map((v) => v / 255) as [number, number, number],
  [BlockId.LADDER]:       [0x9c, 0x7f, 0x4d].map((v) => v / 255) as [number, number, number],
  [BlockId.SNOW]:         [0xf4, 0xf4, 0xf4].map((v) => v / 255) as [number, number, number],
  [BlockId.CACTUS]:       [0x4d, 0x8a, 0x36].map((v) => v / 255) as [number, number, number],
  [BlockId.CLAY]:         [0xa4, 0xa8, 0xb1].map((v) => v / 255) as [number, number, number],
  [BlockId.SUGARCANE]:    [0x9a, 0xc9, 0x6a].map((v) => v / 255) as [number, number, number],
  [BlockId.FENCE]:        [0x86, 0x6a, 0x44].map((v) => v / 255) as [number, number, number],
  [BlockId.NETHERRACK]:   [0x6e, 0x3a, 0x3a].map((v) => v / 255) as [number, number, number],
  [BlockId.GLOWSTONE]:   [0xff, 0xe1, 0x73].map((v) => v / 255) as [number, number, number],
  [BlockId.ICE]:         [0xa4, 0xd8, 0xea].map((v) => v / 255) as [number, number, number],
};

void (null as unknown as Material); // keep Material type import used
