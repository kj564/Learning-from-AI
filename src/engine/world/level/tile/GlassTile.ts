/** Translation of: HalfTransparentTile.h (parent of GlassTile + ThinFenceTile).
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/HalfTransparentTile.h
 * (Inline in GlassTile.ts since only GlassTile and ThinFenceTile use it.)
 */
import { Tile, RENDERLAYER_ALPHATEST } from './Tile';
import { Material } from '../material/Material';

export class HalfTransparentTile extends Tile {
  protected allowSame: boolean;
  constructor(id: number, tex: number, material: Material, allowSame: boolean) {
    super(id, tex, material);
    this.allowSame = allowSame;
  }
  isSolidRender(): boolean { return !this.allowSame; }
  getRenderLayer(): number { return RENDERLAYER_ALPHATEST; }
}

/** Translation of: GlassTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/GlassTile.h
 */
export class GlassTile extends HalfTransparentTile {
  constructor(id: number, tex: number, material: Material, allowSame: boolean) {
    super(id, tex, material, allowSame);
  }
  getResourceCount(_random: unknown): number { return 0; }
  getRenderLayer(): number { return RENDERLAYER_ALPHATEST; }
}
