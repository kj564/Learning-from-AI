/** Translation of: DirectionalTile.h — parent of BedTile and others.
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/DirectionalTile.h
 * (Inline here since only BedTile depends on it in our porting subset.)
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';

export class DirectionalTile extends Tile {
  protected dataToDir: number[] = [];
  protected dirToData: number[] = [];

  constructor(id: number, material: Material) {
    super(id, material);
  }
}

/** Translation of: BedTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/BedTile.h
 * Bodies live in BedTile.cpp — deferred. We keep the constants.
 */
export class BedTile extends DirectionalTile {
  static readonly HEAD_PIECE_DATA = 0x8;
  static readonly OCCUPIED_DATA = 0x4;
  static readonly HEAD_DIRECTION_OFFSETS: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];

  constructor(id: number) {
    super(id, Material.cloth);
  }
}
