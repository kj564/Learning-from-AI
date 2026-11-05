/** Translation of: QuartzBlockTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/QuartzBlockTile.h
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';

export class QuartzBlockTile extends Tile {
  constructor(id: number) {
    super(id, Material.stone);
    this.tex = 11 + 16 * 14; // approx MCPE quartz texture
  }
}
