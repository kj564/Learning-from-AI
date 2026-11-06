/** Translation of: LiquidTile.h (parent of Dynamic/Static)
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/LiquidTile.h
 *
 * Translated inline — the parent of LiquidTileDynamic and LiquidTileStatic.
 * We translate only the parts needed by the dynamic/static subclasses;
 * many methods in LiquidTile.cpp are deferred.
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';
import { SHAPE_WATER } from './Tile';

export class LiquidTile extends Tile {
  constructor(id: number, material: Material) {
    super(id, material);
    this.setTicking(true);
  }

  getRenderShape(): number { return SHAPE_WATER; }
  shouldRenderFace(_level: unknown, _x: number, _y: number, _z: number, _face: number): boolean {
    // From LiquidTile.cpp — not ported in detail yet. Default: render if
    // the neighbor is not the same liquid.
    return true;
  }
  isSolidRender(): boolean { return false; }
  isCubeShaped(): boolean { return false; }

  // C++: int getResource(int data, Random* random) { return 0; }
  getResource(_data: number, _random: unknown): number { return 0; }

  // C++ getTickDelay() — body in LiquidTile.cpp. We return the C++ const:
  //   if (material == Material::lava) return 5; return 10; (approximated)
  getTickDelay(): number {
    if (this.material === Material.lava) return 5;
    return 10;
  }
}
