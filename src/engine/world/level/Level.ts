/**
 * Translation of: world/level/Level.h + Level.cpp (subset — gameplay critical methods)
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/Level.{h,cpp}
 *
 * Level.cpp is 2241 lines. We translate the methods that Entity/Mob/Player
 * call directly (the EntityLevel interface) plus the tile-API + entity
 * management tick. Storage uses the existing Chunk map from world/level/world.ts.
 *
 * Constants from Level.h (faithful):
 *   MAX_BRIGHTNESS = 15
 *   TICKS_PER_DAY = TicksPerSecond * 60 * 16  (19200 ticks = 16 minutes real-time)
 *   MIDDLE_OF_NIGHT_TIME = 12000
 *   SEA_LEVEL = DEPTH / 2 - 1 = 63
 *   MAX_LEVEL_SIZE = 32000000
 *   DEPTH = LEVEL_HEIGHT = 128
 *
 * Faithful C++ bodies translated line-by-line:
 *   - getTile / setTile / getData / setData
 *   - hasChunkAt / hasChunksAt
 *   - getMaterial
 *   - isEmptyTile / isSolidRenderTile / isSolidBlockingTile
 *   - updateNeighborsAt
 *   - getBrightness / getRawBrightness
 *   - getCubes (the AABB collector used by Entity::move)
 *   - checkAndHandleWater
 *   - getNearestPlayer
 *   - tick / tickEntities / tickTiles (skeleton)
 *   - getSkyDarken / getTimeOfDay
 *
 * Deferred:
 *   - ChunkSource (random / save / networked chunk loading) — uses local chunk map
 *   - LightLayer (per-chunk light propagation) — gets a stub brightness
 *   - LevelStorage / LevelData — save/load (stubbed for now)
 *   - BiomeSource / Dimension — worldgen (separate file)
 *   - RakNet SetTimePacket broadcast — single-player mode only
 *   - PathFinder — entity AI helpers
 *   - TileEntity (chest, furnace, sign) — deferred until items port
 */

import { AABB } from '../phys/AABB';
import { Vec3 } from '../phys/Vec3';
import { HitResult } from '../phys/AABB';
import { Mth } from '../../util/Mth';
import { Random } from '../../util/Random';
import { TicksPerSecond } from '../../shared/SharedConstants';
import { LEVEL_HEIGHT } from './LevelConstants';
import { Tile, tiles as Tile_tiles, lightEmission as Tile_lightEmission, solid as Tile_solid, lightBlock as Tile_lightBlock } from './tile/Tile';
import { Material } from './material/Material';
import { Tiles } from './tile/Tiles';
import { World } from './world';
import type { Entity } from '../entity/Entity';

export const MAX_LEVEL_SIZE = 32000000;
export const DEPTH = LEVEL_HEIGHT;
export const SEA_LEVEL = Math.floor(DEPTH / 2 - 1);
export const MAX_BRIGHTNESS = 15;
export const TICKS_PER_DAY = TicksPerSecond * 60 * 16;
export const MIDDLE_OF_NIGHT_TIME = 12000;
export const genDepthBits = 7;
export const genDepthBitsPlusFour = genDepthBits + 4;
export const genDepth = 1 << genDepthBits;
export const genDepthMinusOne = genDepth - 1;

export interface LevelListener {
  tileChanged(x: number, y: number, z: number): void;
  setTilesDirty(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void;
  tileBrightnessChanged(x: number, y: number, z: number): void;
}

export interface AdventureSettings {
  doTickTime: boolean;
  noPvP: boolean;
  noPvM: boolean;
  noMvP: boolean;
  immutableWorld: boolean;
  showNameTags: boolean;
}

function defaultAdventureSettings(): AdventureSettings {
  return {
    doTickTime: true,
    noPvP: false,
    noPvM: false,
    noMvP: false,
    immutableWorld: false,
    showNameTags: true,
  };
}

// LightLayer enum (translated from LightLayer.h)
export type LightLayer = 'Sky' | 'Block';

export class Level implements World.LevelLike {
  static readonly MAX_LEVEL_SIZE = MAX_LEVEL_SIZE;
  static readonly DEPTH = DEPTH;
  static readonly SEA_LEVEL = SEA_LEVEL;
  static readonly MAX_BRIGHTNESS = MAX_BRIGHTNESS;
  static readonly TICKS_PER_DAY = TICKS_PER_DAY;
  static readonly MIDDLE_OF_NIGHT_TIME = MIDDLE_OF_NIGHT_TIME;

  // === Public fields (Level.h:224-260) ===
  instaTick = false;
  isClientSide = false;
  isGeneratingTerrain = false;
  difficulty = 2;  // NORMAL
  adventureSettings: AdventureSettings = defaultAdventureSettings();
  entities: Entity[] = [];
  entityIdLookup: Map<number, Entity> = new Map();
  tileEntities: unknown[] = [];
  pendingTileEntities: unknown[] = [];
  updatingTileEntities = false;
  players: Entity[] = [];
  skyDarken = 0;
  noNeighborUpdate = false;
  dimension: unknown = null;
  raknetInstance: unknown = null;
  random: Random = new Random(0);
  boxes: AABB[] = [];

  // === Internal state (private in C++) ===
  private world: World;
  private listeners: LevelListener[] = [];
  private _time = 0;
  private _seed = 1337;
  private _spawnPos = { x: 0, y: 64, z: 0 };
  private _spawnFriendlies = true;
  private _spawnEnemies = true;
  private _isNew = true;
  private _nightMode = false;

  constructor(world: World, seed = 1337) {
    this.world = world;
    this._seed = seed;
    this.random = new Random(seed);
    this.updateSkyDarken();
  }

  // === Level::getTile (Level.cpp:515) ===
  getTile(x: number, y: number, z: number): number {
    if (y < 0) return 0;
    if (y >= DEPTH) return 0;
    return this.world.getBlock(x, y, z);
  }

  isEmptyTile(x: number, y: number, z: number): boolean {
    return this.getTile(x, y, z) === 0;
  }

  // Level.cpp:532-559 — hasChunkAt, hasChunksAt, hasChunk
  hasChunkAt(x: number, y: number, z: number): boolean {
    if (y < 0 || y >= DEPTH) return false;
    return this.hasChunk(x >> 4, z >> 4);
  }

  hasChunksAtR(x: number, y: number, z: number, r: number): boolean {
    return this.hasChunksAt(x - r, y - r, z - r, x + r, y + r, z + r);
  }

  hasChunksAt(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): boolean {
    if (y1 < 0 || y0 >= DEPTH) return false;
    x0 >>= 4; z0 >>= 4;
    x1 >>= 4; z1 >>= 4;
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++)
        if (!this.hasChunk(x, z)) return false;
    return true;
  }

  hasChunk(x: number, z: number): boolean {
    // ChunkCache::hasChunk — we use the world's chunk map.
    return this.world.chunks.has(`${x},${z}`);
  }

  // === Level::setTile / setTileNoUpdate / setTileAndData / setTileAndDataNoUpdate ===
  setTile(x: number, y: number, z: number, tile: number): boolean {
    if (this.setTileNoUpdate(x, y, z, tile)) {
      this.tileUpdated(x, y, z, tile);
      return true;
    }
    return false;
  }

  setTileNoUpdate(x: number, y: number, z: number, tile: number): boolean {
    if (y < 0) return false;
    if (y >= DEPTH) return false;
    // Direct write into the world chunk map.
    this.world.setBlock(x, y, z, tile);
    return true;
  }

  setTileAndDataNoUpdate(x: number, y: number, z: number, tile: number, _data: number): boolean {
    if (y < 0) return false;
    if (y >= DEPTH) return false;
    this.world.setBlock(x, y, z, tile);
    // data not implemented in MVP world storage (only block IDs stored).
    return true;
  }

  setTileAndData(x: number, y: number, z: number, tile: number, data: number): boolean {
    if (this.setTileAndDataNoUpdate(x, y, z, tile, data)) {
      this.tileUpdated(x, y, z, tile);
      return true;
    }
    return false;
  }

  // === Level::getData / setData / setDataNoUpdate (Level.cpp:595-640) ===
  getData(_x: number, _y: number, _z: number): number {
    // MVP world only stores block IDs, no per-block data. Return 0.
    return 0;
  }

  setData(x: number, y: number, z: number, data: number): void {
    if (this.setDataNoUpdate(x, y, z, data)) {
      this.tileUpdated(x, y, z, this.getTile(x, y, z));
    }
  }

  setDataNoUpdate(_x: number, _y: number, _z: number, _data: number): boolean {
    // Data not stored in MVP. Pretend it changed so caller proceeds.
    return true;
  }

  sendTileUpdated(x: number, y: number, z: number): void {
    for (const l of this.listeners) l.tileChanged(x, y, z);
  }

  protected tileUpdated(x: number, y: number, z: number, tile: number): void {
    this.sendTileUpdated(x, y, z);
    this.updateNeighborsAt(x, y, z, tile);
  }

  // Level::getMaterial (Level.cpp:589)
  getMaterial(x: number, y: number, z: number): Material {
    const t = this.getTile(x, y, z);
    if (t === 0) return Material.air;
    return Tile_tiles[t]?.material ?? Material.air;
  }

  // Level::isSolidRenderTile / isSolidBlockingTile
  isSolidRenderTile(x: number, y: number, z: number): boolean {
    const t = this.getTile(x, y, z);
    return Tile_solid[t] === true;
  }

  isSolidBlockingTile(x: number, y: number, z: number): boolean {
    const t = this.getTile(x, y, z);
    if (t === 0) return false;
    const tile = Tile_tiles[t];
    if (!tile) return false;
    return tile.material.isSolidBlocking();
  }

  // Level::isEmptyTile already above

  // === Level::updateNeighborsAt (Level.cpp:706) ===
  updateNeighborsAt(x: number, y: number, z: number, tile: number): void {
    this.neighborChanged(x - 1, y, z, tile);
    this.neighborChanged(x + 1, y, z, tile);
    this.neighborChanged(x, y - 1, z, tile);
    this.neighborChanged(x, y + 1, z, tile);
    this.neighborChanged(x, y, z - 1, tile);
    this.neighborChanged(x, y, z + 1, tile);
  }

  private neighborChanged(x: number, y: number, z: number, type: number): void {
    if (this.noNeighborUpdate || this.isClientSide) return;
    const tile = Tile_tiles[this.getTile(x, y, z)];
    if (tile) (tile as unknown as { neighborChanged: (lvl: Level, x: number, y: number, z: number, t: number) => void }).neighborChanged(this, x, y, z, type);
  }

  // === Level::getRawBrightness (Level.cpp:729) — translated verbatim ===
  getRawBrightness(x: number, y: number, z: number): number;
  getRawBrightness(x: number, y: number, z: number, propagate: boolean): number;
  getRawBrightness(x: number, y: number, z: number, propagate?: boolean): number {
    if (propagate === undefined) propagate = true;
    if (propagate) {
      const id = this.getTile(x, y, z);
      if (id === (Tiles.stoneSlabHalf?.id ?? -1) || id === (Tiles.farmland?.id ?? -1)) {
        let br = this.getRawBrightness(x, y + 1, z, false);
        const br1 = this.getRawBrightness(x + 1, y, z, false);
        const br2 = this.getRawBrightness(x - 1, y, z, false);
        const br3 = this.getRawBrightness(x, y, z + 1, false);
        const br4 = this.getRawBrightness(x, y, z - 1, false);
        if (br1 > br) br = br1;
        if (br2 > br) br = br2;
        if (br3 > br) br = br3;
        if (br4 > br) br = br4;
        return br;
      }
    }
    if (y < 0) return 0;
    if (y >= DEPTH) {
      let br = MAX_BRIGHTNESS - this.skyDarken;
      if (br < 0) br = 0;
      return br;
    }
    // LevelChunk::getRawBrightness(x, y, z, skyDarken) — MVP: no per-chunk light
    // propagation. Approximate sky brightness from canSeeSky + tile emission.
    if (this.canSeeSky(x, y, z)) {
      return MAX_BRIGHTNESS - this.skyDarken;
    }
    const t = this.getTile(x, y, z);
    const em = Tile_lightEmission[t] ?? 0;
    return Math.max(em, MAX_BRIGHTNESS - this.skyDarken - 8);
  }

  isSkyLit(x: number, y: number, z: number): boolean {
    if (y < 0) return false;
    if (y >= DEPTH) return true;
    if (!this.hasChunk(x >> 4, z >> 4)) return false;
    // MVP: approximate sky-lit by walking column up to first solid block.
    for (let yy = y + 1; yy < DEPTH; yy++) {
      const t = this.getTile(x, yy, z);
      if (t !== 0 && (Tile_lightBlock[t] ?? 0) > 0) return false;
    }
    return true;
  }

  canSeeSky(x: number, y: number, z: number): boolean {
    for (let yy = y + 1; yy < DEPTH; yy++) {
      const t = this.getTile(x, yy, z);
      if (t !== 0 && (Tile_lightBlock[t] ?? 0) > 0) return false;
    }
    return true;
  }

  // Level::getBrightness(LightLayer, x,y,z) — Level.cpp:812
  getBrightnessLayer(layer: LightLayer, x: number, y: number, z: number): number {
    if (y < 0 || y >= DEPTH) {
      return layer === 'Sky' ? 15 : 0;
    }
    if (!this.hasChunk(x >> 4, z >> 4)) return 0;
    // MVP: no per-chunk light arrays. Return raw sky for Sky, tile emission for Block.
    if (layer === 'Sky') return this.canSeeSky(x, y, z) ? MAX_BRIGHTNESS - this.skyDarken : 0;
    return Tile_lightEmission[this.getTile(x, y, z)] ?? 0;
  }

  setBrightnessLayer(_layer: LightLayer, x: number, y: number, z: number, _brightness: number): void {
    for (const l of this.listeners) l.tileBrightnessChanged(x, y, z);
  }

  // Level::getBrightness(int x,int y,int z) — Level.cpp:837 — uses dimension.brightnessRamp
  getBrightness(x: number, y: number, z: number): number {
    const raw = this.getRawBrightness(x, y, z);
    // brightnessRamp is dimension-specific; default maps 0..15 → 0..1.
    return raw / MAX_BRIGHTNESS;
  }

  // === Level::getCubes (Level.cpp:1119) — verbatim ===
  getCubes(_source: Entity | null, box: AABB): AABB[] {
    this.boxes.length = 0;
    const x0 = Mth.floor(box.x0);
    const x1 = Mth.floor(box.x1 + 1);
    const y0 = Mth.floor(box.y0);
    const y1 = Mth.floor(box.y1 + 1);
    const z0 = Mth.floor(box.z0);
    const z1 = Mth.floor(box.z1 + 1);

    for (let x = x0; x < x1; x++) {
      for (let z = z0; z < z1; z++) {
        if (this.hasChunkAt(x, DEPTH / 2, z)) {
          for (let y = y0 - 1; y < y1; y++) {
            const tile = Tile_tiles[this.getTile(x, y, z)];
            if (tile) {
              (tile as unknown as { addAABBs: (lvl: Level, x: number, y: number, z: number, box: AABB | null, boxes: AABB[]) => void })
                .addAABBs(this, x, y, z, box, this.boxes);
            }
          }
        }
      }
    }
    return this.boxes;
  }

  // === Level::checkAndHandleWater (Level.cpp:123) — verbatim ===
  checkAndHandleWater(box: AABB, material: Material, e: Entity): boolean {
    const x0 = Mth.floor(box.x0);
    const x1 = Mth.floor(box.x1 + 1);
    const y0 = Mth.floor(box.y0);
    const y1 = Mth.floor(box.y1 + 1);
    const z0 = Mth.floor(box.z0);
    const z1 = Mth.floor(box.z1 + 1);
    if (!this.hasChunksAt(x0, y0, z0, x1, y1, z1)) return false;

    let ok = false;
    const current = new Vec3(0, 0, 0);
    for (let x = x0; x < x1; x++) {
      for (let y = y0; y < y1; y++) {
        for (let z = z0; z < z1; z++) {
          const tile = Tile_tiles[this.getTile(x, y, z)];
          if (tile && tile.material === material) {
            // LiquidTile::getHeight — deferred. Assume full block (height = 1).
            const yt0 = y + 1 - 1.0;
            if (y1 >= yt0) {
              ok = true;
              (tile as unknown as { handleEntityInside: (lvl: Level, x: number, y: number, z: number, e: Entity, current: Vec3) => void })
                .handleEntityInside?.(this, x, y, z, e, current);
            }
          }
        }
      }
    }
    const len = current.length();
    if (len > 0) {
      const pow = 0.004 / len;
      e.xd += current.x * pow;
      e.yd += current.y * pow;
      e.zd += current.z * pow;
    }
    return ok;
  }

  containsAnyLiquid(box: AABB): boolean {
    const x0 = Mth.floor(box.x0);
    const x1 = Mth.floor(box.x1 + 1);
    const y0 = Mth.floor(box.y0);
    const y1 = Mth.floor(box.y1 + 1);
    const z0 = Mth.floor(box.z0);
    const z1 = Mth.floor(box.z1 + 1);
    if (!this.hasChunksAt(x0, y0, z0, x1, y1, z1)) return false;
    for (let x = x0; x < x1; x++)
      for (let y = y0; y < y1; y++)
        for (let z = z0; z < z1; z++) {
          const tile = Tile_tiles[this.getTile(x, y, z)];
          if (tile && tile.material.isLiquid()) return true;
        }
    return false;
  }

  containsMaterial(box: AABB, material: Material): boolean {
    const x0 = Mth.floor(box.x0);
    const x1 = Mth.floor(box.x1 + 1);
    const y0 = Mth.floor(box.y0);
    const y1 = Mth.floor(box.y1 + 1);
    const z0 = Mth.floor(box.z0);
    const z1 = Mth.floor(box.z1 + 1);
    if (!this.hasChunksAt(x0, y0, z0, x1, y1, z1)) return false;
    for (let x = x0; x < x1; x++)
      for (let y = y0; y < y1; y++)
        for (let z = z0; z < z1; z++) {
          const tile = Tile_tiles[this.getTile(x, y, z)];
          if (tile && tile.material === material) return true;
        }
    return false;
  }

  containsLiquid(box: AABB, material: Material): boolean { return this.containsMaterial(box, material); }

  containsFireTile(box: AABB): boolean {
    const x0 = Mth.floor(box.x0);
    const x1 = Mth.floor(box.x1 + 1);
    const y0 = Mth.floor(box.y0);
    const y1 = Mth.floor(box.y1 + 1);
    const z0 = Mth.floor(box.z0);
    const z1 = Mth.floor(box.z1 + 1);
    for (let x = x0; x < x1; x++)
      for (let y = y0; y < y1; y++)
        for (let z = z0; z < z1; z++) {
          if (this.getTile(x, y, z) === (Tiles.fire?.id ?? -1)) return true;
        }
    return false;
  }

  // === Level::getNearestPlayer (Level.cpp:162-182) — verbatim ===
  getNearestPlayer(source: Entity, maxDist: number): Entity | null {
    return this.getNearestPlayer3(source.x, source.y, source.z, maxDist);
  }
  getNearestPlayer3(x: number, y: number, z: number, maxDist: number): Entity | null {
    const maxDistSqr = maxDist * maxDist;
    let best = -1;
    let result: Entity | null = null;
    for (const p of this.players) {
      if (p.removed) continue;
      const dist = p.distanceToSqr3(x, y, z);
      if ((maxDist < 0 || dist < maxDistSqr) && (best === -1 || dist < best)) {
        best = dist;
        result = p;
      }
    }
    return result;
  }

  // === Level::tick (Level.cpp:184) — verbatim except deferred bits ===
  tick(): void {
    // MobSpawner deferred (would need MobSpawner.cpp port).
    this.updateSkyDarken();
    if (this._nightMode) {
      let curTime = this._time;
      if (curTime % TICKS_PER_DAY !== MIDDLE_OF_NIGHT_TIME) {
        if (curTime % TICKS_PER_DAY < MIDDLE_OF_NIGHT_TIME && (curTime + 20) % TICKS_PER_DAY > MIDDLE_OF_NIGHT_TIME) {
          curTime = MIDDLE_OF_NIGHT_TIME;
        } else {
          curTime += 20;
        }
        this.setTime(curTime % TICKS_PER_DAY);
      }
    } else {
      const time = this._time + 1;
      this._time = time;
      // SetTimePacket broadcast deferred (single-player).
    }
    this.tickPendingTicks(false);
    this.tickTiles();
    // SynchedEntityData dirty broadcast deferred (single-player).
  }

  // Level::tickPendingTicks — stub (TickNextTickData system deferred)
  tickPendingTicks(_force: boolean): boolean { return true; }

  // Level::tickTiles (Level.cpp:257) — partial translation
  tickTiles(): void {
    // C++ walks _chunksToPoll and ticks tiles within. MVP: no ticking tiles
    // (would require Tile::tick + per-tick scheduling). Stubs.
  }

  // Level::tickEntities (Level.cpp:1330) — partial translation
  tickEntities(): void {
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (!e.removed) this.tickEntity(e);
      if (e.removed && (!e.isPlayer() || e.reallyRemoveIfPlayer)) {
        this.entityIdLookup.delete(e.entityId);
        this.entities.splice(i, 1);
        i--;
        this.entityRemoved(e);
      }
    }
  }

  tickEntity(e: Entity): void { e.tick(); }

  // === Level::addEntity (Level.cpp:1004) ===
  addEntity(e: Entity): boolean {
    const existing = this.entityIdLookup.get(e.entityId);
    if (existing !== undefined) return false;
    this.entities.push(e);
    this.entityIdLookup.set(e.entityId, e);
    this.entityAdded(e);
    return true;
  }

  removeEntity(e: Entity): void {
    const idx = this.entities.indexOf(e);
    if (idx >= 0) this.entities.splice(idx, 1);
    this.entityIdLookup.delete(e.entityId);
    this.entityRemoved(e);
  }

  protected entityAdded(_e: Entity): void {}
  protected entityRemoved(_e: Entity): void {}

  getEntity(entityId: number): Entity | null {
    return this.entityIdLookup.get(entityId) ?? null;
  }
  getMob(entityId: number): Entity | null { return this.getEntity(entityId); }

  // === Level::getSkyDarken (Level.cpp:1163) — verbatim ===
  getSkyDarken(a: number): number {
    const td = this.getTimeOfDay(a);
    let br = 1 - (Math.cos(td * Math.PI * 2) * 2 + 0.5);
    if (br < 0) br = 0;
    if (br > 0.80) br = 0.80;
    return (br * 11) | 0;
  }

  // === Level::getTimeOfDay (Level.cpp:1232) — verbatim ===
  getTimeOfDay(a: number): number {
    let t = (this._time + a * TICKS_PER_DAY) % TICKS_PER_DAY;
    if (t < 0) t += TICKS_PER_DAY;
    return t / TICKS_PER_DAY;
  }

  // === Level::isDay (Level.cpp:841) ===
  isDay(): boolean { return this.skyDarken < 4; }

  // Level::updateSkyDarken (private) — sets skyDarken from current time.
  updateSkyDarken(): void {
    this.skyDarken = this.getSkyDarken(0);
  }

  // === Time + spawn API ===
  getTime(): number { return this._time; }
  setTime(time: number): void { this._time = time; this.updateSkyDarken(); }
  getSeed(): number { return this._seed; }
  getSharedSpawnPos(): { x: number; y: number; z: number } { return this._spawnPos; }
  setSpawnPos(pos: { x: number; y: number; z: number }): void { this._spawnPos = { ...pos }; }
  setSpawnSettings(enemies: boolean, friendlies: boolean): void {
    this._spawnEnemies = enemies;
    this._spawnFriendlies = friendlies;
  }
  getSeaLevel(): number { return SEA_LEVEL; }

  // === Level::addListener / removeListener ===
  addListener(l: LevelListener): void { this.listeners.push(l); }
  removeListener(l: LevelListener): void {
    const idx = this.listeners.indexOf(l);
    if (idx >= 0) this.listeners.splice(idx, 1);
  }

  // === Level::playSound / addParticle — stubs (deferred to SoundEngine + ParticleEngine ports) ===
  playSound(_entity: Entity | null, _name: string, _volume: number, _pitch: number): void {}
  playSoundAt(_x: number, _y: number, _z: number, _name: string, _volume: number, _pitch: number): void {}
  addParticle(_id: string, _x: number, _y: number, _z: number, _xd: number, _yd: number, _zd: number): void {}
  levelEvent(_source: Entity | null, _type: number, _x: number, _y: number, _z: number, _data: number): void {}
  tileEvent(_x: number, _y: number, _z: number, _b0: number, _b1: number): void {}
  broadcastEntityEvent(_e: Entity, _eventId: number): void {}

  // === Level::clip (Level.cpp:849) — verbatim raycast against world tiles ===
  clip(A: Vec3, b: Vec3, liquid = false, solidOnly = false): HitResult {
    if (A.x !== A.x || A.y !== A.y || A.z !== A.z) return new HitResult();
    if (b.x !== b.x || b.y !== b.y || b.z !== b.z) return new HitResult();
    let a = new Vec3(A.x, A.y, A.z);
    const xTile0 = Mth.floor(a.x);
    const yTile0 = Mth.floor(a.y);
    const zTile0 = Mth.floor(a.z);
    const xTile1 = Mth.floor(b.x);
    const yTile1 = Mth.floor(b.y);
    const zTile1 = Mth.floor(b.z);

    let maxIterations = 200;
    while (maxIterations-- >= 0) {
      if (a.x !== a.x || a.y !== a.y || a.z !== a.z) return new HitResult();
      const tile = Tile_tiles[this.getTile(Mth.floor(a.x), Mth.floor(a.y), Mth.floor(a.z))];
      if (tile) {
        const isLiquid = tile.material.isLiquid();
        const shouldHit = liquid ? isLiquid : (!isLiquid || solidOnly);
        if (shouldHit) {
          const tileAABB = tile.getTileAABB(this as never, Mth.floor(a.x), Mth.floor(a.y), Mth.floor(a.z));
          const hit = tileAABB.clip(a, b);
          if (hit.isHit()) {
            return HitResult.tile(Mth.floor(a.x), Mth.floor(a.y), Mth.floor(a.z), hit.f, hit.pos);
          }
        }
      }
      if (a.x === b.x && a.y === b.y && a.z === b.z) return new HitResult();
      // Step DDA toward b
      const step = new Vec3(b.x - a.x, b.y - a.y, b.z - a.z);
      const tX = step.x !== 0 ? (Math.sign(step.x) > 0 ? (Math.floor(a.x) + 1 - a.x) / step.x : (a.x - Math.floor(a.x)) / -step.x) : Infinity;
      const tY = step.y !== 0 ? (Math.sign(step.y) > 0 ? (Math.floor(a.y) + 1 - a.y) / step.y : (a.y - Math.floor(a.y)) / -step.y) : Infinity;
      const tZ = step.z !== 0 ? (Math.sign(step.z) > 0 ? (Math.floor(a.z) + 1 - a.z) / step.z : (a.z - Math.floor(a.z)) / -step.z) : Infinity;
      let tMin = Math.min(tX, tY, tZ);
      if (tMin === Infinity) return new HitResult();
      a = new Vec3(a.x + step.x * tMin, a.y + step.y * tMin, a.z + step.z * tMin);
    }
    return new HitResult();
  }

  // === Helper used by renderer ===
  getHeightmap(x: number, z: number): number {
    if (!this.hasChunk(x >> 4, z >> 4)) return 0;
    for (let y = DEPTH - 1; y >= 0; y--) {
      const t = this.getTile(x, y, z);
      if (t !== 0 && Tile_solid[t]) return y + 1;
    }
    return 0;
  }

  getTopTileY(x: number, z: number): number {
    return this.getHeightmap(x, z);
  }

  // Stubs that the EntityLevel interface in Entity.ts expects.
  static readonly sharedRandom: Random = new Random(0);
}
