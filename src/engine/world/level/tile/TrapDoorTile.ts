/** Translation of: TrapDoorTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/TrapDoorTile.h
 */
import { Tile, SHAPE_DOOR } from './Tile';
import { Material } from '../material/Material';

export class TrapDoorTile extends Tile {
  constructor(id: number, material: Material) {
    super(id, material);
  }
  getRenderShape(): number { return SHAPE_DOOR; }
  isSolidRender(): boolean { return false; }
  isCubeShaped(): boolean { return false; }
}
