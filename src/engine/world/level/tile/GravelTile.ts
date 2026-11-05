/** Translation of: GravelTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/GravelTile.h
 */
import { HeavyTile } from './HeavyTile';
import { Tiles } from './Tiles';

export class GravelTile extends HeavyTile {
  constructor(type: number, tex: number) {
    super(type, tex);
  }

  // C++: getResource(int data, Random* random) { if (random->nextInt(10)==0) return Item::flint->id; return id; }
  // Item::flint is not yet ported (Item port is a later iter). Return id for now.
  getResource(_data: number, random: { nextInt(n: number): number }): number {
    if (random.nextInt(10) === 0) {
      // Item::flint->id — deferred until Item is ported.
      return this.id;
    }
    return this.id;
  }
}
