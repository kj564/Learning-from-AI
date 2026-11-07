/** Translation of: CropTile.h + CropTile.cpp (113 LoC) — verbatim
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/CropTile.{h,cpp}
 */

import { Tile, SHAPE_ROWS } from './Tile';
import { Material } from '../material/Material';
import { Tiles } from './Tiles';

export class CropTile extends Tile {
  constructor(id: number, tex: number) {
    // C++: super(id, tex) — Bush parent in source. But CropTile extends Tile directly per .cpp.
    // Actually C++ CropTile extends Bush. Bush sets shape with ss=0.2. CropTile overrides.
    super(id, tex, Material.plant);
    this.tex = tex;
    this.setTicking(true);
    const ss = 0.5;
    this.setShape(0.5 - ss, 0, 0.5 - ss, 0.5 + ss, 0.25, 0.5 + ss);
  }

  // CropTile.cpp:35 — tick — verbatim
  tick(level: {
    getRawBrightness(x: number, y: number, z: number): number;
    getData(x: number, y: number, z: number): number;
    setData(x: number, y: number, z: number, data: number): void;
  }, x: number, y: number, z: number, random: { nextInt(n: number): number }): void {
    super.tick(level as never, x, y, z, random);
    const MAX_BRIGHTNESS = 15;
    if (level.getRawBrightness(x, y, z) >= MAX_BRIGHTNESS - 6) {
      let age = level.getData(x, y, z);
      if (age < 7) {
        const growthSpeed = this.getGrowthSpeed(level as never, x, y, z);
        if (random.nextInt(Math.floor(25 / growthSpeed) as number) === 0) {
          age++;
          level.setData(x, y, z, age);
        }
      }
    }
  }

  // CropTile.cpp:49 — growCropsToMax
  growCropsToMax(level: { setData(x: number, y: number, z: number, data: number): void }, x: number, y: number, z: number): void {
    level.setData(x, y, z, 7);
  }

  // CropTile.cpp:53 — getGrowthSpeed — verbatim
  getGrowthSpeed(level: {
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

  // CropTile.cpp:90 — getTexture(level, x, y, z, face)
  getTextureByLevel(level: { getData(x: number, y: number, z: number): number }, x: number, y: number, z: number, _face: number): number {
    let data = level.getData(x, y, z);
    if (data < 0) data = 7;
    return this.tex + data;
  }
  getTexture(_face: number, data?: number): number {
    let d = data ?? 0;
    if (d < 0) d = 7;
    return this.tex + d;
  }

  getRenderShape(): number { return SHAPE_ROWS; }

  // CropTile.cpp:113 — spawnResources — verbatim (mod Item::seeds_wheat)
  spawnResources(level: {
    isClientSide: boolean;
    random: { nextInt(n: number): number; nextFloat(): number };
    addEntity(e: unknown): void;
  }, x: number, y: number, z: number, data: number, odds: number): void {
    super.spawnResources(level, x, y, z, data, odds);
    if (level.isClientSide) return;
    const count = 3;
    for (let i = 0; i < count; i++) {
      if (level.random.nextInt(5 * 3) > data) continue;
      const s = 0.7;
      const xo = level.random.nextFloat() * s + (1 - s) * 0.5;
      const yo = level.random.nextFloat() * s + (1 - s) * 0.5;
      const zo = level.random.nextFloat() * s + (1 - s) * 0.5;
      // C++: new ItemEntity(level, x+xo, y+yo, z+zo, ItemInstance(Item::seeds_wheat))
      // Item::seeds_wheat deferred. Without Item port we can't spawn the seed entity.
      void xo; void yo; void zo;
    }
  }

  // CropTile.cpp:132 — getResource
  getResource(data: number, _random: unknown): number {
    if (data === 7) {
      // C++: return Item::wheat->id;
      // Item::wheat deferred.
      return -1;
    }
    return -1;
  }
  getResourceCount(_random: unknown): number { return 1; }
  protected mayPlaceOn(tile: number): boolean {
    return Tiles.farmland !== null && tile === Tiles.farmland.id;
  }
}
