/** Translation of: FenceGateTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/FenceGateTile.h
 */
import { Tile, SHAPE_FENCE_GATE } from './Tile';
import { Material } from '../material/Material';

export class FenceGateTile extends Tile {
  constructor(id: number, tex: number) {
    super(id, tex, Material.wood);
  }
  getRenderShape(): number { return SHAPE_FENCE_GATE; }
  isCubeShaped(): boolean { return false; }
  isSolidRender(): boolean { return false; }
}
