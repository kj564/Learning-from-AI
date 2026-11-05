/** Translation of: ReedTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/ReedTile.h
 */
import { Tile, SHAPE_CROSS_TEXTURE } from './Tile';
import { Material } from '../material/Material';

export class ReedTile extends Tile {
  constructor(id: number, tex: number) {
    super(id, tex, Material.plant);
  }
  getRenderShape(): number { return SHAPE_CROSS_TEXTURE; }
  isSolidRender(): boolean { return false; }
  isCubeShaped(): boolean { return false; }
}
