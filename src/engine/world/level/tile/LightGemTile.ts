/** Translation of: LightGemTile.h (Glowstone)
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/LightGemTile.h
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';

export class LightGemTile extends Tile {
  constructor(id: number, tex: number, material: Material) {
    super(id, tex, material);
  }
}
