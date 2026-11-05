/** Translation of: FurnaceTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/FurnaceTile.h
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';

export class FurnaceTile extends Tile {
  protected isLit: boolean;
  constructor(id: number, isLit: boolean) {
    super(id, Material.stone);
    this.isLit = isLit;
  }
  getTexture(face: number): number {
    if (face === 1) return 14;     // top
    if (face === 0) return 14;     // bottom
    if (face === 3) return this.isLit ? 14 + 16 * 3 : 14 + 16 * 2; // front
    return 13 + 16 * 2;            // side
  }
}
