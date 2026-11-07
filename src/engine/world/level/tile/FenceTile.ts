/** Translation of: FenceTile.h — verbatim (header-only)
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/FenceTile.h
 */

import { Tile, SHAPE_FENCE } from './Tile';
import { Material } from '../material/Material';
import { Tiles } from './Tiles';
import { AABB } from '../../phys/AABB';

export class FenceTile extends Tile {
  constructor(id: number, tex: number);
  constructor(id: number, tex: number, material: Material);
  constructor(id: number, tex: number, material?: Material) {
    // C++: super(id, tex, Material::wood) or super(id, tex, material)
    super(id, tex, material ?? Material.wood);
  }

  // FenceTile.h:25 — mayPlace — verbatim
  mayPlace(level: { getTile(x: number, y: number, z: number): number }, x: number, y: number, z: number): boolean {
    return this.mayPlaceAt(level, x, y, z);
  }

  // FenceTile.h:30 — getAABB — verbatim
  getAABB(_level: unknown, x: number, y: number, z: number): AABB {
    const level = _level as { getTile(x: number, y: number, z: number): number };
    const n = this.connectsTo(level, x, y, z - 1);
    const s = this.connectsTo(level, x, y, z + 1);
    const w = this.connectsTo(level, x - 1, y, z);
    const e = this.connectsTo(level, x + 1, y, z);
    let west = 6.0 / 16.0, east = 10.0 / 16.0, north = 6.0 / 16.0, south = 10.0 / 16.0;
    if (n) north = 0;
    if (s) south = 1;
    if (w) west = 0;
    if (e) east = 1;
    this.tmpBB.set(x + west, y, z + north, x + east, y + 1.5, z + south);
    return this.tmpBB;
  }

  // FenceTile.h:57 — updateShape — verbatim
  updateShape(level: { getTile(x: number, y: number, z: number): number }, x: number, y: number, z: number): void {
    const n = this.connectsTo(level, x, y, z - 1);
    const s = this.connectsTo(level, x, y, z + 1);
    const w = this.connectsTo(level, x - 1, y, z);
    const e = this.connectsTo(level, x + 1, y, z);
    let west = 6.0 / 16.0, east = 10.0 / 16.0, north = 6.0 / 16.0, south = 10.0 / 16.0;
    if (n) north = 0;
    if (s) south = 1;
    if (w) west = 0;
    if (e) east = 1;
    this.setShape(west, 0, north, east, 1.0, south);
  }

  blocksLight(): boolean { return false; }
  isSolidRender(): boolean { return false; }
  isCubeShaped(): boolean { return false; }
  getRenderShape(): number { return SHAPE_FENCE; }

  // FenceTile.h:90 — connectsTo — verbatim (mod Tile registry walk)
  connectsTo(level: { getTile(x: number, y: number, z: number): number }, x: number, y: number, z: number): boolean {
    const tile = level.getTile(x, y, z);
    if (tile === this.id) return true;
    if (Tiles.fenceGate !== null && tile === Tiles.fenceGate.id) return true;
    // C++: Tile* tileInstance = Tile::tiles[tile]; if (tileInstance) ...
    let tileInstance: Tile | null = null;
    for (const key of Object.keys((globalThis as { __tileRefs?: Record<string, Tile | null> }).__tileRefs ?? {})) {
      const t = (globalThis as { __tileRefs?: Record<string, Tile | null> }).__tileRefs?.[key];
      if (t && t.id === tile) { tileInstance = t; break; }
    }
    if (tileInstance !== null) {
      if (tileInstance.material.isSolidBlocking() && tileInstance.isCubeShaped()) {
        return tileInstance.material !== Material.vegetable;
      }
    }
    return false;
  }
}
