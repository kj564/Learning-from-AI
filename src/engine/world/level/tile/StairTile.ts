/** Translation of: StairTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/StairTile.h
 * Bodies in StairTile.cpp (deferred). Constructor + reference to source tile.
 */
import { Tile, SHAPE_STAIRS } from './Tile';

export class StairTile extends Tile {
  protected modelTile: Tile;
  constructor(id: number, modelTile: Tile) {
    // C++: StairTile(int id, Tile* model) : Tile(id, model->material) { this->modelTile = model; }
    super(id, (modelTile as any).material);
    this.modelTile = modelTile;
    this.tex = modelTile.tex;
  }
  getRenderShape(): number { return SHAPE_STAIRS; }
}
