/** Translation of: TallGrass.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/TallGrass.h
 * Bodies in TallGrass.cpp (deferred). Constants translated.
 */
import { Bush } from './Bush';

export class TallGrass extends Bush {
  static readonly DEAD_SHRUB = 0;
  static readonly TALL_GRASS = 1;
  static readonly FERN = 3;

  constructor(id: number, tex: number) {
    super(id, tex);
  }
}
