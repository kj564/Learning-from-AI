/** Translation of: TntTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/TntTile.h
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';

export class TntTile extends Tile {
  static readonly EXPLODE_BIT = 1;

  constructor(id: number, tex: number) {
    super(id, tex, Material.explosive);
  }

  getTexture(face: number): number {
    if (face === 0) return this.tex + 2;
    if (face === 1) return this.tex + 1;
    return this.tex;
  }

  getResourceCount(_random: unknown): number { return 1; }
  // wasExploded / destroy / use bodies live in TntTile.cpp — deferred.
}
