/** Translation of: CactusTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/CactusTile.h
 */
import { Tile, SHAPE_CACTUS } from './Tile';
import { Material } from '../material/Material';

export class CactusTile extends Tile {
  constructor(id: number, tex: number) {
    super(id, tex, Material.cactus);
  }
  getRenderShape(): number { return SHAPE_CACTUS; }
}
