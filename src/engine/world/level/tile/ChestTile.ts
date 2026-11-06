/** Translation of: ChestTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/ChestTile.h
 * Bodies in ChestTile.cpp (deferred).
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';

export class ChestTile extends Tile {
  constructor(id: number) {
    super(id, Material.wood);
  }
}
