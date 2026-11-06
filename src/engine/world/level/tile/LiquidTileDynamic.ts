/** Translation of: LiquidTileDynamic.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/LiquidTileDynamic.h
 *
 * The entire tick() body is translated inline below — including the
 * depth-spread algorithm, getHighest, canSpreadTo, isWaterBlocking, getSpread,
 * trySpreadTo, getSlopeDistance. This is the water-flow algorithm — the
 * single most-requested missing feature in the original mcpe-wasm port.
 */

import { LiquidTile } from './LiquidTile';
import { Material } from '../material/Material';
import { Tiles } from './Tiles';

interface LiquidLevel {
  isClientSide: boolean;
  dimension?: { ultraWarm: boolean };
  getTile(x: number, y: number, z: number): number;
  getData(x: number, y: number, z: number): number;
  setData(x: number, y: number, z: number, data: number): void;
  setDataNoUpdate(x: number, y: number, z: number, data: number): void;
  setTile(x: number, y: number, z: number, id: number): void;
  setTileAndData(x: number, y: number, z: number, id: number, data: number): void;
  setTileAndDataNoUpdate(x: number, y: number, z: number, id: number, data: number): void;
  setTilesDirty(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void;
  sendTileUpdated(x: number, y: number, z: number): void;
  addToTickNextTick(x: number, y: number, z: number, id: number, delay: number): void;
  updateNeighborsAt(x: number, y: number, z: number, id: number): void;
  isSolidBlockingTile(x: number, y: number, z: number): boolean;
  getMaterial(x: number, y: number, z: number): Material;
  noNeighborUpdate: boolean;
}

export class LiquidTileDynamic extends LiquidTile {
  private maxCount = 0;

  // From C++ class fields:
  private static readonly NumDirections = 4;
  private result: boolean[] = new Array(LiquidTileDynamic.NumDirections).fill(false);
  private dist: number[] = new Array(LiquidTileDynamic.NumDirections).fill(0);

  constructor(id: number, material: Material) {
    super(id, material);
  }

  // Translation of tick() — verbatim from LiquidTileDynamic.h
  tick(level: LiquidLevel, x: number, y: number, z: number, random: { nextInt(n: number): number }): void {
    let depth = this.getDepth(level, x, y, z);
    const dropOff = 1;
    let becomeStatic = true;

    if (depth > 0) {
      let highest = -100;
      this.maxCount = 0;
      highest = this.getHighest(level, x - 1, y, z, highest);
      highest = this.getHighest(level, x + 1, y, z, highest);
      highest = this.getHighest(level, x, y, z - 1, highest);
      highest = this.getHighest(level, x, y, z + 1, highest);

      let newDepth = highest + dropOff;
      if (newDepth >= 8 || highest < 0) newDepth = -1;
      if (this.getDepth(level, x, y + 1, z) >= 0) {
        const above = this.getDepth(level, x, y + 1, z);
        if (above >= 8) newDepth = above;
        else newDepth = above + 8;
      }
      if (this.maxCount >= 2 && this.material === Material.water) {
        if (level.isSolidBlockingTile(x, y - 1, z)) {
          newDepth = 0;
        } else if (level.getMaterial(x, y - 1, z) === this.material && level.getData(x, y, z) === 0) {
          newDepth = 0;
        }
      }
      if (this.material === Material.lava) {
        if (depth < 8 && newDepth < 8) {
          if (newDepth > depth) {
            if (random.nextInt(4) !== 0) {
              newDepth = depth;
              becomeStatic = false;
            }
          }
        }
      }
      if (newDepth !== depth) {
        depth = newDepth;
        if (depth < 0) {
          level.setTile(x, y, z, 0);
        } else {
          level.setData(x, y, z, depth);
          level.addToTickNextTick(x, y, z, this.id, this.getTickDelay());
          level.updateNeighborsAt(x, y, z, this.id);
        }
      } else {
        if (becomeStatic) this.setStatic(level, x, y, z);
      }
    } else {
      this.setStatic(level, x, y, z);
    }
    if (this.canSpreadTo(level, x, y - 1, z)) {
      if (depth >= 8) level.setTileAndData(x, y - 1, z, this.id, depth);
      else level.setTileAndData(x, y - 1, z, this.id, depth + 8);
    } else if (depth >= 0 && (depth === 0 || this.isWaterBlocking(level, x, y - 1, z))) {
      const spreads = this.getSpread(level, x, y, z);
      let neighbor = depth + dropOff;
      if (depth >= 8) neighbor = 1;
      if (neighbor >= 8) return;
      if (spreads[0]) this.trySpreadTo(level, x - 1, y, z, neighbor);
      if (spreads[1]) this.trySpreadTo(level, x + 1, y, z, neighbor);
      if (spreads[2]) this.trySpreadTo(level, x, y, z - 1, neighbor);
      if (spreads[3]) this.trySpreadTo(level, x, y, z + 1, neighbor);
    }
  }

  // protected int getHighest(Level*, int x, int y, int z, int current)
  getHighest(level: LiquidLevel, x: number, y: number, z: number, current: number): number {
    const d = this.getDepth(level, x, y, z);
    if (d < 0) return current;
    if (d === 0) this.maxCount++;
    let dd = d;
    if (d >= 8) dd = 0;
    return current < 0 || dd < current ? dd : current;
  }

  onPlace(level: LiquidLevel, x: number, y: number, z: number): void {
    super.onPlace(level as never, x, y, z);
    if (level.getTile(x, y, z) === this.id) {
      level.addToTickNextTick(x, y, z, this.id, this.getTickDelay());
    }
  }

  // getDepth and setStatic are in LiquidTile.cpp (parent) — translated as a
  // helper. From LiquidTile.cpp: int getDepth(Level*, x,y,z) { int t = level->getTile(x,y,z);
  //   if (t == 0) return -1; if (t != id && t != id+1) return -1; return level->getData(x,y,z); }
  private getDepth(level: { getTile(x: number, y: number, z: number): number; getData(x: number, y: number, z: number): number }, x: number, y: number, z: number): number {
    const t = level.getTile(x, y, z);
    if (t === 0) return -1;
    if (t !== this.id && t !== this.id + 1) return -1;
    return level.getData(x, y, z);
  }

  private setStatic(level: LiquidLevel, x: number, y: number, z: number): void {
    const d = level.getData(x, y, z);
    level.setTileAndDataNoUpdate(x, y, z, this.id + 1, d);
    level.setTilesDirty(x, y, z, x, y, z);
    level.sendTileUpdated(x, y, z);
  }

  private canSpreadTo(level: { getMaterial(x: number, y: number, z: number): Material; getTile(x: number, y: number, z: number): number }, x: number, y: number, z: number): boolean {
    const target = level.getMaterial(x, y, z);
    if (target === this.material) return false;
    if (target === Material.lava) return false;
    return !this.isWaterBlocking(level, x, y, z);
  }

  // Faithful isWaterBlocking from LiquidTileDynamic.h
  private isWaterBlocking(level: { getTile(x: number, y: number, z: number): number }, x: number, y: number, z: number): boolean {
    const t = level.getTile(x, y, z);
    if (t === 0) return false;
    if (t === Tiles.door_wood!.id || t === Tiles.sign!.id || t === Tiles.ladder!.id || t === Tiles.reeds!.id) {
      return true;
    }
    const m = (Tiles as any).tiles[t]?.material;
    if (!m) return false;
    if (m.blocksMotion()) return true;
    if (m.isSolid()) return true;
    return false;
  }

  private getSpread(level: LiquidLevel, x: number, y: number, z: number): boolean[] {
    for (let d = 0; d < 4; d++) {
      this.dist[d] = 1000;
      let xx = x, yy = y, zz = z;
      if (d === 0) xx--;
      if (d === 1) xx++;
      if (d === 2) zz--;
      if (d === 3) zz++;
      if (this.isWaterBlocking(level, xx, yy, zz)) {
        continue;
      } else if (level.getMaterial(xx, yy, zz) === this.material && level.getData(xx, yy, zz) === 0) {
        continue;
      } else {
        if (!this.isWaterBlocking(level, xx, yy - 1, zz)) {
          this.dist[d] = 0;
        } else {
          this.dist[d] = this.getSlopeDistance(level, xx, yy, zz, 1, d);
        }
      }
    }
    let lowest = this.dist[0];
    for (let d = 1; d < 4; d++) if (this.dist[d] < lowest) lowest = this.dist[d];
    for (let d = 0; d < 4; d++) this.result[d] = this.dist[d] === lowest;
    return this.result;
  }

  private trySpreadTo(level: LiquidLevel, x: number, y: number, z: number, neighbor: number): void {
    if (this.canSpreadTo(level, x, y, z)) {
      const old = level.getTile(x, y, z);
      if (old > 0) {
        if (this.material === Material.lava) {
          this.fizz(level, x, y, z);
        } else {
          // Tile::tiles[old]->spawnResources(level, x, y, z, level->getData(x, y, z))
          // — deferred until Tiles.tiles becomes a runtime-accessible table.
        }
      }
      level.setTileAndData(x, y, z, this.id, neighbor);
    }
  }

  private getSlopeDistance(level: LiquidLevel, x: number, y: number, z: number, pass: number, from: number): number {
    let lowest = 1000;
    for (let d = 0; d < 4; d++) {
      if (d === 0 && from === 1) continue;
      if (d === 1 && from === 0) continue;
      if (d === 2 && from === 3) continue;
      if (d === 3 && from === 2) continue;
      let xx = x, yy = y, zz = z;
      if (d === 0) xx--;
      if (d === 1) xx++;
      if (d === 2) zz--;
      if (d === 3) zz++;
      if (this.isWaterBlocking(level, xx, yy, zz)) {
        continue;
      } else if (level.getMaterial(xx, yy, zz) === this.material && level.getData(xx, yy, zz) === 0) {
        continue;
      } else {
        if (!this.isWaterBlocking(level, xx, yy - 1, zz)) {
          return pass;
        } else {
          if (pass < 4) {
            const v = this.getSlopeDistance(level, xx, yy, zz, pass + 1, d);
            if (v < lowest) lowest = v;
          }
        }
      }
    }
    return lowest;
  }

  private fizz(_level: LiquidLevel, _x: number, _y: number, _z: number): void {
    // Lava-meets-water fizz — body in LiquidTileDynamic.cpp (deferred).
  }
}
