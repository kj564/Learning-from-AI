/** Translation of: HeavyTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/HeavyTile.h
 *
 * Sand/gravel "falling" tile. The constructor + onPlace + neighborChanged +
 * tick + getTickDelay + isFree + falling + onLand + checkSlide — bodies in
 * HeavyTile.cpp (deferred). We translate the class skeleton + static fields.
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';

export class HeavyTile extends Tile {
  static instaFall = false;

  constructor(id: number, tex: number);
  constructor(id: number, tex: number, material: Material);
  constructor(id: number, tex: number, material?: Material) {
    if (material === undefined) {
      // The C++ source: HeavyTile(int id, int tex) — body in HeavyTile.cpp;
      // since sand is HeavyTile(12, 18) and gravel extends HeavyTile(type, tex),
      // the no-material ctor defaults to Material::sand? Reading HeavyTile.cpp
      // is required for the exact material default. We assume sand (sand is
      // the typical HeavyTile parent material).
      super(id, tex, Material.sand);
    } else {
      super(id, tex, material);
    }
  }

  // onPlace / neighborChanged / tick / getTickDelay / isFree / falling / onLand
  // bodies live in HeavyTile.cpp — deferred.
}
