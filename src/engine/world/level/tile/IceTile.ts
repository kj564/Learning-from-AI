/** Translation of: IceTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/IceTile.h
 */
import { Tile, RENDERLAYER_ALPHATEST } from './Tile';
import { Material } from '../material/Material';

export class IceTile extends Tile {
  constructor(id: number, tex: number) {
    super(id, tex, Material.ice);
  }
  getRenderLayer(): number { return RENDERLAYER_ALPHATEST; }
}
