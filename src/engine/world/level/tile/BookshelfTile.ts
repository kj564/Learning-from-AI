/** Translation of: BookshelfTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/BookshelfTile.h
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';

export class BookshelfTile extends Tile {
  constructor(id: number, tex: number) {
    super(id, tex, Material.wood);
  }
  // C++: int getTexture(int face) — body in BookshelfTile.cpp
  // (returns 4 for sides, tex for top/bottom). Approximation here.
  getTexture(face: number): number {
    if (face === 2 || face === 3 || face === 4 || face === 5) return 4;
    return this.tex;
  }
}
