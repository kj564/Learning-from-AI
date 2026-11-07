/** Translation of: ReedTile.h — verbatim (header-only)
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/ReedTile.h
 */

import { Tile, SHAPE_CROSS_TEXTURE, RENDERLAYER_ALPHATEST } from './Tile';
import { Material } from '../material/Material';
import { Tiles } from './Tiles';
import { ItemInstance } from '../../item/ItemInstance';
import { Item } from '../../item/Item';
import { AABB } from '../../phys/AABB';

export class ReedTile extends Tile {
  constructor(id: number, tex: number) {
    // C++: Tile(id, Material::plant); this->tex = tex;
    //      float ss = 6 / 16.0; setShape(0.5 - ss, 0, 0.5 - ss, 0.5 + ss, 1, 0.5 + ss);
    //      setTicking(true);
    super(id, Material.plant);
    this.tex = tex;
    const ss = 6 / 16.0;
    this.setShape(0.5 - ss, 0, 0.5 - ss, 0.5 + ss, 1, 0.5 + ss);
    this.setTicking(true);
  }

  // ReedTile.h:19 — tick — verbatim
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
        if (age === 15) {
          level.setTile(x, y + 1, z, this.id);
          level.setData(x, y, z, 0);
        } else {
          level.setData(x, y, z, age + 1);
        }
      }
    }
  }

  // ReedTile.h:34 — mayPlace — verbatim
  mayPlace(level: {
    getTile(x: number, y: number, z: number): number;
    getMaterial(x: number, y: number, z: number): Material;
  }, x: number, y: number, z: number): boolean {
    const below = level.getTile(x, y - 1, z);
    if (below === this.id) return true;
    if (below !== (Tiles.grass?.id ?? -1) && below !== (Tiles.dirt?.id ?? -1) && below !== (Tiles.sand?.id ?? -1)) return false;
    if (level.getMaterial(x - 1, y - 1, z) === Material.water) return true;
    if (level.getMaterial(x + 1, y - 1, z) === Material.water) return true;
    if (level.getMaterial(x, y - 1, z - 1) === Material.water) return true;
    if (level.getMaterial(x, y - 1, z + 1) === Material.water) return true;
    return false;
  }

  // ReedTile.h:48 — neighborChanged → checkAlive
  neighborChanged(level: {
    getTile(x: number, y: number, z: number): number;
    getMaterial(x: number, y: number, z: number): Material;
    setTile(x: number, y: number, z: number, id: number): boolean;
    popResource(level: unknown, x: number, y: number, z: number, itemInstance: unknown): void;
  }, x: number, y: number, z: number, _type: number): void {
    this.checkAlive(level as never, x, y, z);
  }

  // ReedTile.h:53 — canSurvive → mayPlace
  canSurvive(level: {
    getTile(x: number, y: number, z: number): number;
    getMaterial(x: number, y: number, z: number): Material;
  }, x: number, y: number, z: number): boolean {
    return this.mayPlace(level, x, y, z);
  }

  // ReedTile.h:57 — getAABB → NULL
  getAABB(_level: unknown, _x: number, _y: number, _z: number): AABB | null {
    return null;
  }

  // ReedTile.h:61 — getResource → Item::reeds->id (now wired)
  getResource(_data: number, _random: unknown): number {
    return Item.reeds!.id;
  }

  blocksLight(): boolean { return false; }
  isSolidRender(): boolean { return false; }
  isCubeShaped(): boolean { return false; }
  getRenderShape(): number { return SHAPE_CROSS_TEXTURE; }
  getRenderLayer(): number { return RENDERLAYER_ALPHATEST; }

  // ReedTile.h:79 — checkAlive — verbatim (now with Item::reeds wired)
  private checkAlive(level: {
    getTile(x: number, y: number, z: number): number;
    getMaterial(x: number, y: number, z: number): Material;
    setTile(x: number, y: number, z: number, id: number): void;
    popResource(level: unknown, x: number, y: number, z: number, itemInstance: unknown): void;
  }, x: number, y: number, z: number): void {
    if (!this.canSurvive(level as never, x, y, z)) {
      this.popResource(level as never, x, y, z, new ItemInstance(Item.reeds!, 1, 0));
      level.setTile(x, y, z, 0);
    }
  }
}
