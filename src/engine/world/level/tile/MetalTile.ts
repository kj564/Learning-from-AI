/** Translation of: MetalTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/MetalTile.h
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';

export class MetalTile extends Tile {
  constructor(id: number, tex: number) {
    super(id, Material.metal);
    this.tex = tex;
  }
  getTexture(_face: number): number { return this.tex; }
}
