/** Translation of: MelonTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/MelonTile.h
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';

export class MelonTile extends Tile {
  constructor(id: number) {
    super(id, Material.plant);
    this.tex = 9 + 8 * 16; // approx MCPE melon texture
  }
}
