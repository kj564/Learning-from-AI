/**
 * Translation of: AABB.h
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/phys/AABB.h
 *
 * The C++ class uses a "fixed set then return *this" pattern for move().
 * We translate each method body as-is; TS returns the new AABB or this for
 * chaining where the original does the same.
 *
 * Vec3 clip-into-AABB helpers translate Vec3.clipX/Y/Z returning a [bool, Vec3]
 * tuple (see Vec3.ts). The original uses a Vec3* out-param; we use a tuple.
 */

import { Vec3 } from './Vec3';

export class HitResult {
  type: 'TILE' | 'ENTITY' | 'NO_HIT' = 'NO_HIT';
  x = 0; y = 0; z = 0; f = -1;
  pos: Vec3 = new Vec3();
  entity: unknown = null;
  indirectHit = false;

  isHit(): boolean { return this.type !== 'NO_HIT'; }

  static tile(x: number, y: number, z: number, f: number, pos: Vec3): HitResult {
    const h = new HitResult();
    h.type = 'TILE';
    h.x = x; h.y = y; h.z = z; h.f = f; h.pos = pos;
    return h;
  }
}

export class AABB {
  x0 = 0; y0 = 0; z0 = 0;
  x1 = 1; y1 = 1; z1 = 1;

  constructor(x0 = 0, y0 = 0, z0 = 0, x1 = 1, y1 = 1, z1 = 1) {
    this.x0 = x0; this.y0 = y0; this.z0 = z0;
    this.x1 = x1; this.y1 = y1; this.z1 = z1;
  }

  set(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): this {
    this.x0 = x0; this.y0 = y0; this.z0 = z0;
    this.x1 = x1; this.y1 = y1; this.z1 = z1;
    return this;
  }

  setFrom(b: AABB): void {
    this.x0 = b.x0; this.y0 = b.y0; this.z0 = b.z0;
    this.x1 = b.x1; this.y1 = b.y1; this.z1 = b.z1;
  }

  expand(xa: number, ya: number, za: number): AABB {
    let _x0 = this.x0, _y0 = this.y0, _z0 = this.z0;
    let _x1 = this.x1, _y1 = this.y1, _z1 = this.z1;
    if (xa < 0) _x0 += xa;
    if (xa > 0) _x1 += xa;
    if (ya < 0) _y0 += ya;
    if (ya > 0) _y1 += ya;
    if (za < 0) _z0 += za;
    if (za > 0) _z1 += za;
    return new AABB(_x0, _y0, _z0, _x1, _y1, _z1);
  }

  grow(xa: number, ya: number, za: number): AABB {
    return new AABB(this.x0 - xa, this.y0 - ya, this.z0 - za, this.x1 + xa, this.y1 + ya, this.z1 + za);
  }

  cloneMove(xa: number, ya: number, za: number): AABB {
    return new AABB(this.x0 + xa, this.y0 + ya, this.z0 + za, this.x1 + xa, this.y1 + ya, this.z1 + za);
  }

  clipXCollide(c: AABB, xa: number): number {
    if (c.y1 <= this.y0 || c.y0 >= this.y1) return xa;
    if (c.z1 <= this.z0 || c.z0 >= this.z1) return xa;
    if (xa > 0 && c.x1 <= this.x0) {
      const max = this.x0 - c.x1;
      if (max < xa) xa = max;
    }
    if (xa < 0 && c.x0 >= this.x1) {
      const max = this.x1 - c.x0;
      if (max > xa) xa = max;
    }
    return xa;
  }

  clipYCollide(c: AABB, ya: number): number {
    if (c.x1 <= this.x0 || c.x0 >= this.x1) return ya;
    if (c.z1 <= this.z0 || c.z0 >= this.z1) return ya;
    if (ya > 0 && c.y1 <= this.y0) {
      const max = this.y0 - c.y1;
      if (max < ya) ya = max;
    }
    if (ya < 0 && c.y0 >= this.y1) {
      const max = this.y1 - c.y0;
      if (max > ya) ya = max;
    }
    return ya;
  }

  clipZCollide(c: AABB, za: number): number {
    if (c.x1 <= this.x0 || c.x0 >= this.x1) return za;
    if (c.y1 <= this.y0 || c.y0 >= this.y1) return za;
    if (za > 0 && c.z1 <= this.z0) {
      const max = this.z0 - c.z1;
      if (max < za) za = max;
    }
    if (za < 0 && c.z0 >= this.z1) {
      const max = this.z1 - c.z0;
      if (max > za) za = max;
    }
    return za;
  }

  intersects(c: AABB): boolean {
    if (c.x1 <= this.x0 || c.x0 >= this.x1) return false;
    if (c.y1 <= this.y0 || c.y0 >= this.y1) return false;
    if (c.z1 <= this.z0 || c.z0 >= this.z1) return false;
    return true;
  }

  intersectsInner(c: AABB): boolean {
    if (c.x1 < this.x0 || c.x0 > this.x1) return false;
    if (c.y1 < this.y0 || c.y0 > this.y1) return false;
    if (c.z1 < this.z0 || c.z0 > this.z1) return false;
    return true;
  }

  move(xa: number, ya: number, za: number): this {
    this.x0 += xa; this.y0 += ya; this.z0 += za;
    this.x1 += xa; this.y1 += ya; this.z1 += za;
    return this;
  }

  intersects6(x02: number, y02: number, z02: number, x12: number, y12: number, z12: number): boolean {
    if (x12 <= this.x0 || x02 >= this.x1) return false;
    if (y12 <= this.y0 || y02 >= this.y1) return false;
    if (z12 <= this.z0 || z02 >= this.z1) return false;
    return true;
  }

  contains(p: Vec3): boolean {
    if (p.x <= this.x0 || p.x >= this.x1) return false;
    if (p.y <= this.y0 || p.y >= this.y1) return false;
    if (p.z <= this.z0 || p.z >= this.z1) return false;
    return true;
  }

  getSize(): number {
    const xs = this.x1 - this.x0;
    const ys = this.y1 - this.y0;
    const zs = this.z1 - this.z0;
    return (xs + ys + zs) / 3.0;
  }

  shrink(xa: number, ya: number, za: number): AABB {
    return new AABB(this.x0 + xa, this.y0 + ya, this.z0 + za, this.x1 - xa, this.y1 - ya, this.z1 - za);
  }

  copy(): AABB {
    return new AABB(this.x0, this.y0, this.z0, this.x1, this.y1, this.z1);
  }

  // AABB::clip(a, b) returns the closest face-intersection of segment a→b
  // with this box. Faithful translation.
  clip(a: Vec3, b: Vec3): HitResult {
    let xh0 = new Vec3(), xh1 = new Vec3();
    let yh0 = new Vec3(), yh1 = new Vec3();
    let zh0 = new Vec3(), zh1 = new Vec3();

    let bxh0 = a.clipX(b, this.x0, xh0); let [bxh0Hit, bxh0V] = bxh0; xh0 = bxh0V;
    let bxh1 = a.clipX(b, this.x1, xh1); let [bxh1Hit, bxh1V] = bxh1; xh1 = bxh1V;
    let byh0 = a.clipY(b, this.y0, yh0); let [byh0Hit, byh0V] = byh0; yh0 = byh0V;
    let byh1 = a.clipY(b, this.y1, yh1); let [byh1Hit, byh1V] = byh1; yh1 = byh1V;
    let bzh0 = a.clipZ(b, this.z0, zh0); let [bzh0Hit, bzh0V] = bzh0; zh0 = bzh0V;
    let bzh1 = a.clipZ(b, this.z1, zh1); let [bzh1Hit, bzh1V] = bzh1; zh1 = bzh1V;

    if (!bxh0Hit || !this.containsX(xh0)) bxh0Hit = false;
    if (!bxh1Hit || !this.containsX(xh1)) bxh1Hit = false;
    if (!byh0Hit || !this.containsY(yh0)) byh0Hit = false;
    if (!byh1Hit || !this.containsY(yh1)) byh1Hit = false;
    if (!bzh0Hit || !this.containsZ(zh0)) bzh0Hit = false;
    if (!bzh1Hit || !this.containsZ(zh1)) bzh1Hit = false;

    let closest: Vec3 | null = null;
    if (bxh0Hit && (closest === null || a.distanceToSqr(xh0) < a.distanceToSqr(closest))) closest = xh0;
    if (bxh1Hit && (closest === null || a.distanceToSqr(xh1) < a.distanceToSqr(closest))) closest = xh1;
    if (byh0Hit && (closest === null || a.distanceToSqr(yh0) < a.distanceToSqr(closest))) closest = yh0;
    if (byh1Hit && (closest === null || a.distanceToSqr(yh1) < a.distanceToSqr(closest))) closest = yh1;
    if (bzh0Hit && (closest === null || a.distanceToSqr(zh0) < a.distanceToSqr(closest))) closest = zh0;
    if (bzh1Hit && (closest === null || a.distanceToSqr(zh1) < a.distanceToSqr(closest))) closest = zh1;

    if (closest === null) return new HitResult();

    let face = -1;
    if (closest === xh0) face = 4;
    if (closest === xh1) face = 5;
    if (closest === yh0) face = 0;
    if (closest === yh1) face = 1;
    if (closest === zh0) face = 2;
    if (closest === zh1) face = 3;

    return HitResult.tile(0, 0, 0, face, closest);
  }

  private containsX(v: Vec3): boolean {
    return v.y >= this.y0 && v.y <= this.y1 && v.z >= this.z0 && v.z <= this.z1;
  }
  private containsY(v: Vec3): boolean {
    return v.x >= this.x0 && v.x <= this.x1 && v.z >= this.z0 && v.z <= this.z1;
  }
  private containsZ(v: Vec3): boolean {
    return v.x >= this.x0 && v.x <= this.x1 && v.y >= this.y0 && v.y <= this.y1;
  }
}
