/** Translation of: CarriedTile.h (grass_carried / leaves_carried — held in hand)
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/CarriedTile.h
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';

export class CarriedTile extends Tile {
  constructor(id: number, _tex: number, carriedTex: number) {
    super(id, carriedTex, Material.dirt);
  }
}
