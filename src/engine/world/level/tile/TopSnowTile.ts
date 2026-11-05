/** Translation of: TopSnowTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/TopSnowTile.h
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';

export class TopSnowTile extends Tile {
  constructor(id: number, tex: number) {
    super(id, tex, Material.topSnow);
  }
  isSolidRender(): boolean { return false; }
  isCubeShaped(): boolean { return false; }
}
