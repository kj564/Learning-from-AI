/**
 * Translation of: Tile.h (full Tile class + SoundType nested class)
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/Tile.h
 *
 * NOTE — this is a faithful translation of the 0.6.1 source's Tile class
 * with the tile registry. Many subclass headers (StoneTile, GrassTile,
 * LiquidTileDynamic, ...) live in separate files in the C++ tree; they are
 * translated alongside as the rebuild expands. For iteration 1 of the
 * rebuild we keep the Tile static table + SoundType + shape constants +
 * the static arrays (lightBlock, solid, translucent, etc.) that Tile::init
 * populates. The initTiles() body in Tile.cpp registers every tile id 1..255
 * with its material, texture id, destroy time, sound type, category,
 * description id — that is translated separately in tile-registry.ts because
 * it spans multiple subclasses and is more naturally a table in TS.
 */

import { AABB } from '../../phys/AABB';
import { Vec3 } from '../../phys/Vec3';
import { Facing } from '../../../shared/Facing';

export class SoundType {
  readonly volume: number;
  readonly pitch: number;
  readonly breakSound: string;
  readonly stepSound: string;

  constructor(name: string, volume: number, pitch: number);
  constructor(name: string, breakSound: string, volume: number, pitch: number);
  constructor(name: string, a: number | string, b: number, c?: number) {
    this.volume = (typeof a === 'number' ? a : b);
    this.pitch = (typeof a === 'number' ? b : (c as number));
    this.stepSound = 'step.' + name;
    this.breakSound = (typeof a === 'string' ? a : 'step.' + name);
  }

  getVolume(): number { return this.volume; }
  getPitch(): number { return this.pitch; }
  getBreakSound(): string { return this.breakSound; }
  getStepSound(): string { return this.stepSound; }
}

// Static const SoundTypes from Tile.cpp
export const SOUND_NORMAL = new SoundType('stone', 1, 1);
export const SOUND_WOOD = new SoundType('wood', 1, 1);
export const SOUND_GRAVEL = new SoundType('gravel', 1, 1);
export const SOUND_GRASS = new SoundType('grass', 0.5, 1);
export const SOUND_STONE = new SoundType('stone', 1, 1);
export const SOUND_METAL = new SoundType('stone', 1, 1.5);
export const SOUND_GLASS = new SoundType('stone', 'random.glass', 1, 1);
export const SOUND_CLOTH = new SoundType('cloth', 1, 1);
// PRE_ANDROID23 branch: SOUND_SAND("sand", 0.45f, 1). Android23+: ("sand","step.gravel",1,1).
// MCPE 0.7.x is post-Android23, so we use the second overload.
export const SOUND_SAND = new SoundType('sand', 'step.gravel', 1, 1);
export const SOUND_SILENT = new SoundType('', 0, 0);

// Shape constants
export const SHAPE_INVISIBLE = -1;
export const SHAPE_BLOCK = 0;
export const SHAPE_CROSS_TEXTURE = 1;
export const SHAPE_TORCH = 2;
export const SHAPE_FIRE = 3;
export const SHAPE_WATER = 4;
export const SHAPE_RED_DUST = 5;
export const SHAPE_ROWS = 6;
export const SHAPE_DOOR = 7;
export const SHAPE_LADDER = 8;
export const SHAPE_RAIL = 9;
export const SHAPE_STAIRS = 10;
export const SHAPE_FENCE = 11;
export const SHAPE_LEVER = 12;
export const SHAPE_CACTUS = 13;
export const SHAPE_BED = 14;
export const SHAPE_DIODE = 15;
export const SHAPE_IRON_FENCE = 18;
export const SHAPE_STEM = 19;
export const SHAPE_FENCE_GATE = 21;
export const SHAPE_ENTITYTILE_ANIMATED = 22;

export const NUM_BLOCK_TYPES = 256;

// Render layers
export const RENDERLAYER_OPAQUE = 0;
export const RENDERLAYER_ALPHATEST = 1;
export const RENDERLAYER_BLEND = 2;

// Static arrays indexed by tile id. From Tile.cpp declarations; populated
// by Tile::init() during initTiles().
export const tiles: (Tile | null)[] = new Array(NUM_BLOCK_TYPES).fill(null);
export const sendTileData: boolean[] = new Array(NUM_BLOCK_TYPES).fill(false);
export const shouldTick: boolean[] = new Array(NUM_BLOCK_TYPES).fill(false);
export const solid: boolean[] = new Array(NUM_BLOCK_TYPES).fill(false);
export const isEntityTile: boolean[] = new Array(NUM_BLOCK_TYPES).fill(false);
export const lightBlock: number[] = new Array(NUM_BLOCK_TYPES).fill(0);
export const translucent: boolean[] = new Array(NUM_BLOCK_TYPES).fill(true);
// initial values per C++ source: translucent starts `{true, false}` (i.e.
// index 0 = air = true, index 1 = stone = false, rest undefined = false from
// the array initializer). We replicate by setting index 0 = true, all else
// will be set during initTiles() from material.blocksLight().
translucent[0] = true; translucent[1] = false;
export const lightEmission: number[] = new Array(NUM_BLOCK_TYPES).fill(0);

export interface Material {
  isLiquid(): boolean;
  letsWaterThrough(): boolean;
  isSolid(): boolean;
  blocksLight(): boolean;
  isSolidBlocking(): boolean;
  isAlwaysDestroyable(): boolean;
  blocksMotion(): boolean;
  isFlammable(): boolean;
  isReplaceable(): boolean;
}

/**
 * Tile base class. The C++ source has dozens of virtual methods; in TS we
 * model them as instance methods with default implementations that
 * subclasses override. The Tile.h structure is preserved 1:1 so future
 * subclasses (GrassTile, LiquidTileDynamic, ...) can be added without
 * restructuring.
 */
export class Tile {
  readonly id: number;
  tex: number;
  xx0 = 0; yy0 = 0; zz0 = 0;
  xx1 = 1; yy1 = 1; zz1 = 1;
  soundType: SoundType = SOUND_NORMAL;
  gravity = 1.0;
  friction = 0.6;
  destroySpeed = 0;
  explosionResistance = 0;
  category = -1;
  readonly material: Material;
  protected descriptionId = '';
  protected tmpBB: AABB = new AABB();

  constructor(id: number, material: Material);
  constructor(id: number, tex: number, material: Material);
  constructor(id: number, a: Material | number, b?: Material) {
    this.id = id;
    if (typeof a === 'number') {
      this.tex = a;
      this.material = b as Material;
    } else {
      this.material = a;
      this.tex = 1; // default from Tile.cpp first constructor
    }
    if (tiles[id]) {
      console.warn(`Slot ${id} is already occupied when adding`);
    }
  }

  // Virtual methods with default implementations (from Tile.h/.cpp):
  isCubeShaped(): boolean { return true; }
  getRenderShape(): number { return SHAPE_BLOCK; }

  setShape(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): this {
    this.xx0 = x0; this.yy0 = y0; this.zz0 = z0;
    this.xx1 = x1; this.yy1 = y1; this.zz1 = z1;
    return this;
  }

  updateShape(_level: unknown, _x: number, _y: number, _z: number): void {}
  updateDefaultShape(): void {}
  addLights(_level: unknown, _x: number, _y: number, _z: number): void {}

  getBrightness(level: { getBrightness(x: number, y: number, z: number): number }, x: number, y: number, z: number): number {
    return level.getBrightness(x, y, z);
  }

  static isFaceVisible(level: { isSolidRenderTile(x: number, y: number, z: number): boolean }, x: number, y: number, z: number, f: number): boolean {
    switch (f) {
      case Facing.DOWN: y--; break;
      case Facing.UP: y++; break;
      case Facing.NORTH: z--; break;
      case Facing.SOUTH: z++; break;
      case Facing.WEST: x--; break;
      case Facing.EAST: x++; break;
    }
    return !level.isSolidRenderTile(x, y, z);
  }

  shouldRenderFace(level: { getTile(x: number, y: number, z: number): number }, x: number, y: number, z: number, face: number): boolean {
    // Faithful to Tile.cpp shouldRenderFace.
    if (face === 0 && y === -1) return false;
    if (face === 2 && z === -1) return false;
    if (face === 3 && z === 256) return false;
    if (face === 4 && x === -1) return false;
    if (face === 5 && x === 256) return false;
    if (face === 0 && this.yy0 > 0) return true;
    if (face === 1 && this.yy1 < 1) return true;
    if (face === 2 && this.zz0 > 0) return true;
    if (face === 3 && this.zz1 < 1) return true;
    if (face === 4 && this.xx0 > 0) return true;
    if (face === 5 && this.xx1 < 1) return true;
    const t = tiles[level.getTile(x, y, z)];
    if (!t) return true;
    // face==1 (top) hides under topSnow — but we haven't ported topSnow yet.
    // Original: if (face == 1 && t->id == topSnow->id) return false;
    return !t.isSolidRender();
  }

  getTexture(face: number): number;
  getTexture(face: number, data: number): number;
  getTexture(level: { getData(x: number, y: number, z: number): number }, x: number, y: number, z: number, face: number): number;
  getTexture(a: number | { getData(x: number, y: number, z: number): number }, b?: number, c?: number, d?: number, e?: number): number {
    // Tile.cpp overloads:
    //   getTexture(int face) { return tex; }
    //   getTexture(int face, int data) { return getTexture(face); }
    //   getTexture(LevelSource*, x,y,z, face) { return getTexture(face, level->getData(x,y,z)); }
    if (typeof a === 'number') {
      // getTexture(face) or getTexture(face, data)
      return this.tex;
    }
    // getTexture(level, x, y, z, face)
    const data = (a as { getData: (x: number, y: number, z: number) => number }).getData(b as number, c as number, d as number);
    void e; void data;
    return this.tex;
  }

  // From Tile.cpp: getAABB mutates and returns tmpBB pointer. In TS we return
  // tmpBB (shared, mutated) to keep the "same" semantics — but warn the caller
  // via comment to copy if they need to keep it.
  getAABB(_level: unknown, x: number, y: number, z: number): AABB {
    this.tmpBB.x0 = x + this.xx0;
    this.tmpBB.y0 = y + this.yy0;
    this.tmpBB.z0 = z + this.zz0;
    this.tmpBB.x1 = x + this.xx1;
    this.tmpBB.y1 = y + this.yy1;
    this.tmpBB.z1 = z + this.zz1;
    return this.tmpBB;
  }

  // From Tile.cpp addAABBs: pushes intersection AABB into boxes list.
  addAABBs(level: unknown, x: number, y: number, z: number, box: AABB | null, boxes: AABB[]): void {
    const aabb = this.getAABB(level, x, y, z);
    if (box !== null && aabb.intersects(box)) {
      boxes.push(aabb.copy());
    }
  }

  // From Tile.cpp getTileAABB: returns AABB(x+xx0, y+yy0, z+zz0, x+xx1, y+yy1, z+zz1).
  getTileAABB(level: unknown, x: number, y: number, z: number): AABB {
    this.updateShape(level as never, x, y, z);
    return new AABB(x + this.xx0, y + this.yy0, z + this.zz0, x + this.xx1, y + this.yy1, z + this.zz1);
  }

  isSolidRender(): boolean { return true; }
  mayPick(): boolean { return true; }
  mayPickWithData(_data: number, _liquid: boolean): boolean { return true; }
  mayPlace(_level: unknown, _x: number, _y: number, _z: number, _face: number): boolean { return true; }
  mayPlace2(_level: unknown, _x: number, _y: number, _z: number): boolean { return true; }
  getTickDelay(): number { return 0; }
  tick(_level: unknown, _x: number, _y: number, _z: number, _random: unknown): void {}
  animateTick(_level: unknown, _x: number, _y: number, _z: number, _random: unknown): void {}
  destroy(_level: unknown, _x: number, _y: number, _z: number, _data: number): void {}
  neighborChanged(_level: unknown, _x: number, _y: number, _z: number, _type: number): void {}
  onPlace(_level: unknown, _x: number, _y: number, _z: number): void {}
  onRemove(_level: unknown, _x: number, _y: number, _z: number): void {}
  getResource(_data: number, _random: unknown): number { return this.id; }
  getResourceCount(_random: unknown): number { return 1; }
  getDestroyProgress(player: { canDestroy(t: Tile): boolean; getDestroySpeed(t: Tile): number }): number {
    if (this.destroySpeed < 0) return 0;
    if (!player.canDestroy(this)) return 1 / this.destroySpeed / 100.0;
    return (player.getDestroySpeed(this) / this.destroySpeed) / 30.0;
  }
  spawnResources(_level: unknown, _x: number, _y: number, _z: number, _data: number, _odds?: number): void {}
  spawnBurnResources(_level: unknown, _x: number, _y: number, _z: number): boolean { return false; }
  getExplosionResistance(_source: unknown): number { return this.explosionResistance / 5.0; }
  wasExploded(_level: unknown, _x: number, _y: number, _z: number): void {}
  getRenderLayer(): number { return RENDERLAYER_OPAQUE; }
  use(_level: unknown, _x: number, _y: number, _z: number, _player: unknown): boolean { return false; }
  stepOn(_level: unknown, _x: number, _y: number, _z: number, _entity: unknown): void {}
  fallOn(_level: unknown, _x: number, _y: number, _z: number, _entity: unknown, _fallDistance: number): void {}
  getPlacedOnFaceDataValue(_level: unknown, _x: number, _y: number, _z: number, _face: number, _clickX: number, _clickY: number, _clickZ: number, itemValue: number): number { return itemValue; }
  setPlacedBy(_level: unknown, _x: number, _y: number, _z: number, _by: unknown): void {}
  prepareRender(_level: unknown, _x: number, _y: number, _z: number): void {}
  attack(_level: unknown, _x: number, _y: number, _z: number, _player: unknown): void {}
  handleEntityInside(_level: unknown, _x: number, _y: number, _z: number, _e: unknown, _current: Vec3): void {}
  getColor(_level: unknown, _x: number, _y: number, _z: number): number { return 0xffffff; }
  isSignalSource(): boolean { return false; }
  getSignal(_level: unknown, _x: number, _y: number, _z: number, _dir?: number): boolean { return false; }
  getDirectSignal(_level: unknown, _x: number, _y: number, _z: number, _dir: number): boolean { return false; }
  entityInside(_level: unknown, _x: number, _y: number, _z: number, _entity: unknown): void {}
  playerDestroy(_level: unknown, _player: unknown, _x: number, _y: number, _z: number, _data: number): void {}
  canSurvive(_level: unknown, _x: number, _y: number, _z: number): boolean { return true; }
  getName(): string { return this.descriptionId; }
  getDescriptionId(): string { return this.descriptionId; }

  // protected setters (translated from Tile.cpp)
  setSoundType(soundType: SoundType): this { this.soundType = soundType; return this; }
  setLightBlock(i: number): this { lightBlock[this.id] = i; return this; }
  setLightEmission(f: number): this {
    // Tile.cpp: lightEmission[id] = (int) (Level::MAX_BRIGHTNESS * f);
    const MAX_BRIGHTNESS = 15; // MCPE 2013 Level::MAX_BRIGHTNESS
    lightEmission[this.id] = Math.floor(MAX_BRIGHTNESS * f);
    return this;
  }
  // From Tile.cpp setExplodeable: explosionResistance = arg * 3
  setExplodeable(explosionResistance: number): this {
    this.explosionResistance = explosionResistance * 3;
    return this;
  }
  // From Tile.cpp setDestroyTime:
  //   this->destroySpeed = destroySpeed;
  //   if (explosionResistance < destroySpeed * 5) explosionResistance = destroySpeed * 5;
  setDestroyTime(destroySpeed: number): this {
    this.destroySpeed = destroySpeed;
    if (this.explosionResistance < destroySpeed * 5) this.explosionResistance = destroySpeed * 5;
    return this;
  }
  setTicking(tick: boolean): this { shouldTick[this.id] = tick; return this; }
  protected getSpawnResourcesAuxValue(_data: number): number { return 0; }

  // From Tile.cpp setDescriptionId: prefix with "tile."
  setDescriptionId(id: string): this {
    this.descriptionId = 'tile.' + id;
    return this;
  }

  // private
  init(): this {
    tiles[this.id] = this;
    this.setShape(this.xx0, this.yy0, this.zz0, this.xx1, this.yy1, this.zz1);
    solid[this.id] = this.isSolidRender();
    lightBlock[this.id] = this.isSolidRender() ? 255 : 0;
    translucent[this.id] = !this.material.blocksLight();
    return this;
  }
  setCategory(category: number): this { this.category = category; return this; }

  // Static helpers from Tile.cpp
  static transformToValidBlockId(blockId: number): number {
    return Tile.transformToValidBlockId3(blockId, 0, 0, 0);
  }
  static transformToValidBlockId3(blockId: number, x: number, y: number, z: number): number {
    if (blockId !== 0 && tiles[blockId] === null) {
      // C++ source: return (((x + y + z)&1) == 1) ? info_updateGame1->id : info_updateGame2->id
      // Without those tiles registered (we only port a subset), return 0 (AIR).
      return 0;
    }
    return blockId;
  }
}
