/** Translation of: SignTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/SignTile.h
 */
import { Tile, SHAPE_BLOCK } from './Tile';
import { Material } from '../material/Material';

export class SignTile extends Tile {
  protected isStanding: boolean;
  protected tileEntityType: string;
  constructor(id: number, tileEntityType: string, isStanding: boolean) {
    super(id, Material.wood);
    this.tileEntityType = tileEntityType;
    this.isStanding = isStanding;
  }
  getRenderShape(): number { return SHAPE_BLOCK; }
  isSolidRender(): boolean { return false; }
  isCubeShaped(): boolean { return false; }
}
