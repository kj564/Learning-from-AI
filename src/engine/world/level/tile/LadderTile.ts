/** Translation of: LadderTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/LadderTile.h
 */
import { Tile, SHAPE_LADDER } from './Tile';
import { Material } from '../material/Material';

export class LadderTile extends Tile {
  constructor(id: number, tex: number) {
    super(id, tex, Material.wood);
  }
  getRenderShape(): number { return SHAPE_LADDER; }
  isSolidRender(): boolean { return false; }
  isCubeShaped(): boolean { return false; }
}
