/** Translation of: TreeTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/TreeTile.h
 *
 * The log tile. getTexture(face, data) handles DARK_TRUNK vs BIRCH_TRUNK vs normal.
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';
import { Tiles } from './Tiles';

export class TreeTile extends Tile {
  static readonly NORMAL_TRUNK = 0;
  static readonly DARK_TRUNK = 1;
  static readonly BIRCH_TRUNK = 2;

  constructor(id: number) {
    super(id, Material.wood);
    // C++: tex = 20;
    this.tex = 20;
  }

  getResourceCount(_random: unknown): number {
    return 1;
  }

  getResource(_data: number, _random: unknown): number {
    // C++: return Tile::treeTrunk->id; (i.e. itself)
    return Tiles.treeTrunk!.id;
  }

  // C++ getTexture(int face, int data) — faithful.
  getTexture(face: number, data: number): number;
  getTexture(face: number): number;
  getTexture(face: number, data?: number): number {
    if (face === 1) return 21;
    if (face === 0) return 21;
    if (data === TreeTile.DARK_TRUNK) return 4 + 7 * 16;
    if (data === TreeTile.BIRCH_TRUNK) return 5 + 7 * 16;
    return 20;
  }

  // C++: int getSpawnResourcesAuxValue(int data) { return data; }
  protected getSpawnResourcesAuxValue(data: number): number {
    return data;
  }

  // onRemove body lives in TreeTile.cpp (leaf decay trigger) — deferred.
}
