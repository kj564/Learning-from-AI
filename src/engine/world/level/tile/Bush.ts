/** Translation of: Bush.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/Bush.h
 *
 * Cross-textured plant tile. Faithful translation of the constructor body
 * and the canSurvive / getAABB / getRenderShape / getRenderLayer overrides.
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';
import { SHAPE_CROSS_TEXTURE, RENDERLAYER_ALPHATEST } from './Tile';
import { Tiles } from './Tiles';

export class Bush extends Tile {
  constructor(id: number, tex: number);
  constructor(id: number, tex: number, material: Material);
  constructor(id: number, tex: number, material?: Material) {
    if (material === undefined) {
      // Bush(id, tex) → Tile(id, Material::plant), this->tex = tex
      super(id, Material.plant);
      this.tex = tex;
    } else {
      // Bush(id, tex, material) → Tile(id, material), this->tex = tex
      super(id, material);
      this.tex = tex;
    }
    this.setTicking(true);
    // Both constructors: float ss = 0.2; setShape(0.5-ss, 0, 0.5-ss, 0.5+ss, ss*3, 0.5+ss)
    const ss = 0.2;
    this.setShape(0.5 - ss, 0, 0.5 - ss, 0.5 + ss, ss * 3, 0.5 + ss);
  }

  mayPlace(level: { getTile(x: number, y: number, z: number): number }, x: number, y: number, z: number, _face: number): boolean {
    return this.mayPlaceOn(level.getTile(x, y - 1, z));
  }

  neighborChanged(level: { getTile(x: number, y: number, z: number): number; getData(x: number, y: number, z: number): number; setTile(x: number, y: number, z: number, id: number): void }, x: number, y: number, z: number, type: number): void {
    super.neighborChanged(level, x, y, z, type);
    this.checkAlive(level, x, y, z);
  }

  tick(level: unknown, x: number, y: number, z: number, _random: unknown): void {
    // Cast for checkAlive
    this.checkAlive(level as never, x, y, z);
  }

  canSurvive(level: { getRawBrightness(x: number, y: number, z: number): number; canSeeSky(x: number, y: number, z: number): boolean; getTile(x: number, y: number, z: number): number }, x: number, y: number, z: number): boolean {
    return (level.getRawBrightness(x, y, z) >= 8 || level.canSeeSky(x, y, z)) && this.mayPlaceOn(level.getTile(x, y - 1, z));
  }

  // C++: getAABB returns NULL. TS: return null.
  getAABB(_level: unknown, _x: number, _y: number, _z: number): Tile['tmpBB'] | null {
    return null;
  }

  blocksLight(): boolean { return false; }
  isSolidRender(): boolean { return false; }
  isCubeShaped(): boolean { return false; }
  getRenderShape(): number { return SHAPE_CROSS_TEXTURE; }
  getRenderLayer(): number { return RENDERLAYER_ALPHATEST; }

  protected mayPlaceOn(tile: number): boolean {
    return tile === Tiles.grass!.id || tile === Tiles.dirt!.id || tile === Tiles.farmland!.id;
  }

  // C++: const void checkAlive(Level* level, int x, int y, int z) { ... }
  protected checkAlive(level: { getRawBrightness(x: number, y: number, z: number): number; canSeeSky(x: number, y: number, z: number): boolean; getTile(x: number, y: number, z: number): number; getData(x: number, y: number, z: number): number; setTile(x: number, y: number, z: number, id: number): void }, x: number, y: number, z: number): void {
    if (!this.canSurvive(level, x, y, z)) {
      this.spawnResources(level, x, y, z, level.getData(x, y, z));
      level.setTile(x, y, z, 0);
    }
  }
}
