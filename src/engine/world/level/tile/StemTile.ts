/** Translation of: StemTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/StemTile.h
 */
import { Tile, SHAPE_STEM } from './Tile';
import { Material } from '../material/Material';

export class StemTile extends Tile {
  protected fruitTile: Tile;
  constructor(id: number, fruitTile: Tile) {
    super(id, Material.plant);
    this.fruitTile = fruitTile;
  }
  getRenderShape(): number { return SHAPE_STEM; }
}
