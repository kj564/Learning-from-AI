/** Translation of: Sapling.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/Sapling.h
 *
 * Sapling extends Bush. We translate the constructor body (which sets a
 * cross-shaped footprint) here. The tick + growTree behaviour is in
 * Sapling.cpp (deferred; MVP just keeps the shape + mayPlaceOn check).
 */
import { Bush } from './Bush';

export class Sapling extends Bush {
  static readonly TYPE_MASK = 3;
  static readonly AGE_BIT = 8;

  constructor(id: number, tex: number) {
    super(id, tex);
    // From Sapling.h constructor: float ss = 0.4f; setShape(0.5-ss, 0, 0.5-ss, 0.5+ss, ss*2, 0.5+ss)
    const ss = 0.4;
    this.setShape(0.5 - ss, 0, 0.5 - ss, 0.5 + ss, ss * 2, 0.5 + ss);
  }
}
