/** Translation of: StemTile.h + StemTile.cpp (153 LoC) — verbatim
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/StemTile.{h,cpp}
 *
 * StemTile extends Bush (which sets material = Material::plant).
 */

import { Bush } from './Bush';
import { Tile, SHAPE_STEM } from './Tile';
import { Tiles } from './Tiles';
import { Item } from '../../item/Item';
import { ItemInstance } from '../../item/ItemInstance';

export class StemTile extends Bush {
  private fruitTile: Tile;

  constructor(id: number, fruit: Tile) {
    // C++: StemTile(int id, Tile* fruit) : super(id, 15 + 6 * 16), fruit(fruit)
    // super = Bush(int id, int tex) → Tile(id, Material::plant), this->tex = tex, setTicking(true), shape ss=0.2
    super(id, 15 + 6 * 16);
    this.fruitTile = fruit;
    // C++: setTicking(true); float ss = 0.125; setShape(0.5 - ss, 0, 0.5 - ss, 0.5 + ss, 0.25, 0.5 + ss)
    this.setTicking(true);
    const ss = 0.125;
    this.setShape(0.5 - ss, 0, 0.5 - ss, 0.5 + ss, 0.25, 0.5 + ss);
  }

  // StemTile.cpp:15 — mayPlaceOn(tile) → return tile == Tile::farmland->id;
  protected mayPlaceOn(tile: number): boolean {
    return Tiles.farmland !== null && tile === Tiles.farmland.id;
  }

  // StemTile.cpp:19 — tick — verbatim
  tick(level: {
    getRawBrightness(x: number, y: number, z: number): number;
    getData(x: number, y: number, z: number): number;
    setData(x: number, y: number, z: number, data: number): void;
    getTile(x: number, y: number, z: number): number;
    setTile(x: number, y: number, z: number, id: number): boolean;
  }, x: number, y: number, z: number, random: { nextInt(n: number): number }): void {
    super.tick(level as never, x, y, z, random);
    const MAX_BRIGHTNESS = 15;
    if (level.getRawBrightness(x, y + 1, z) >= MAX_BRIGHTNESS - 6) {
      const growthSpeed = this.getGrowthSpeed(level as never, x, y, z);
      if (random.nextInt(Math.floor(25 / growthSpeed) + 1) === 0) {
        let age = level.getData(x, y, z);
        if (age < 7) {
          age++;
          level.setData(x, y, z, age);
        } else {
          if (level.getTile(x - 1, y, z) === this.fruitTile.id) return;
          if (level.getTile(x + 1, y, z) === this.fruitTile.id) return;
          if (level.getTile(x, y, z - 1) === this.fruitTile.id) return;
          if (level.getTile(x, y, z + 1) === this.fruitTile.id) return;
          for (let a = 0; a < 4; ++a) {
            const dir = a;
            let xx = x, zz = z;
            if (dir === 0) xx--;
            if (dir === 1) xx++;
            if (dir === 2) zz--;
            if (dir === 3) zz++;
            const below = level.getTile(xx, y - 1, zz);
            if (level.getTile(xx, y, zz) === 0 && (below === (Tiles.farmland?.id ?? -1) || below === (Tiles.dirt?.id ?? -1) || below === (Tiles.grass?.id ?? -1))) {
              level.setTile(xx, y, zz, this.fruitTile.id);
              break;
            }
          }
        }
      }
    }
  }

  // StemTile.cpp:55 — growCropsToMax
  growCropsToMax(level: { setData(x: number, y: number, z: number, data: number): void }, x: number, y: number, z: number): void {
    level.setData(x, y, z, 7);
  }

  // StemTile.cpp:60 — getGrowthSpeed — verbatim
  private getGrowthSpeed(level: {
    getTile(x: number, y: number, z: number): number;
    getData(x: number, y: number, z: number): number;
  }, x: number, y: number, z: number): number {
    let speed = 1;
    const n = level.getTile(x, y, z - 1);
    const s = level.getTile(x, y, z + 1);
    const w = level.getTile(x - 1, y, z);
    const e = level.getTile(x + 1, y, z);
    const d0 = level.getTile(x - 1, y, z - 1);
    const d1 = level.getTile(x + 1, y, z - 1);
    const d2 = level.getTile(x + 1, y, z + 1);
    const d3 = level.getTile(x - 1, y, z + 1);
    const horizontal = w === this.id || e === this.id;
    const vertical = n === this.id || s === this.id;
    const diagonal = d0 === this.id || d1 === this.id || d2 === this.id || d3 === this.id;
    for (let xx = x - 1; xx <= x + 1; xx++) {
      for (let zz = z - 1; zz <= z + 1; zz++) {
        const t = level.getTile(xx, y - 1, zz);
        let tileSpeed = 0;
        if (Tiles.farmland && t === Tiles.farmland.id) {
          tileSpeed = 1;
          if (level.getData(xx, y - 1, zz) > 0) tileSpeed = 3;
        }
        if (xx !== x || zz !== z) tileSpeed /= 4;
        speed += tileSpeed;
      }
    }
    if (diagonal || (horizontal && vertical)) speed /= 2;
    return speed;
  }

  // StemTile.cpp:97 — getColor(int data)
  getColor(): number;
  getColor(data: number): number;
  getColor(level: { getData(x: number, y: number, z: number): number }, x: number, y: number, z: number): number;
  getColor(a?: number | { getData(x: number, y: number, z: number): number }, b?: number, c?: number, d?: number): number {
    if (a === undefined) {
      // getColor() — not in source but signature exists. Default to 0.
      return 0;
    }
    if (typeof a === 'number') {
      // getColor(int data) — StemTile.cpp:97
      const data = a;
      const r = data * 32;
      const g = 255 - data * 8;
      const bb = data * 4;
      return (r << 16) | (g << 8) | bb;
    }
    // getColor(level, x, y, z) — StemTile.cpp:105
    const level = a as { getData(x: number, y: number, z: number): number };
    return this.getColor(level.getData(b as number, c as number, d as number));
  }

  // StemTile.cpp:109 — getTexture(int face, int data)
  getTexture(_face: number, _data?: number): number {
    return this.tex;
  }

  // StemTile.cpp:113 — updateDefaultShape
  updateDefaultShape(): void {
    const ss = 0.125;
    this.setShape(0.5 - ss, 0, 0.5 - ss, 0.5 + ss, 0.25, 0.5 + ss);
  }

  // StemTile.cpp:117 — updateShape(level, x, y, z) — verbatim
  updateShape(level: { getData(x: number, y: number, z: number): number }, x: number, y: number, z: number): void {
    this.yy1 = (level.getData(x, y, z) * 2 + 2) / 16.0;
    const ss = 0.125;
    this.setShape(0.5 - ss, 0, 0.5 - ss, 0.5 + ss, this.yy1, 0.5 + ss);
  }

  // StemTile.cpp:123 — getRenderShape
  getRenderShape(): number { return SHAPE_STEM; }

  // StemTile.cpp:127 — getConnectDir — verbatim
  getConnectDir(level: {
    getData(x: number, y: number, z: number): number;
    getTile(x: number, y: number, z: number): number;
  }, x: number, y: number, z: number): number {
    const d = level.getData(x, y, z);
    if (d < 7) return -1;
    if (level.getTile(x - 1, y, z) === this.fruitTile.id) return 0;
    if (level.getTile(x + 1, y, z) === this.fruitTile.id) return 1;
    if (level.getTile(x, y, z - 1) === this.fruitTile.id) return 2;
    if (level.getTile(x, y, z + 1) === this.fruitTile.id) return 3;
    return -1;
  }

  // StemTile.cpp:139 — spawnResources — verbatim (mod Item::seeds_melon)
  spawnResources(level: {
    isClientSide: boolean;
    random: { nextInt(n: number): number };
    addEntity(e: unknown): void;
    popResource(level: unknown, x: number, y: number, z: number, itemInstance: unknown): void;
  }, x: number, y: number, z: number, data: number, odds: number): void {
    super.spawnResources(level, x, y, z, data, odds);
    if (level.isClientSide) return;
    // C++: if (fruit == Tile::melon) seed = Item::seeds_melon;
    if (this.fruitTile === Tiles.melon) {
      for (let i = 0; i < 3; i++) {
        if (level.random.nextInt(5 * 3) > data) continue;
        this.popResource(level as never, x, y, z, new ItemInstance(Item.seeds_melon!, 1, 0));
      }
    }
  }

  // StemTile.cpp:155 — getResource: return -1 (no resource; stem drops seeds via spawnResources)
  getResource(_data: number, _random: unknown): number { return -1; }
  getResourceCount(_random: unknown): number { return 1; }
}
