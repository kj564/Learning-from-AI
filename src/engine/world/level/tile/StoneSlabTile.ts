/** Translation of: StoneSlabTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/StoneSlabTile.h
 * Bodies in StoneSlabTile.cpp (deferred). Constants translated.
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';

export class StoneSlabTile extends Tile {
  static readonly STONE_SLAB = 0;
  static readonly SAND_SLAB = 1;
  static readonly WOOD_SLAB = 2;
  static readonly COBBLESTONE_SLAB = 3;
  static readonly BRICK_SLAB = 4;
  static readonly SMOOTHBRICK_SLAB = 5;

  static readonly TYPE_MASK = 7;
  static readonly TOP_SLOT_BIT = 8;

  protected fullSize: boolean;

  constructor(id: number, fullSize: boolean) {
    // C++: StoneSlabTile(int id, bool fullSize) : Tile(id, 6, Material::stone)
    super(id, 6, Material.stone);
    this.fullSize = fullSize;
  }

  getTexture(_face: number, _data?: number): number {
    return this.tex;
  }

  isSolidRender(): boolean {
    return this.fullSize;
  }

  isCubeShaped(): boolean {
    return this.fullSize;
  }
}
