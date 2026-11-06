/** Translation of: NetherReactor.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/NetherReactor.h
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';

export class NetherReactor extends Tile {
  constructor(id: number, tex: number, material: Material) {
    super(id, tex, material);
  }
}
