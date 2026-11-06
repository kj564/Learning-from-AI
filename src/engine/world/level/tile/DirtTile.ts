/** Translation of: DirtTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/DirtTile.h
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';

export class DirtTile extends Tile {
  constructor(id: number, tex: number) {
    super(id, tex, Material.dirt);
  }
}
