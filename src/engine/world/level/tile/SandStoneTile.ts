/** Translation of: MultiTextureTile.h (parent of SandStoneTile).
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/MultiTextureTile.h
 * (Inline here for the same reason as HalfTransparentTile.)
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';

export class MultiTextureTile extends Tile {
  protected textures: number[];
  protected texCount: number;
  protected textureNum = 0;

  constructor(id: number, textures: number[], texCount: number, material: Material) {
    super(id, material);
    this.textures = textures;
    this.texCount = texCount;
    this.tex = textures[0];
  }

  getTexture(face: number, data?: number): number {
    if (face === 1) return this.textures[0];
    if (face === 0) return this.textures[1] ?? this.textures[0];
    void data;
    return this.textures[2] ?? this.textures[0];
  }
}

/** Translation of: SandStoneTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/SandStoneTile.h
 */
import { Facing } from '../../../shared/Facing';

export class SandStoneTile extends MultiTextureTile {
  static readonly TYPE_DEFAULT = 0;
  static readonly TYPE_HEIROGLYPHS = 1;
  static readonly TYPE_SMOOTHSIDE = 2;

  constructor(id: number, textures: number[], texCount: number) {
    super(id, textures, texCount, Material.stone);
  }

  getTexture(face: number, data?: number): number {
    if (face === Facing.UP || (face === Facing.DOWN && (data ?? 0) > 0)) {
      return 11 * 16;
    }
    if (face === Facing.DOWN) {
      return 13 * 16;
    }
    return super.getTexture(face, data);
  }
}
