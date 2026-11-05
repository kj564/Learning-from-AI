/**
 * Translation of: Tile::initTiles() — Tile.cpp lines 130-260
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/Tile.cpp
 *
 * Faithful line-by-line. Every Tile registration: id, material, texture id,
 * destroySpeed (via setDestroyTime), explosionResistance (via setExplodeable),
 * soundType, category, descriptionId. Subclasses (StoneTile, GrassTile,
 * DirtTile, LiquidTileDynamic, ...) are translated in separate files. For
 * tiles where the subclass does only what base Tile does (e.g. stoneBrick,
 * wood, redBrick, mossStone, netherrack, netherBrick) we use the base Tile
 * directly so we don't have to port a subclass whose only job was "use
 * material X and texture Y" — that's identical to Tile(id, tex, material).
 *
 * Format: each line below is one C++ registration statement, transcribed.
 *   id  Tile subclass           material       tex  destroyTime  soundType
 *                                                                category  descriptionId
 */

import { Tile, tiles, shouldTick, lightBlock, lightEmission } from './Tile';
import { Material } from '../material/Material';
import { ItemCategory } from '../../item/ItemCategory';
import {
  SOUND_STONE, SOUND_GRASS, SOUND_GRAVEL, SOUND_WOOD, SOUND_GLASS,
  SOUND_METAL, SOUND_CLOTH, SOUND_SAND,
} from './Tile';

// === Subclasses that need their own files ===
import { StoneTile } from './StoneTile';
import { GrassTile } from './GrassTile';
import { DirtTile } from './DirtTile';
import { Sapling } from './Sapling';
import { HeavyTile } from './HeavyTile';
import { GravelTile } from './GravelTile';
import { OreTile } from './OreTile';
import { TreeTile } from './TreeTile';
import { LeafTile } from './LeafTile';
import { GlassTile } from './GlassTile';
// MultiTextureTile lives in SandStoneTile.ts (inlined)
import { SandStoneTile, MultiTextureTile } from './SandStoneTile';
import { BedTile } from './BedTile';
import { WebTile } from './WebTile';
import { TallGrass } from './TallGrass';
import { ClothTile } from './ClothTile';
import { Bush } from './Bush';
import { Mushroom } from './Mushroom';
import { MetalTile } from './MetalTile';
import { StoneSlabTile } from './StoneSlabTile';
import { TntTile } from './TntTile';
import { BookshelfTile } from './BookshelfTile';
import { ObsidianTile } from './ObsidianTile';
import { TorchTile } from './TorchTile';
import { StairTile } from './StairTile';
import { ChestTile } from './ChestTile';
import { WorkbenchTile } from './WorkbenchTile';
import { CropTile } from './CropTile';
import { FarmTile } from './FarmTile';
import { FurnaceTile } from './FurnaceTile';
import { SignTile } from './SignTile';
import { DoorTile } from './DoorTile';
import { LadderTile } from './LadderTile';
import { RedStoneOreTile } from './RedStoneOreTile';
import { TopSnowTile } from './TopSnowTile';
import { IceTile } from './IceTile';
import { SnowTile } from './SnowTile';
import { CactusTile } from './CactusTile';
import { ClayTile } from './ClayTile';
import { ReedTile } from './ReedTile';
import { FenceTile } from './FenceTile';
import { LightGemTile } from './LightGemTile';
import { InvisibleTile } from './InvisibleTile';
import { TrapDoorTile } from './TrapDoorTile';
import { ThinFenceTile } from './ThinFenceTile';
import { MelonTile } from './MelonTile';
import { StemTile } from './StemTile';
import { FenceGateTile } from './FenceGateTile';
import { QuartzBlockTile } from './QuartzBlockTile';
import { StonecutterTile } from './StonecutterTile';
import { NetherReactor } from './NetherReactor';
import { CarriedTile } from './CarriedTile';
import { FireTile } from './FireTile';
import { LiquidTileDynamic } from './LiquidTileDynamic';
import { LiquidTileStatic } from './LiquidTileStatic';
import { Tiles } from './Tiles';

// Stashed references for cross-tile use (e.g. stairs reference their source tile)
let _stoneBrick: Tile;
let _stoneBrickSmooth: Tile;
let _redBrick: Tile;
let _sandStone: Tile;
let _netherBrick: Tile;
let _quartzBlock: Tile;
let _melon: Tile;
let _wood: Tile;

// Multi-texture tile texture lists — faithful to Tile.cpp constants:
//   SANDSTONE_TEXTURES[] = { 0 + 16*12, 5 + 16*14, 6 + 16*14 }; count 3
//   STONE_BRICK_TEXTURES[] = { 6 + 16*3, 4 + 16*6, 5 + 16*6 }; count 3
const SANDSTONE_TEXTURES = [0 + 16 * 12, 5 + 16 * 14, 6 + 16 * 14];
const SANDSTONE_TEXTURE_COUNT = 3;
const STONE_BRICK_TEXTURES = [6 + 16 * 3, 4 + 16 * 6, 5 + 16 * 6];
const STONE_BRICK_TEXTURE_COUNT = 3;

// Module-level mutable refs to mirror the C++ static Tile* fields.
// (Tiles singleton is defined in Tiles.ts and imported above.)

export function initTiles(): void {
  // C++ Tile.cpp initTiles — line 130 onward. We translate each statement.

  Tiles.rock = new StoneTile(1, 1).init().setDestroyTime(1.5).setExplodeable(10).setSoundType(SOUND_STONE).setCategory(ItemCategory.Structures).setDescriptionId('stone');
  Tiles.grass = new GrassTile(2).init().setDestroyTime(0.6).setSoundType(SOUND_GRASS).setCategory(ItemCategory.Structures).setDescriptionId('grass');
  Tiles.dirt = new DirtTile(3, 2).init().setDestroyTime(0.5).setSoundType(SOUND_GRAVEL).setCategory(ItemCategory.Structures).setDescriptionId('dirt');
  _stoneBrick = new Tile(4, 16, Material.stone).init().setDestroyTime(2.0).setExplodeable(10).setSoundType(SOUND_STONE).setCategory(ItemCategory.Structures).setDescriptionId('stonebrick');
  Tiles.stoneBrick = _stoneBrick;
  _wood = new Tile(5, 4, Material.wood).init().setDestroyTime(2.0).setExplodeable(5).setSoundType(SOUND_WOOD).setCategory(ItemCategory.Structures).setDescriptionId('wood');
  Tiles.wood = _wood;
  Tiles.sapling = new Sapling(6, 15).init().setDestroyTime(0.0).setSoundType(SOUND_GRASS).setCategory(ItemCategory.Structures).setDescriptionId('sapling');
  Tiles.unbreakable = new Tile(7, 17, Material.stone).init().setDestroyTime(-1).setExplodeable(6000000).setSoundType(SOUND_STONE).setCategory(ItemCategory.Structures).setDescriptionId('bedrock');
  Tiles.water = new LiquidTileDynamic(8, Material.water).init().setDestroyTime(100.0).setLightBlock(3).setCategory(ItemCategory.Structures).setDescriptionId('water');
  Tiles.calmWater = new LiquidTileStatic(9, Material.water).init().setDestroyTime(100.0).setLightBlock(3).setCategory(ItemCategory.Structures).setDescriptionId('water');
  Tiles.lava = new LiquidTileDynamic(10, Material.lava).init().setDestroyTime(0.0).setLightEmission(1.0).setLightBlock(255).setCategory(ItemCategory.Structures).setDescriptionId('lava');
  Tiles.calmLava = new LiquidTileStatic(11, Material.lava).init().setDestroyTime(100.0).setLightEmission(1.0).setLightBlock(255).setCategory(ItemCategory.Structures).setDescriptionId('lava');
  Tiles.sand = new HeavyTile(12, 18).init().setDestroyTime(0.5).setSoundType(SOUND_SAND).setCategory(ItemCategory.Structures).setDescriptionId('sand');
  Tiles.gravel = new GravelTile(13, 19).init().setDestroyTime(0.6).setSoundType(SOUND_GRAVEL).setCategory(ItemCategory.Structures).setDescriptionId('gravel');
  Tiles.goldOre = new OreTile(14, 32).init().setDestroyTime(3.0).setExplodeable(5).setSoundType(SOUND_STONE).setCategory(ItemCategory.Decorations).setDescriptionId('oreGold');
  Tiles.ironOre = new OreTile(15, 33).init().setDestroyTime(3.0).setExplodeable(5).setSoundType(SOUND_STONE).setCategory(ItemCategory.Decorations).setDescriptionId('oreIron');
  Tiles.coalOre = new OreTile(16, 34).init().setDestroyTime(3.0).setExplodeable(5).setSoundType(SOUND_STONE).setCategory(ItemCategory.Structures).setDescriptionId('oreCoal');
  Tiles.treeTrunk = new TreeTile(17).init().setDestroyTime(2.0).setSoundType(SOUND_WOOD).setCategory(ItemCategory.Structures).setDescriptionId('log');
  Tiles.leaves = new LeafTile(18, 4 + 3 * 16).init().setDestroyTime(0.2).setLightBlock(1).setSoundType(SOUND_GRASS).setCategory(ItemCategory.Structures).setDescriptionId('leaves');

  Tiles.glass = new GlassTile(20, 49, Material.glass, false).init().setDestroyTime(0.3).setSoundType(SOUND_GLASS).setCategory(ItemCategory.Structures).setDescriptionId('glass');
  Tiles.lapisOre = new OreTile(21, 10 * 16).init().setDestroyTime(3.0).setExplodeable(5).setSoundType(SOUND_STONE).setCategory(ItemCategory.Structures).setDescriptionId('oreLapis');
  Tiles.lapisBlock = new Tile(22, 9 * 16, Material.stone).init().setDestroyTime(3.0).setExplodeable(5).setSoundType(SOUND_STONE).setCategory(ItemCategory.Decorations).setDescriptionId('blockLapis');
  _sandStone = new SandStoneTile(24, SANDSTONE_TEXTURES, SANDSTONE_TEXTURE_COUNT).init().setSoundType(SOUND_STONE).setDestroyTime(0.8).setCategory(ItemCategory.Structures).setDescriptionId('sandStone');
  Tiles.sandStone = _sandStone;
  Tiles.bed = new BedTile(26).init().setDestroyTime(0.2).setCategory(ItemCategory.Structures).setDescriptionId('bed');
  Tiles.web = new WebTile(30, 11).init().setLightBlock(1).setDestroyTime(4.0).setCategory(ItemCategory.Decorations).setDescriptionId('web');
  Tiles.tallgrass = new TallGrass(31, 2 * 16 + 7).init().setDestroyTime(0.0).setSoundType(SOUND_GRASS).setCategory(ItemCategory.Decorations).setDescriptionId('tallgrass');
  Tiles.cloth = new ClothTile(35).init().setDestroyTime(0.8).setSoundType(SOUND_CLOTH).setCategory(ItemCategory.Structures).setDescriptionId('cloth');

  Tiles.flower = new Bush(37, 13).init().setDestroyTime(0.0).setSoundType(SOUND_GRASS).setCategory(ItemCategory.Decorations).setDescriptionId('flower');
  Tiles.rose = new Bush(38, 12).init().setDestroyTime(0.0).setSoundType(SOUND_GRASS).setCategory(ItemCategory.Decorations).setDescriptionId('rose');
  Tiles.mushroom1 = new Mushroom(39, 13 + 16).init().setDestroyTime(0.0).setSoundType(SOUND_GRASS).setLightEmission(2 / 16.0).setCategory(ItemCategory.Decorations).setDescriptionId('mushroom');
  Tiles.mushroom2 = new Mushroom(40, 12 + 16).init().setDestroyTime(0.0).setSoundType(SOUND_GRASS).setCategory(ItemCategory.Decorations).setDescriptionId('mushroom');
  Tiles.goldBlock = new MetalTile(41, 39 - 16).init().setDestroyTime(3.0).setExplodeable(10).setSoundType(SOUND_METAL).setCategory(ItemCategory.Decorations).setDescriptionId('blockGold');
  Tiles.ironBlock = new MetalTile(42, 38 - 16).init().setDestroyTime(5.0).setExplodeable(10).setSoundType(SOUND_METAL).setCategory(ItemCategory.Decorations).setDescriptionId('blockIron');
  Tiles.stoneSlab = new StoneSlabTile(43, true).init().setDestroyTime(2.0).setExplodeable(10).setSoundType(SOUND_STONE).setCategory(ItemCategory.Structures).setDescriptionId('stoneSlab');
  Tiles.stoneSlabHalf = new StoneSlabTile(44, false).init().setDestroyTime(2.0).setExplodeable(10).setSoundType(SOUND_STONE).setCategory(ItemCategory.Structures).setDescriptionId('stoneSlab');
  _redBrick = new Tile(45, 7, Material.stone).init().setDestroyTime(2.0).setExplodeable(10).setSoundType(SOUND_STONE).setCategory(ItemCategory.Structures).setDescriptionId('brick');
  Tiles.redBrick = _redBrick;
  Tiles.tnt = new TntTile(46, 8).init().setDestroyTime(0.0).setSoundType(SOUND_GRASS).setCategory(ItemCategory.Tools).setDescriptionId('tnt');
  Tiles.bookshelf = new BookshelfTile(47, 35).init().setDestroyTime(1.5).setSoundType(SOUND_WOOD).setCategory(ItemCategory.Decorations).setDescriptionId('bookshelf');
  Tiles.mossStone = new Tile(48, 36, Material.stone).init().setDestroyTime(2.0).setExplodeable(10).setSoundType(SOUND_STONE).setCategory(ItemCategory.Structures).setDescriptionId('stoneMoss');
  Tiles.obsidian = new ObsidianTile(49, 37, false).init().setDestroyTime(10.0).setExplodeable(2000).setSoundType(SOUND_STONE).setCategory(ItemCategory.Structures).setDescriptionId('obsidian');
  Tiles.torch = new TorchTile(50, 5 * 16).init().setDestroyTime(0.0).setLightEmission(15 / 16.0).setSoundType(SOUND_WOOD).setCategory(ItemCategory.Tools).setDescriptionId('torch');

  Tiles.stairs_wood = new StairTile(53, _wood).init().setCategory(ItemCategory.Structures).setDescriptionId('stairsWood');
  Tiles.chest = new ChestTile(54).init().setCategory(ItemCategory.Structures).setDestroyTime(2.5).setSoundType(SOUND_WOOD).setDescriptionId('chest');

  Tiles.emeraldOre = new OreTile(56, 16 * 3 + 2).init().setDestroyTime(3.0).setExplodeable(5).setSoundType(SOUND_STONE).setCategory(ItemCategory.Decorations).setDescriptionId('oreDiamond');
  Tiles.emeraldBlock = new MetalTile(57, 40 - 16).init().setDestroyTime(5.0).setExplodeable(10).setSoundType(SOUND_METAL).setCategory(ItemCategory.Decorations).setDescriptionId('blockDiamond');
  Tiles.workBench = new WorkbenchTile(58).init().setDestroyTime(2.5).setSoundType(SOUND_WOOD).setCategory(ItemCategory.Structures).setDescriptionId('workbench');
  Tiles.crops = new CropTile(59, 8 + 5 * 16).init().setDestroyTime(0.0).setSoundType(SOUND_GRASS).setCategory(ItemCategory.Structures).setDescriptionId('crops');
  Tiles.farmland = new FarmTile(60).init().setDestroyTime(0.6).setSoundType(SOUND_GRAVEL).setCategory(ItemCategory.Structures).setDescriptionId('farmland');
  Tiles.furnace = new FurnaceTile(61, false).init().setDestroyTime(3.5).setSoundType(SOUND_STONE).setCategory(ItemCategory.Structures).setDescriptionId('furnace');
  Tiles.furnace_lit = new FurnaceTile(62, true).init().setDestroyTime(3.5).setSoundType(SOUND_STONE).setLightEmission(14 / 16.0).setCategory(ItemCategory.Structures).setDescriptionId('furnace');
  Tiles.sign = new SignTile(63, 'Sign', true).init().setDestroyTime(1.0).setSoundType(SOUND_WOOD).setCategory(ItemCategory.Decorations).setDescriptionId('sign');
  Tiles.door_wood = new DoorTile(64, Material.wood).init().setDestroyTime(3.0).setSoundType(SOUND_WOOD).setCategory(ItemCategory.Structures).setDescriptionId('doorWood');
  Tiles.ladder = new LadderTile(65, 3 + 5 * 16).init().setDestroyTime(0.4).setSoundType(SOUND_WOOD).setCategory(ItemCategory.Structures).setDescriptionId('ladder');

  Tiles.stairs_stone = new StairTile(67, _stoneBrick).init().setCategory(ItemCategory.Structures).setDescriptionId('stairsStone');
  Tiles.wallSign = new SignTile(68, 'Sign', false).init().setDestroyTime(1.0).setSoundType(SOUND_WOOD).setCategory(ItemCategory.Decorations).setDescriptionId('sign');

  Tiles.door_iron = new DoorTile(71, Material.metal).init().setDestroyTime(5.0).setSoundType(SOUND_METAL).setCategory(ItemCategory.Structures).setDescriptionId('doorIron');

  Tiles.redStoneOre = new RedStoneOreTile(73, 16 * 3 + 3, false).init().setDestroyTime(3.0).setExplodeable(5).setSoundType(SOUND_STONE).setCategory(ItemCategory.Mechanisms).setDescriptionId('oreRedstone');
  Tiles.redStoneOre_lit = new RedStoneOreTile(74, 16 * 3 + 3, true).init().setDestroyTime(3.0).setLightEmission(10 / 16.0).setExplodeable(5).setSoundType(SOUND_STONE).setCategory(ItemCategory.Mechanisms).setDescriptionId('oreRedstone');

  Tiles.topSnow = new TopSnowTile(78, 16 * 4 + 2).init().setDestroyTime(0.1).setSoundType(SOUND_CLOTH).setCategory(ItemCategory.Structures).setDescriptionId('snow');
  Tiles.ice = new IceTile(79, 16 * 4 + 3).init().setDestroyTime(0.5).setLightBlock(3).setSoundType(SOUND_GLASS).setCategory(ItemCategory.Structures).setDescriptionId('ice');
  Tiles.snow = new SnowTile(80, 16 * 4 + 2).init().setDestroyTime(0.2).setSoundType(SOUND_CLOTH).setCategory(ItemCategory.Structures).setDescriptionId('snow');
  Tiles.cactus = new CactusTile(81, 16 * 4 + 6).init().setDestroyTime(0.4).setSoundType(SOUND_CLOTH).setCategory(ItemCategory.Structures).setDescriptionId('cactus');
  Tiles.clay = new ClayTile(82, 16 * 4 + 8).init().setDestroyTime(0.6).setSoundType(SOUND_GRAVEL).setCategory(ItemCategory.Structures).setDescriptionId('clay');
  Tiles.reeds = new ReedTile(83, 16 * 4 + 9).init().setDestroyTime(0.0).setSoundType(SOUND_GRASS).setCategory(ItemCategory.Structures).setDescriptionId('reeds');

  Tiles.fence = new FenceTile(85, 4).init().setDestroyTime(2.0).setExplodeable(5).setSoundType(SOUND_WOOD).setCategory(ItemCategory.Structures).setDescriptionId('fence');

  Tiles.netherrack = new Tile(87, 7 + 6 * 16, Material.stone).init().setDestroyTime(0.4).setSoundType(SOUND_STONE).setDescriptionId('hellrock');

  Tiles.lightGem = new LightGemTile(89, 9 + 16 * 6, Material.glass).init().setDestroyTime(0.3).setCategory(ItemCategory.Structures).setSoundType(SOUND_GLASS).setLightEmission(1.0).setDescriptionId('lightgem');
  Tiles.invisible_bedrock = new InvisibleTile(95, 0, Material.stone).init().setDestroyTime(-1).setExplodeable(6000000);
  Tiles.trapdoor = new TrapDoorTile(96, Material.wood).init().setDestroyTime(3.0).setSoundType(SOUND_WOOD).setCategory(ItemCategory.Structures).setDescriptionId('trapdoor');

  _stoneBrickSmooth = new MultiTextureTile(98, STONE_BRICK_TEXTURES, STONE_BRICK_TEXTURE_COUNT, Material.stone).init().setDestroyTime(1.5).setExplodeable(10).setSoundType(SOUND_STONE).setCategory(ItemCategory.Structures).setDescriptionId('stonebricksmooth');
  Tiles.stoneBrickSmooth = _stoneBrickSmooth;

  Tiles.thinGlass = new ThinFenceTile(102, 1 + 3 * 16, 4 + 9 * 16, Material.glass, false).init().setDestroyTime(0.3).setSoundType(SOUND_GLASS).setCategory(ItemCategory.Structures).setDescriptionId('thinGlass');
  _melon = new MelonTile(103).init().setDestroyTime(1.0).setSoundType(SOUND_WOOD).setCategory(ItemCategory.FoodArmor).setDescriptionId('melon');
  Tiles.melon = _melon;
  Tiles.melonStem = new StemTile(105, _melon).init().setDestroyTime(0.0).setSoundType(SOUND_WOOD).setCategory(ItemCategory.FoodArmor).setDescriptionId('pumpkinStem');
  Tiles.fenceGate = new FenceGateTile(107, 4).init().setDestroyTime(2.0).setExplodeable(5).setSoundType(SOUND_WOOD).setCategory(ItemCategory.Structures).setDescriptionId('fenceGate');
  Tiles.stairs_brick = new StairTile(108, _redBrick).init().setCategory(ItemCategory.Structures).setDescriptionId('stairsBrick');

  Tiles.stairs_stoneBrickSmooth = new StairTile(109, _stoneBrickSmooth).init().setCategory(ItemCategory.Structures).setDescriptionId('stairsStoneBrickSmooth');
  _netherBrick = new Tile(112, 0 + 14 * 16, Material.stone).init().setDestroyTime(2.0).setExplodeable(10).setSoundType(SOUND_STONE).setCategory(ItemCategory.Structures).setDescriptionId('netherBrick');
  Tiles.netherBrick = _netherBrick;
  Tiles.stairs_netherBricks = new StairTile(114, _netherBrick).init().setCategory(ItemCategory.Structures).setDescriptionId('stairsNetherBrick');
  Tiles.stairs_sandStone = new StairTile(128, _sandStone).init().setCategory(ItemCategory.Structures).setDescriptionId('stairsSandStone');

  _quartzBlock = new QuartzBlockTile(155).init().setSoundType(SOUND_STONE).setDestroyTime(0.8).setCategory(ItemCategory.Structures).setDescriptionId('quartzBlock');
  Tiles.quartzBlock = _quartzBlock;
  Tiles.stairs_quartz = new StairTile(156, _quartzBlock).init().setCategory(ItemCategory.Structures).setDescriptionId('stairsQuartz');

  // Special tiles for Pocket Edition at high IDs
  Tiles.stonecutterBench = new StonecutterTile(245).init().setDestroyTime(2.5).setSoundType(SOUND_STONE).setCategory(ItemCategory.Structures).setDescriptionId('stonecutter');
  Tiles.glowingObsidian = new ObsidianTile(246, 10 + 16 * 13, true).init().setDestroyTime(10.0).setLightEmission(14 / 16.0).setExplodeable(2000).setSoundType(SOUND_STONE).setCategory(ItemCategory.Structures).setDescriptionId('glowingobsidian');
  Tiles.netherReactor = new NetherReactor(247, 10 + 14 * 16, Material.metal).init().setDestroyTime(3.0).setSoundType(SOUND_METAL).setCategory(ItemCategory.Structures).setDescriptionId('netherreactor');
  Tiles.info_updateGame1 = new Tile(248, 252, Material.dirt).init().setDestroyTime(1.0).setSoundType(SOUND_GRAVEL).setCategory(ItemCategory.Structures).setDescriptionId('info_update');
  Tiles.info_updateGame2 = new Tile(249, 253, Material.dirt).init().setDestroyTime(1.0).setSoundType(SOUND_GRAVEL).setCategory(ItemCategory.Structures).setDescriptionId('info_update');
  Tiles.grass_carried = new CarriedTile(253, 3, 12 * 16 + 12).init().setDescriptionId('grass');
  Tiles.leaves_carried = new LeafTile(254, 11 + 14 * 16).init().setDestroyTime(0.2).setLightBlock(1).setSoundType(SOUND_GRASS).setCategory(ItemCategory.Structures).setDescriptionId('leaves');
  Tiles.info_reserved6 = new Tile(255, Material.dirt).init();

  // Order-dependent: fire must init AFTER others (Tile.cpp comment)
  Tiles.fire = new FireTile(51, 1 * 16 + 15).init().setDestroyTime(0.0).setLightEmission(1.0).setSoundType(SOUND_WOOD).setCategory(ItemCategory.Structures).setDescriptionId('fire');

  // Item::items[i] for each registered tile (we'll port Item in a later iter)
  // — the C++ block at the end of initTiles registers TileItems. Deferred.
}

// Expose the tile registry as a lookup helper.
export function getTileById(id: number): Tile | null {
  return tiles[id] ?? null;
}

// Silence unused-import warnings for refs we expose but don't yet use:
void shouldTick; void lightBlock; void lightEmission;
