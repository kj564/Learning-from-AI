/**
 * Translation of: EntityPos.h
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/entity/EntityPos.h
 *
 * EntityPos is a small value type holding an entity-position snapshot plus
 * flags saying which parts (position/rotation) should be applied.
 */

export class EntityPos {
  x: number;
  y: number;
  z: number;
  yRot: number;
  xRot: number;
  rot: boolean;
  move: boolean;

  constructor(x: number, y: number, z: number, yRot?: number, xRot?: number) {
    this.rot = false;
    this.move = false;
    this.x = x;
    this.y = y;
    this.z = z;
    if (yRot !== undefined && xRot !== undefined) {
      this.yRot = yRot;
      this.xRot = xRot;
      this.rot = true;
      this.move = true;
    } else {
      this.yRot = 0;
      this.xRot = 0;
      this.move = true;
    }
  }
}

// Alternate constructors: EntityPos(x,y,z) and EntityPos(yRot, xRot) (no pos).
// We model the second one as a static factory since TS can't have C++'s
// overload-by-arity on a single constructor cleanly.
export function EntityPosRot(yRot: number, xRot: number): EntityPos {
  const p = new EntityPos(0, 0, 0, yRot, xRot);
  p.move = false;
  p.rot = true;
  return p;
}
