/**
 * Static tile refs from Tile.h "Tile* Tile::rock;" etc.
 *
 * In C++ these live as static fields on Tile class. In TS we put them on a
 * singleton that initTiles() populates, then every subclass can look up via
 * Tiles.rock / Tiles.stoneBrick / etc. — exactly mirroring Tile::rock /
 * Tile::stoneBrick.
 *
 * Translation of: Tile.h static fields (rock, grass, dirt, ...) populated by
 * Tile.cpp initTiles().
 */

import { Tile } from './Tile';

export const Tiles: {
  rock: Tile | null;
  grass: Tile | null;
  dirt: Tile | null;
  stoneBrick: Tile | null;
  wood: Tile | null;
  sapling: Tile | null;
  unbreakable: Tile | null;
  water: Tile | null;
  calmWater: Tile | null;
  lava: Tile | null;
  calmLava: Tile | null;
  sand: Tile | null;
  gravel: Tile | null;
  goldOre: Tile | null;
  ironOre: Tile | null;
  coalOre: Tile | null;
  treeTrunk: Tile | null;
  leaves: Tile | null;
  sponge: Tile | null;
  web: Tile | null;
  glass: Tile | null;
  thinGlass: Tile | null;
  lapisOre: Tile | null;
  lapisBlock: Tile | null;
  dispenser: Tile | null;
  sandStone: Tile | null;
  musicBlock: Tile | null;
  bed: Tile | null;
  tallgrass: Tile | null;
  cloth: Tile | null;
  flower: Tile | null;
  rose: Tile | null;
  mushroom1: Tile | null;
  mushroom2: Tile | null;
  goldBlock: Tile | null;
  ironBlock: Tile | null;
  stoneSlab: Tile | null;
  stoneSlabHalf: Tile | null;
  redBrick: Tile | null;
  tnt: Tile | null;
  bookshelf: Tile | null;
  mossStone: Tile | null;
  obsidian: Tile | null;
  torch: Tile | null;
  fire: Tile | null;
  mobSpawner: Tile | null;
  stairs_wood: Tile | null;
  chest: Tile | null;
  redStoneDust: Tile | null;
  emeraldOre: Tile | null;
  emeraldBlock: Tile | null;
  workBench: Tile | null;
  stonecutterBench: Tile | null;
  crops: Tile | null;
  farmland: Tile | null;
  furnace: Tile | null;
  furnace_lit: Tile | null;
  sign: Tile | null;
  door_wood: Tile | null;
  ladder: Tile | null;
  rail: Tile | null;
  stairs_stone: Tile | null;
  wallSign: Tile | null;
  lever: Tile | null;
  pressurePlate_stone: Tile | null;
  door_iron: Tile | null;
  pressurePlate_wood: Tile | null;
  redStoneOre: Tile | null;
  redStoneOre_lit: Tile | null;
  notGate_off: Tile | null;
  notGate_on: Tile | null;
  button: Tile | null;
  topSnow: Tile | null;
  ice: Tile | null;
  snow: Tile | null;
  cactus: Tile | null;
  clay: Tile | null;
  reeds: Tile | null;
  recordPlayer: Tile | null;
  fence: Tile | null;
  stairs_brick: Tile | null;
  fenceGate: Tile | null;
  pumpkin: Tile | null;
  hellRock: Tile | null;
  hellSand: Tile | null;
  lightGem: Tile | null;
  portalTile: Tile | null;
  litPumpkin: Tile | null;
  cake: Tile | null;
  diode_off: Tile | null;
  diode_on: Tile | null;
  trapdoor: Tile | null;
  stoneBrickSmooth: Tile | null;
  grass_carried: Tile | null;
  leaves_carried: Tile | null;
  melon: Tile | null;
  melonStem: Tile | null;
  netherReactor: Tile | null;
  glowingObsidian: Tile | null;
  stairs_stoneBrickSmooth: Tile | null;
  netherBrick: Tile | null;
  netherrack: Tile | null;
  stairs_netherBricks: Tile | null;
  stairs_sandStone: Tile | null;
  quartzBlock: Tile | null;
  stairs_quartz: Tile | null;
  invisible_bedrock: Tile | null;
  info_updateGame1: Tile | null;
  info_updateGame2: Tile | null;
  info_reserved6: Tile | null;
} = {} as never;

// Expose globally so subclass files can read Tile::rock via `Tiles.rock`
// without circular import problems (subclasses live in the same folder).
(globalThis as any).__tileRefs = Tiles;
