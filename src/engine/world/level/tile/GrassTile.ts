/** Translation of: GrassTile.h + GrassTile.cpp (54 LoC)
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/GrassTile.{h,cpp}
 *
 * Verbatim translation of every method body:
 *   - constructor: tex=3, setTicking(true)
 *   - getTexture(level, x,y,z, face): top=0, bottom=2, snow-covered=4*16+4, side=3
 *   - getTexture(face, data): same minus snow check
 *   - getColor: 0x339933 (GrassColor.get deferred)
 *   - tick: grass-dies-in-dark + spreads-to-dirt-in-light
 *   - getResource: returns Tile::dirt->getResource(0, random)
 */

import { Tile } from './Tile';
import { Material } from '../material/Material';
import { Tiles } from './Tiles';

export class GrassTile extends Tile {
  static readonly MIN_BRIGHTNESS = 4;

  constructor(id: number) {
    // C++: super(id, Material::dirt); tex = 3; setTicking(true);
    super(id, Material.dirt);
    this.tex = 3;
    this.setTicking(true);
  }

  // GrassTile.cpp:13 — getTexture(level, x, y, z, face)
  getTextureByLevel(level: { getMaterial(x: number, y: number, z: number): Material }, x: number, y: number, z: number, face: number): number {
    if (face === 1) return 0;
    if (face === 0) return 2;
    const above = level.getMaterial(x, y + 1, z);
    if (above === Material.topSnow || above === Material.snow) return 4 * 16 + 4;
    return 3;
  }

  // GrassTile.cpp:21 — getTexture(face, data)
  getTexture(face: number, data?: number): number;
  getTexture(level: unknown, x: number, y: number, z: number, face: number): number;
  getTexture(a: number | unknown, b?: number, c?: number, d?: number, e?: number): number {
    if (typeof a === 'number') {
      // getTexture(face, data) — GrassTile.cpp:21
      if (a === 1) return 0;
      if (a === 0) return 2;
      return 3;
    }
    // getTexture(level, x, y, z, face) — GrassTile.cpp:13
    return this.getTextureByLevel(a as { getMaterial: (x: number, y: number, z: number) => Material }, b as number, c as number, d as number, e as number);
  }

  // GrassTile.cpp:27 — getColor(level, x, y, z)
  getColor(_level: unknown, _x: number, _y: number, _z: number): number {
    return 0x339933;
  }

  // GrassTile.cpp:35 — tick(level, x, y, z, random) — verbatim
  tick(level: {
    isClientSide: boolean;
    getRawBrightness(x: number, y: number, z: number): number;
    getMaterial(x: number, y: number, z: number): Material;
    setTile(x: number, y: number, z: number, id: number): boolean;
    getTile(x: number, y: number, z: number): number;
  }, x: number, y: number, z: number, random: { nextInt(n: number): number }): void {
    if (level.isClientSide) return;

    const MAX_BRIGHTNESS = 15;
    if (level.getRawBrightness(x, y + 1, z) < GrassTile.MIN_BRIGHTNESS && level.getMaterial(x, y + 1, z).blocksLight()) {
      if (random.nextInt(4) !== 0) return;
      level.setTile(x, y, z, Tiles.dirt!.id);
    } else {
      if (level.getRawBrightness(x, y + 1, z) >= MAX_BRIGHTNESS - 6) {
        const xt = x + random.nextInt(3) - 1;
        const yt = y + random.nextInt(5) - 3;
        const zt = z + random.nextInt(3) - 1;
        if (level.getTile(xt, yt, zt) === Tiles.dirt!.id
          && level.getRawBrightness(xt, yt + 1, zt) >= GrassTile.MIN_BRIGHTNESS
          && !level.getMaterial(xt, yt + 1, zt).blocksLight()) {
          level.setTile(xt, yt, zt, Tiles.grass!.id);
        }
      }
    }
  }

  // GrassTile.cpp:53 — getResource(data, random) → Tile::dirt->getResource(0, random)
  getResource(_data: number, random: unknown): number {
    return Tiles.dirt!.getResource(0, random as never);
  }
}
