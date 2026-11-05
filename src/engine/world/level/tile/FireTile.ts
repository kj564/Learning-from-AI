/** Translation of: FireTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/FireTile.h
 * Bodies in FireTile.cpp (deferred). Constants translated.
 */
import { Tile, SHAPE_FIRE } from './Tile';
import { Material } from '../material/Material';

export class FireTile extends Tile {
  constructor(id: number, tex: number) {
    super(id, tex, Material.fire);
  }
  getRenderShape(): number { return SHAPE_FIRE; }
  isSolidRender(): boolean { return false; }
  isCubeShaped(): boolean { return false; }
}
