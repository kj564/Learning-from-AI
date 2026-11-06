/** Translation of: DoorTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/DoorTile.h
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';

export class DoorTile extends Tile {
  protected doorMaterial: Material;
  constructor(id: number, material: Material) {
    super(id, material);
    this.doorMaterial = material;
  }
  isCubeShaped(): boolean { return false; }
  isSolidRender(): boolean { return false; }
}
