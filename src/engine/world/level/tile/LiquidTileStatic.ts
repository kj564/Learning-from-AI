/** Translation of: LiquidTileStatic.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/LiquidTileStatic.h
 */
import { LiquidTile } from './LiquidTile';
import { Material } from '../material/Material';

interface LiquidLevel {
  noNeighborUpdate: boolean;
  getTile(x: number, y: number, z: number): number;
  getData(x: number, y: number, z: number): number;
  setTileAndDataNoUpdate(x: number, y: number, z: number, id: number, data: number): void;
  setTilesDirty(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void;
  addToTickNextTick(x: number, y: number, z: number, id: number, delay: number): void;
  getMaterial(x: number, y: number, z: number): Material;
  setTile(x: number, y: number, z: number, id: number): void;
}

export class LiquidTileStatic extends LiquidTile {
  constructor(id: number, material: Material) {
    super(id, material);
    this.setTicking(false);
    if (material === Material.lava) this.setTicking(true);
  }

  neighborChanged(level: LiquidLevel, x: number, y: number, z: number, type: number): void {
    super.neighborChanged(level as never, x, y, z, type);
    if (level.getTile(x, y, z) === this.id) {
      this.setDynamic(level, x, y, z);
    }
  }

  tick(_level: unknown, _x: number, _y: number, _z: number, _random: unknown): void {
    // C++: //@fire  return;
    // The body is commented out — early return is the literal translation.
    return;
  }

  private isFlammable(level: { getMaterial(x: number, y: number, z: number): Material }, x: number, y: number, z: number): boolean {
    return level.getMaterial(x, y, z).isFlammable();
  }

  private setDynamic(level: LiquidLevel, x: number, y: number, z: number): void {
    const d = level.getData(x, y, z);
    level.noNeighborUpdate = true;
    level.setTileAndDataNoUpdate(x, y, z, this.id - 1, d);
    level.setTilesDirty(x, y, z, x, y, z);
    level.addToTickNextTick(x, y, z, this.id - 1, this.getTickDelay());
    level.noNeighborUpdate = false;
  }
}
