/** Translation of: ClayTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/ClayTile.h
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';

export class ClayTile extends Tile {
  constructor(id: number, tex: number) {
    super(id, tex, Material.clay);
  }
}
