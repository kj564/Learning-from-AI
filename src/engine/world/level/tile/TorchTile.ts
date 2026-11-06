/** Translation of: TorchTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/TorchTile.h
 * Bodies in TorchTile.cpp (deferred). Constructor + render shape constant.
 */
import { Tile, SHAPE_TORCH } from './Tile';
import { Material } from '../material/Material';

export class TorchTile extends Tile {
  constructor(id: number, tex: number) {
    super(id, tex, Material.wood);
  }
  getRenderShape(): number { return SHAPE_TORCH; }
}
