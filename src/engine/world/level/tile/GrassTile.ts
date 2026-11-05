/** Translation of: GrassTile.h — Tile::grass subclass.
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/GrassTile.h
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';

export class GrassTile extends Tile {
  static readonly MIN_BRIGHTNESS = 4;

  constructor(id: number) {
    super(id, Material.dirt);
    this.tex = 0;
  }

  // C++ has getTexture(LevelSource*, x,y,z, face), getTexture(face, data), getColor.
  // Bodies live in GrassTile.cpp (not yet ported). For MVP we return the basic texture.
  getResource(_data: number, _random: unknown): number {
    return Tiles.dirt!.id;
  }
}

// Late import to avoid circular — Tiles.ts has no cycle with GrassTile.
import { Tiles } from './Tiles';
