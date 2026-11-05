/**
 * Translation of: StoneTile.h
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/StoneTile.h
 */

import { Tile } from './Tile';
import { Material } from '../material/Material';
import { Tiles } from './Tiles';

export class StoneTile extends Tile {
  constructor(id: number, tex: number) {
    super(id, tex, Material.stone);
  }

  // Faithful: int getResource(int data, Random* random) { return Tile::stoneBrick->id; }
  getResource(_data: number, _random: unknown): number {
    return Tiles.stoneBrick!.id;
  }
}

