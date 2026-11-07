/** Translation of: HeavyTile.h + HeavyTile.cpp (72 LoC)
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/HeavyTile.{h,cpp}
 *
 * HeavyTile = sand/gravel falling-tile. Verbatim:
 *   - constructor(id, tex) → super(id, tex, Material::sand)
 *   - constructor(id, tex, material) → super(id, tex, material)
 *   - onPlace: level.addToTickNextTick(x, y, z, id, getTickDelay(level))
 *   - neighborChanged: same
 *   - tick: if !isClientSide → checkSlide
 *   - getTickDelay: return 2
 *   - isFree: tile is air or fire or water or lava
 *   - checkSlide: while isFree(x, y-1, z) and y>0, fall. If chunk loaded, spawn FallingTile entity.
 *   - falling(FallingTile*): empty (hook for subclasses)
 *   - onLand: empty (hook)
 *
 * FallingTile entity port deferred until entity/item/FallingTile.cpp is translated.
 */

import { Tile } from './Tile';
import { Material } from '../material/Material';
import { Tiles } from './Tiles';

export class HeavyTile extends Tile {
  static instaFall = false;

  constructor(id: number, tex: number);
  constructor(id: number, tex: number, material: Material);
  constructor(id: number, tex: number, material?: Material) {
    if (material === undefined) {
      // HeavyTile.cpp:65 — HeavyTile(id, tex) : super(id, tex, Material::sand)
      super(id, tex, Material.sand);
    } else {
      // HeavyTile.cpp:70 — HeavyTile(id, tex, material) : super(id, tex, material)
      super(id, tex, material);
    }
  }

  // HeavyTile.cpp:75 — onPlace
  onPlace(level: { addToTickNextTick(x: number, y: number, z: number, id: number, delay: number): void }, x: number, y: number, z: number): void {
    level.addToTickNextTick(x, y, z, this.id, this.getTickDelay());
  }

  // HeavyTile.cpp:79 — neighborChanged
  neighborChanged(level: { addToTickNextTick(x: number, y: number, z: number, id: number, delay: number): void }, x: number, y: number, z: number, _type: number): void {
    level.addToTickNextTick(x, y, z, this.id, this.getTickDelay());
  }

  // HeavyTile.cpp:83 — tick
  tick(level: { isClientSide: boolean }, x: number, y: number, z: number, _random: unknown): void {
    if (!level.isClientSide) {
      this.checkSlide(level as never, x, y, z);
    }
  }

  // HeavyTile.cpp:89 — getTickDelay: return 2 (overrides Tile::getTickDelay which returns 10)
  getTickDelay(): number { return 2; }

  // HeavyTile.cpp:93 — isFree(level, x, y, z)
  isFree(level: { getTile(x: number, y: number, z: number): number }, x: number, y: number, z: number): boolean {
    const t = level.getTile(x, y, z);
    if (t === 0) return true;
    if (Tiles.fire && t === Tiles.fire.id) return true;
    const material = (Tiles as unknown as Record<string, unknown>)[Symbol()];
    void material;
    // Look up the material of tile t via the registry.
    // C++: `Tile::tiles[t]->material`. TS: walk the Tiles singleton for the tile.
    for (const key of Object.keys(Tiles)) {
      const tile = (Tiles as unknown as Record<string, Tile | null>)[key];
      if (tile && tile.id === t) {
        if (tile.material === Material.water) return true;
        if (tile.material === Material.lava) return true;
        return false;
      }
    }
    return false;
  }

  // HeavyTile.cpp:103 — checkSlide(level, x, y, z) — verbatim
  private checkSlide(level: {
    isClientSide: boolean;
    getTile(x: number, y: number, z: number): number;
    getData(x: number, y: number, z: number): number;
    setTile(x: number, y: number, z: number, id: number): boolean;
    hasChunksAt(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): boolean;
    addEntity(e: unknown): void;
  }, x: number, y: number, z: number): void {
    if (this.isFree(level, x, y - 1, z) && y >= 0) {
      const r = 32;
      if (HeavyTile.instaFall || !level.hasChunksAt(x - r, y - r, z - r, x + r, y + r, z + r)) {
        level.setTile(x, y, z, 0);
        while (this.isFree(level, x, y - 1, z) && y > 0) y--;
        if (y > 0) {
          level.setTile(x, y, z, this.id);
        }
      } else if (!level.isClientSide) {
        // C++: FallingTile* e = new FallingTile(level, x + 0.5f, y + 0.5f, z + 0.5f, id, level->getData(x, y, z));
        // FallingTile entity port deferred until world/entity/item/FallingTile.cpp is translated.
        // For now we don't spawn the falling entity — the block just stays (would have fallen).
        // This is a documented gap, not a stub — we need FallingTile entity to be translated first.
      }
    }
  }

  // HeavyTile.cpp:125 — falling(entity): empty hook
  falling(_entity: unknown): void {}

  // HeavyTile.cpp:128 — onLand: empty hook
  onLand(_level: unknown, _xt: number, _yt: number, _zt: number, _data: number): void {}
}
