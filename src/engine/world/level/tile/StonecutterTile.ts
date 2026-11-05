/** Translation of: StonecutterTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/StonecutterTile.h
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';

export class StonecutterTile extends Tile {
  constructor(id: number) {
    super(id, Material.stone);
    this.tex = 8 + 16 * 13; // approx MCPE stonecutter texture
  }
}
