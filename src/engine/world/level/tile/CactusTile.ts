/** Translation of: CactusTile.h — verbatim (header-only, all methods inline)
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/CactusTile.h
 */

import { Tile, SHAPE_CACTUS, RENDERLAYER_ALPHATEST } from './Tile';
import { Material } from '../material/Material';
import { Tiles } from './Tiles';
import { AABB } from '../../phys/AABB';

export class CactusTile extends Tile {
  constructor(id: number, tex: number) {
    // C++: super(id, tex, Material::cactus); setTicking(true);
    super(id, tex, Material.cactus);
    this.setTicking(true);
  }

  // CactusTile.h:23 — tick — verbatim
  tick(level: {
    isEmptyTile(x: number, y: number, z: number): boolean;
    getTile(x: number, y: number, z: number): number;
    getData(x: number, y: number, z: number): number;
    setTile(x: number, y: number, z: number, id: number): boolean;
    setData(x: number, y: number, z: number, data: number): void;
  }, x: number, y: number, z: number, _random: unknown): void {
    if (level.isEmptyTile(x, y + 1, z)) {
      let height = 1;
      while (level.getTile(x, y - height, z) === this.id) height++;
      if (height < 3) {
        const age = level.getData(x, y, z);
        // C++: if (age >= /*15*/ 10) — MCPE reduced threshold vs desktop
        if (age >= 10) {
          level.setTile(x, y + 1, z, this.id);
          level.setData(x, y, z, 0);
        } else {
          level.setData(x, y, z, age + 1);
        }
      }
    }
  }

  // CactusTile.h:42 — getAABB — verbatim
  getAABB(_level: unknown, x: number, y: number, z: number): AABB {
    const r = 1 / 16.0;
    this.tmpBB.x0 = x + r;
    this.tmpBB.y0 = y;
    this.tmpBB.z0 = z + r;
    this.tmpBB.x1 = x + 1 - r;
    this.tmpBB.y1 = y + 1 - r;
    this.tmpBB.z1 = z + 1 - r;
    return this.tmpBB;
  }

  // CactusTile.h:54 — getTileAABB — verbatim
  getTileAABB(_level: unknown, x: number, y: number, z: number): AABB {
    const r = 1 / 16.0;
    return new AABB(x + r, y, z + r, x + 1 - r, y + 1, z + 1 - r);
  }

  // CactusTile.h:59 — getTexture(int face)
  getTexture(face: number): number {
    if (face === 1) return this.tex - 1;
    if (face === 0) return this.tex + 1;
    return this.tex;
  }

  isCubeShaped(): boolean { return false; }
  isSolidRender(): boolean { return false; }
  getRenderShape(): number { return SHAPE_CACTUS; }
  getRenderLayer(): number { return RENDERLAYER_ALPHATEST; }

  // CactusTile.h:75 — mayPlace — verbatim
  mayPlace(level: { getTile(x: number, y: number, z: number): number }, x: number, y: number, z: number): boolean {
    if (!this.mayPlaceAt(level, x, y, z)) return false;
    return this.canSurvive(level as never, x, y, z);
  }

  // CactusTile.h:81 — neighborChanged — verbatim
  neighborChanged(level: {
    getData(x: number, y: number, z: number): number;
    setTile(x: number, y: number, z: number, id: number): void;
    spawnResources(level: unknown, x: number, y: number, z: number, data: number, odds: number): void;
  }, x: number, y: number, z: number, _type: number): void {
    if (!this.canSurvive(level as never, x, y, z)) {
      this.spawnResources(level as never, x, y, z, level.getData(x, y, z), 1);
      level.setTile(x, y, z, 0);
    }
  }

  // CactusTile.h:89 — canSurvive — verbatim
  canSurvive(level: {
    getMaterial(x: number, y: number, z: number): Material;
    getTile(x: number, y: number, z: number): number;
  }, x: number, y: number, z: number): boolean {
    if (level.getMaterial(x - 1, y, z).isSolid()) return false;
    if (level.getMaterial(x + 1, y, z).isSolid()) return false;
    if (level.getMaterial(x, y, z - 1).isSolid()) return false;
    if (level.getMaterial(x, y, z + 1).isSolid()) return false;
    const below = level.getTile(x, y - 1, z);
    return below === (Tiles.cactus?.id ?? -1) || below === (Tiles.sand?.id ?? -1);
  }

  // CactusTile.h:101 — entityInside — verbatim
  entityInside(_level: unknown, _x: number, _y: number, _z: number, entity: { hurt(source: unknown, dmg: number): boolean }): void {
    entity.hurt(null, 1);
  }
}
