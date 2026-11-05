/** Translation of: RedStoneOreTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/RedStoneOreTile.h
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';

export class RedStoneOreTile extends Tile {
  protected isLit: boolean;
  constructor(id: number, tex: number, isLit: boolean) {
    super(id, tex, Material.stone);
    this.isLit = isLit;
  }
}
