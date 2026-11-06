/** Translation of: ClothTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/ClothTile.h
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';

export class ClothTile extends Tile {
  static readonly COLOR_TEX_POS = 7 * 16 + 1;

  constructor(id: number) {
    super(id, 4 * 16, Material.cloth);
  }

  // C++: int getTexture(int face, int data)
  getTexture(face: number, data: number): number;
  getTexture(face: number): number;
  getTexture(_face: number, data?: number): number {
    if (data === undefined || data === 0) return this.tex;
    // invert bits
    let d = ~(data & 0xf);
    return ClothTile.COLOR_TEX_POS + ((d & 8) >> 3) + ((d & 7) * 16);
  }

  static getTileDataForItemAuxValue(auxValue: number): number {
    return ~auxValue & 0xf;
  }
  protected getSpawnResourcesAuxValue(data: number): number {
    return data;
  }
  static getItemAuxValueForTileData(data: number): number {
    return ~data & 0xf;
  }
}
