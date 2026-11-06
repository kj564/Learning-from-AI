/** Translation of: ObsidianTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/ObsidianTile.h
 * Bodies in ObsidianTile.cpp (deferred). Constructor + glow flag.
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';

export class ObsidianTile extends Tile {
  constructor(id: number, tex: number, _glowing: boolean) {
    super(id, tex, Material.stone);
  }
}
