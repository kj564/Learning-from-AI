/** Translation of: FenceTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/FenceTile.h
 */
import { Tile, SHAPE_FENCE } from './Tile';
import { Material } from '../material/Material';

export class FenceTile extends Tile {
  constructor(id: number, tex: number) {
    super(id, tex, Material.wood);
  }
  getRenderShape(): number { return SHAPE_FENCE; }
  isCubeShaped(): boolean { return false; }
  isSolidRender(): boolean { return false; }
}
