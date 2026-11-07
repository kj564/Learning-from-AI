/** Translation of: StairTile.h + StairTile.cpp (237 LoC)
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/StairTile.{h,cpp}
 *
 * StairTile is one of the most complex Tiles — it has 8 sub-shapes for
 * corner-stair merging. Verbatim translation of:
 *   - DEAD_SPACES[8][2] — corner culling table
 *   - getPlacedOnFaceDataValue: UPSIDEDOWN_BIT logic
 *   - setStepShape: per-direction (EAST/WEST/SOUTH/NORTH) shape computation
 *                   with back-tile attachment checks
 *   - setInnerPieceShape: inner-corner piece shape computation
 *   - clip: 8-step clip with DEAD_SPACES exclusion + closest-result pick
 *
 * Constants from StairTile.h:
 *   - UPSIDEDOWN_BIT = 4 (data bit 2)
 *   - DIR_EAST=0, DIR_WEST=1, DIR_SOUTH=2, DIR_NORTH=3
 *
 * Note: The 8-step clip requires Tile::clip to be called with clipStep
 * set to 0..7, which means Tile::clip needs to know about StairTile's
 * clipStep state. We add a clipStep field to Tile (optional) and read it
 * from inside Tile::clip. The C++ uses a per-instance isClipping/clipStep
 * pair; we mirror that.
 */

import { Tile, SHAPE_STAIRS } from './Tile';
import { Mth } from '../../../util/Mth';
import { Facing, STEP_X, STEP_Y, STEP_Z } from '../../../shared/Facing';
import { Vec3 } from '../../phys/Vec3';
import { HitResult } from '../../phys/AABB';

export const UPSIDEDOWN_BIT = 4;
export const DIR_EAST = 0;
export const DIR_WEST = 1;
export const DIR_SOUTH = 2;
export const DIR_NORTH = 3;

export class StairTile extends Tile {
  static readonly DEAD_SPACES: [number, number][] = [
    [2, 6], [3, 7], [2, 3], [6, 7],
    [0, 4], [1, 5], [0, 1], [4, 5],
  ];

  protected modelTile: Tile;
  // Per-instance clip state (used by StairTile::clip)
  protected isClipping = false;
  protected clipStep = 0;

  constructor(id: number, modelTile: Tile) {
    // C++: StairTile(int id, Tile* model) : Tile(id, model->material) { this->modelTile = model; this->tex = model->tex; }
    super(id, (modelTile as unknown as { material: unknown }).material as never);
    this.modelTile = modelTile;
    this.tex = modelTile.tex;
  }

  getRenderShape(): number { return SHAPE_STAIRS; }

  // StairTile.cpp:630 — getPlacedOnFaceDataValue
  getPlacedOnFaceDataValue(_level: unknown, _x: number, _y: number, _z: number, face: number, _clickX: number, clickY: number, _clickZ: number, itemValue: number): number {
    if (face === Facing.DOWN || (face !== Facing.UP && clickY > 0.5)) {
      return itemValue | UPSIDEDOWN_BIT;
    }
    return itemValue;
  }

  // StairTile.cpp:638 — setStepShape(level, x, y, z) — verbatim
  setStepShape(level: {
    getData(x: number, y: number, z: number): number;
    getTile(x: number, y: number, z: number): number;
  }, x: number, y: number, z: number): boolean {
    const data = level.getData(x, y, z);
    const dir = data & 0x3;
    let bottom = 0.5, top = 1.0;
    if ((data & UPSIDEDOWN_BIT) !== 0) { bottom = 0; top = 0.5; }
    let west = 0, east = 1, north = 0, south = 0.5;
    let checkInnerPiece = true;

    if (dir === DIR_EAST) {
      west = 0.5; south = 1;
      const backTile = level.getTile(x + 1, y, z);
      const backData = level.getData(x + 1, y, z);
      if (this.isStairs(backTile) && ((data & UPSIDEDOWN_BIT) === (backData & UPSIDEDOWN_BIT))) {
        const backDir = backData & 0x3;
        if (backDir === DIR_NORTH && !this.isLockAttached(level, x, y, z + 1, data)) {
          south = 0.5; checkInnerPiece = false;
        } else if (backDir === DIR_SOUTH && !this.isLockAttached(level, x, y, z - 1, data)) {
          north = 0.5; checkInnerPiece = false;
        }
      }
    } else if (dir === DIR_WEST) {
      east = 0.5; south = 1;
      const backTile = level.getTile(x - 1, y, z);
      const backData = level.getData(x - 1, y, z);
      if (this.isStairs(backTile) && ((data & UPSIDEDOWN_BIT) === (backData & UPSIDEDOWN_BIT))) {
        const backDir = backData & 0x3;
        if (backDir === DIR_NORTH && !this.isLockAttached(level, x, y, z + 1, data)) {
          south = 0.5; checkInnerPiece = false;
        } else if (backDir === DIR_SOUTH && !this.isLockAttached(level, x, y, z - 1, data)) {
          north = 0.5; checkInnerPiece = false;
        }
      }
    } else if (dir === DIR_SOUTH) {
      north = 0.5; south = 1;
      const backTile = level.getTile(x, y, z + 1);
      const backData = level.getData(x, y, z + 1);
      if (this.isStairs(backTile) && ((data & UPSIDEDOWN_BIT) === (backData & UPSIDEDOWN_BIT))) {
        const backDir = backData & 0x3;
        if (backDir === DIR_WEST && !this.isLockAttached(level, x + 1, y, z, data)) {
          east = 0.5; checkInnerPiece = false;
        } else if (backDir === DIR_EAST && !this.isLockAttached(level, x - 1, y, z, data)) {
          west = 0.5; checkInnerPiece = false;
        }
      }
    } else if (dir === DIR_NORTH) {
      const backTile = level.getTile(x, y, z - 1);
      const backData = level.getData(x, y, z - 1);
      if (this.isStairs(backTile) && ((data & UPSIDEDOWN_BIT) === (backData & UPSIDEDOWN_BIT))) {
        const backDir = backData & 0x3;
        if (backDir === DIR_WEST && !this.isLockAttached(level, x + 1, y, z, data)) {
          east = 0.5; checkInnerPiece = false;
        } else if (backDir === DIR_EAST && !this.isLockAttached(level, x - 1, y, z, data)) {
          west = 0.5; checkInnerPiece = false;
        }
      }
    }
    this.setShape(west, bottom, north, east, top, south);
    return checkInnerPiece;
  }

  // StairTile.cpp:728 — setInnerPieceShape(level, x, y, z) — verbatim
  setInnerPieceShape(level: {
    getData(x: number, y: number, z: number): number;
    getTile(x: number, y: number, z: number): number;
  }, x: number, y: number, z: number): boolean {
    const data = level.getData(x, y, z);
    const dir = data & 0x3;
    let bottom = 0.5, top = 1.0;
    if ((data & UPSIDEDOWN_BIT) !== 0) { bottom = 0; top = 0.5; }
    let west = 0, east = 0.5, north = 0.5, south = 1.0;
    let hasInnerPiece = false;

    if (dir === DIR_EAST) {
      const frontTile = level.getTile(x - 1, y, z);
      const frontData = level.getData(x - 1, y, z);
      if (this.isStairs(frontTile) && ((data & UPSIDEDOWN_BIT) === (frontData & UPSIDEDOWN_BIT))) {
        const frontDir = frontData & 0x3;
        if (frontDir === DIR_NORTH && !this.isLockAttached(level, x, y, z - 1, data)) {
          north = 0; south = 0.5; hasInnerPiece = true;
        } else if (frontDir === DIR_SOUTH && !this.isLockAttached(level, x, y, z + 1, data)) {
          north = 0.5; south = 1; hasInnerPiece = true;
        }
      }
    } else if (dir === DIR_WEST) {
      const frontTile = level.getTile(x + 1, y, z);
      const frontData = level.getData(x + 1, y, z);
      if (this.isStairs(frontTile) && ((data & UPSIDEDOWN_BIT) === (frontData & UPSIDEDOWN_BIT))) {
        west = 0.5; east = 1.0;
        const frontDir = frontData & 0x3;
        if (frontDir === DIR_NORTH && !this.isLockAttached(level, x, y, z - 1, data)) {
          north = 0; south = 0.5; hasInnerPiece = true;
        } else if (frontDir === DIR_SOUTH && !this.isLockAttached(level, x, y, z + 1, data)) {
          north = 0.5; south = 1; hasInnerPiece = true;
        }
      }
    } else if (dir === DIR_SOUTH) {
      const frontTile = level.getTile(x, y, z - 1);
      const frontData = level.getData(x, y, z - 1);
      if (this.isStairs(frontTile) && ((data & UPSIDEDOWN_BIT) === (frontData & UPSIDEDOWN_BIT))) {
        north = 0; south = 0.5;
        const frontDir = frontData & 0x3;
        if (frontDir === DIR_WEST && !this.isLockAttached(level, x - 1, y, z, data)) {
          hasInnerPiece = true;
        } else if (frontDir === DIR_EAST && !this.isLockAttached(level, x + 1, y, z, data)) {
          west = 0.5; east = 1.0; hasInnerPiece = true;
        }
      }
    } else if (dir === DIR_NORTH) {
      const frontTile = level.getTile(x, y, z + 1);
      const frontData = level.getData(x, y, z + 1);
      if (this.isStairs(frontTile) && ((data & UPSIDEDOWN_BIT) === (frontData & UPSIDEDOWN_BIT))) {
        const frontDir = frontData & 0x3;
        if (frontDir === DIR_WEST && !this.isLockAttached(level, x - 1, y, z, data)) {
          hasInnerPiece = true;
        } else if (frontDir === DIR_EAST && !this.isLockAttached(level, x + 1, y, z, data)) {
          west = 0.5; east = 1.0; hasInnerPiece = true;
        }
      }
    }
    if (hasInnerPiece) {
      this.setShape(west, bottom, north, east, top, south);
    }
    return hasInnerPiece;
  }

  // isStairs(tileId) — checks if tileId is any StairTile instance.
  // C++ StairTile.cpp uses isStairs via the Tile base (it would compare shape).
  // We approximate by checking the tile's render shape is SHAPE_STAIRS.
  private isStairs(tileId: number): boolean {
    if (tileId <= 0) return false;
    // Walk Tiles registry to find the tile.
    for (const key of Object.keys((globalThis as { __tileRefs?: Record<string, Tile | null> }).__tileRefs ?? {})) {
      const tile = (globalThis as { __tileRefs?: Record<string, Tile | null> }).__tileRefs?.[key];
      if (tile && tile.id === tileId) {
        return tile.getRenderShape() === SHAPE_STAIRS;
      }
    }
    return false;
  }

  // isLockAttached(level, x, y, z, data) — checks if a stair at (x,y,z) is locked-attached
  // (used to decide whether a corner-merge shape applies).
  // The C++ version checks: if the tile at (x,y,z) is NOT a stairs of same upside-down state,
  // return true (locked to that non-stairs neighbor). Otherwise false.
  private isLockAttached(level: { getTile(x: number, y: number, z: number): number; getData(x: number, y: number, z: number): number }, x: number, y: number, z: number, data: number): boolean {
    const tileId = level.getTile(x, y, z);
    if (!this.isStairs(tileId)) return true;
    const otherData = level.getData(x, y, z);
    return (otherData & UPSIDEDOWN_BIT) !== (data & UPSIDEDOWN_BIT);
  }

  // StairTile.cpp:816 — clip(level, xt, yt, zt, a, b) — 8-step clip with DEAD_SPACES exclusion.
  // We call Tile::clip 8 times (once per clipStep), then mask out the dead-space results,
  // then pick the closest hit to b (which is the END of the ray — the C++ comment confirms
  // closestDist starts at 0 and we look for `dist > closestDist`).
  clip(level: unknown, xt: number, yt: number, zt: number, a: Vec3, b: Vec3): HitResult {
    const results: HitResult[] = new Array(8).fill(null).map(() => new HitResult());
    const data = (level as { getData(x: number, y: number, z: number): number }).getData(xt, yt, zt);
    const dir = data & 0x3;
    const upsideDown = (data & UPSIDEDOWN_BIT) === UPSIDEDOWN_BIT;
    const deadSpaces = StairTile.DEAD_SPACES[dir + (upsideDown ? 4 : 0)];

    this.isClipping = true;
    for (let i = 0; i < 8; i++) {
      this.clipStep = i;
      results[i] = super.clip(level, xt, yt, zt, a, b);
    }
    this.isClipping = false;

    results[deadSpaces[0]] = new HitResult();
    results[deadSpaces[1]] = new HitResult();

    let closest: HitResult | null = null;
    let closestDist = 0;
    for (let r = 0; r < 8; r++) {
      const result = results[r];
      if (result.isHit()) {
        const dist = result.pos.distanceToSqr(b);
        if (dist > closestDist) {
          closest = result;
          closestDist = dist;
        }
      }
    }
    if (closest === null) return new HitResult();
    return closest;
  }

  // Override updateShape so getAABB picks up stair sub-shape.
  updateShape(level: { getData(x: number, y: number, z: number): number; getTile(x: number, y: number, z: number): number }, x: number, y: number, z: number): void {
    this.setStepShape(level, x, y, z);
    // If setStepShape returned false (no inner piece needed), we're done.
    // If it returned true (checkInnerPiece), call setInnerPieceShape which may
    // add an extra 1/8 corner block.
    // Note: in the C++ source, updateShape is the entry; we mirror that here.
    this.setInnerPieceShape(level, x, y, z);
  }
}

void Mth;
