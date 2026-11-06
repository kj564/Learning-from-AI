/** Translation of: InvisibleTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/InvisibleTile.h
 */
import { Tile, SHAPE_INVISIBLE } from './Tile';
import { Material } from '../material/Material';

export class InvisibleTile extends Tile {
  constructor(id: number, tex: number, material: Material) {
    super(id, tex, material);
  }
  getRenderShape(): number { return SHAPE_INVISIBLE; }
  isSolidRender(): boolean { return false; }
}
