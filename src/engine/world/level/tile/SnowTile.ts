/** Translation of: SnowTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/SnowTile.h
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';

export class SnowTile extends Tile {
  constructor(id: number, tex: number) {
    super(id, tex, Material.snow);
  }
}
