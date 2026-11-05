/** Translation of: WebTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/WebTile.h
 */
import { Tile, RENDERLAYER_ALPHATEST, SHAPE_CROSS_TEXTURE } from './Tile';
import { Material } from '../material/Material';

export class WebTile extends Tile {
  constructor(id: number, tex: number) {
    super(id, tex, Material.web);
  }
  getRenderLayer(): number { return RENDERLAYER_ALPHATEST; }
  isSolidRender(): boolean { return false; }
  getRenderShape(): number { return SHAPE_CROSS_TEXTURE; }
  isCubeShaped(): boolean { return false; }
  // C++: bool blocksLight() { return false; }
  blocksLight(): boolean { return false; }
  // C++: AABB* getAABB(Level*, x,y,z) { return NULL; }
  getAABB(_level: unknown, _x: number, _y: number, _z: number): null { return null; }
  // C++: int getResource(int data, Random*) { return Item::string->id; }
  // Item::string deferred — return id (the dropped string item is in a later iter).
  getResource(_data: number, _random: unknown): number { return this.id; }
}
