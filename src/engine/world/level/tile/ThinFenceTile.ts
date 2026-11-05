/** Translation of: ThinFenceTile.h (glass pane)
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/ThinFenceTile.h
 */
import { HalfTransparentTile } from './GlassTile';
import { Material } from '../material/Material';

export class ThinFenceTile extends HalfTransparentTile {
  constructor(id: number, tex: number, _sideTex: number, material: Material, allowSame: boolean) {
    super(id, tex, material, allowSame);
  }
}
