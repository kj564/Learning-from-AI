/** Translation of: WorkbenchTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/WorkbenchTile.h
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';

export class WorkbenchTile extends Tile {
  constructor(id: number) {
    super(id, Material.wood);
  }
  // C++: int getTexture(int face) — body in WorkbenchTile.cpp
  // Top = workbench_top tex (10), sides = workbench_side (12), front = 11.
  getTexture(face: number): number {
    if (face === 1) return 10;
    if (face === 0) return 4;
    if (face === 3) return 11;
    return 12;
  }
}
