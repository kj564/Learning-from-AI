/** Translation of: FarmTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/FarmTile.h
 * Bodies in FarmTile.cpp (deferred).
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';

export class FarmTile extends Tile {
  constructor(id: number) {
    super(id, Material.dirt);
    this.tex = 6; // approx: farmland texture id from MCPE terrain.png
  }
  isCubeShaped(): boolean { return false; }
  // Body in FarmTile.cpp sets shape to (0,0,0,1, 15/16, 1)
  updateDefaultShape(): void {
    this.setShape(0, 0, 0, 1, 15 / 16, 1);
  }
}
