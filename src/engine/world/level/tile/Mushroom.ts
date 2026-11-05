/** Translation of: Mushroom.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/Mushroom.h
 */
import { Bush } from './Bush';

export class Mushroom extends Bush {
  constructor(id: number, tex: number) {
    // C++: Mushroom(int id, int tex) — body in Mushroom.cpp (deferred)
    super(id, tex);
  }
  // mayPlace / canSurvive / tick bodies live in Mushroom.cpp — deferred.
}
