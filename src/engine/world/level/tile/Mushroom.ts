/** Translation of: Mushroom.h + Mushroom.cpp (56 LoC)
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/Mushroom.{h,cpp}
 *
 * Verbatim:
 *   - constructor(id, tex): super(id, tex) [Bush], setShape(0.5-0.2, 0, 0.5-0.2, 0.5+0.2, 0.4, 0.5+0.2), setTicking(true)
 *   - tick(level, x, y, z, random): mushroom-spreading logic
 *   - mayPlace(level, x, y, z, face): super.mayPlace + canSurvive
 *   - mayPlaceOn(tile): Tile::solid[tile]
 *   - canSurvive(level, x, y, z): y in [0, LEVEL_HEIGHT), brightness < 13 and mayPlaceOn(below)
 */

import { Bush } from './Bush';
import { LEVEL_HEIGHT } from '../LevelConstants';
import { solid as Tile_solid } from './Tile';

export class Mushroom extends Bush {
  constructor(id: number, tex: number) {
    // C++: super(id, tex) → Bush(id, tex) → Tile(id, Material::plant), this->tex = tex, setTicking(true),
    //                         setShape(0.5 - ss, 0, 0.5 - ss, 0.5 + ss, ss*3, 0.5 + ss) with ss = 0.2
    super(id, tex);
    // Mushroom.cpp:137 — override shape with ss = 0.2 (sides + height = 2*ss = 0.4)
    const ss = 0.2;
    this.setShape(0.5 - ss, 0, 0.5 - ss, 0.5 + ss, ss * 2, 0.5 + ss);
    this.setTicking(true);
  }

  // Mushroom.cpp:142 — tick(level, x, y, z, random) — verbatim
  tick(level: {
    isClientSide: boolean;
    getTile(x: number, y: number, z: number): number;
    isEmptyTile(x: number, y: number, z: number): boolean;
    setTile(x: number, y: number, z: number, id: number): void;
  }, x: number, y: number, z: number, random: { nextInt(n: number): number }): void {
    if (random.nextInt(25) === 0) {
      const r = 4;
      let max = 5;
      for (let xx = x - r; xx <= x + r; xx++) {
        for (let zz = z - r; zz <= z + r; zz++) {
          for (let yy = y - 1; yy <= y + 1; yy++) {
            if (level.getTile(xx, yy, zz) === this.id && --max <= 0) return;
          }
        }
      }
      let x2 = x + random.nextInt(3) - 1;
      let y2 = y + random.nextInt(2) - random.nextInt(2);
      let z2 = z + random.nextInt(3) - 1;
      for (let i = 0; i < 4; i++) {
        if (level.isEmptyTile(x2, y2, z2) && this.canSurvive(level as never, x2, y2, z2)) {
          x = x2; y = y2; z = z2;
        }
        x2 = x + random.nextInt(3) - 1;
        y2 = y + random.nextInt(2) - random.nextInt(2);
        z2 = z + random.nextInt(3) - 1;
      }
      if (level.isEmptyTile(x2, y2, z2) && this.canSurvive(level as never, x2, y2, z2)) {
        level.setTile(x2, y2, z2, this.id);
      }
    }
  }

  // Mushroom.cpp:172 — mayPlace(level, x, y, z, face): super::mayPlace(level, x, y, z, face) && canSurvive(level, x, y, z)
  mayPlace(level: { getTile(x: number, y: number, z: number): number }, x: number, y: number, z: number, face: number): boolean {
    return super.mayPlace(level, x, y, z, face) && this.canSurvive(level as never, x, y, z);
  }

  // Mushroom.cpp:176 — mayPlaceOn(tile): return Tile::solid[tile];
  protected mayPlaceOn(tile: number): boolean {
    return Tile_solid[tile] === true;
  }

  // Mushroom.cpp:180 — canSurvive(level, x, y, z): verbatim
  canSurvive(level: {
    getTile(x: number, y: number, z: number): number;
    getRawBrightness(x: number, y: number, z: number): number;
  }, x: number, y: number, z: number): boolean {
    if (y < 0 || y >= LEVEL_HEIGHT) return false;
    const below = level.getTile(x, y - 1, z);
    return (level.getRawBrightness(x, y, z) < 13 && this.mayPlaceOn(below));
  }
}
