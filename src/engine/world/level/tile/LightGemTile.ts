/** Translation of: LightGemTile.h + LightGemTile.cpp — verbatim
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/LightGemTile.{h,cpp}
 */

import { Tile } from './Tile';
import { Material } from '../material/Material';

export class LightGemTile extends Tile {
  constructor(id: number, tex: number, material: Material) {
    super(id, tex, material);
  }

  // LightGemTile.cpp:9 — getResourceCount: return 2 + random->nextInt(3);
  getResourceCount(random: { nextInt(n: number): number }): number {
    return 2 + random.nextInt(3);
  }

  // LightGemTile.cpp:13 — getResource: return Item::yellowDust->id;
  // Item::yellowDust deferred. Source comment: glowstone drops yellow dust (sulfur).
  // We return -1 (no drop) until Item port — documented gap.
  getResource(_data: number, _random: unknown): number {
    return -1;
  }
}
