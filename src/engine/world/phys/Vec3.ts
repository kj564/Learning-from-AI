/**
 * Translation of: Vec3.h
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/phys/Vec3.h
 *
 * Line-by-line faithful. C++ pass-by-ref `clipX(b, t, &out)` becomes a
 * TS return type `[hit: boolean, out: Vec3]` to keep the const-ish shape —
 * there is no reason to mutate via pointer in TS.
 */

export class Vec3 {
  x = 0;
  y = 0;
  z = 0;

  constructor(x = 0, y = 0, z = 0) {
    if (x === -0) x = 0;
    if (y === -0) y = 0;
    if (z === -0) z = 0;
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x: number, y: number, z: number): this {
    this.x = x; this.y = y; this.z = z;
    return this;
  }

  add(rhs: Vec3): Vec3 {
    return new Vec3(this.x + rhs.x, this.y + rhs.y, this.z + rhs.z);
  }

  add3(x: number, y: number, z: number): Vec3 {
    return new Vec3(this.x + x, this.y + y, this.z + z);
  }

  addSelf(x: number, y: number, z: number): this {
    this.x += x; this.y += y; this.z += z;
    return this;
  }

  sub(rhs: Vec3): Vec3 {
    return new Vec3(this.x - rhs.x, this.y - rhs.y, this.z - rhs.z);
  }

  sub3(x: number, y: number, z: number): Vec3 {
    return new Vec3(this.x - x, this.y - y, this.z - z);
  }

  subSelf(x: number, y: number, z: number): this {
    this.x -= x; this.y -= y; this.z -= z;
    return this;
  }

  mul(k: number): Vec3 {
    return new Vec3(this.x * k, this.y * k, this.z * k);
  }

  normalized(): Vec3 {
    const dist = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    if (dist < 0.0001) return new Vec3();
    return new Vec3(this.x / dist, this.y / dist, this.z / dist);
  }

  dot(p: Vec3): number {
    return this.x * p.x + this.y * p.y + this.z * p.z;
  }

  cross(p: Vec3): Vec3 {
    return new Vec3(
      this.y * p.z - this.z * p.y,
      this.z * p.x - this.x * p.z,
      this.x * p.y - this.y * p.x,
    );
  }

  negate(): void {
    this.x = -this.x; this.y = -this.y; this.z = -this.z;
  }

  negated(): Vec3 {
    return new Vec3(-this.x, -this.y, -this.z);
  }

  distanceTo(p: Vec3): number {
    const xd = p.x - this.x, yd = p.y - this.y, zd = p.z - this.z;
    return Math.sqrt(xd * xd + yd * yd + zd * zd);
  }

  distanceToSqr(p: Vec3): number {
    const xd = p.x - this.x, yd = p.y - this.y, zd = p.z - this.z;
    return xd * xd + yd * yd + zd * zd;
  }

  distanceToSqr3(x2: number, y2: number, z2: number): number {
    const xd = x2 - this.x, yd = y2 - this.y, zd = z2 - this.z;
    return xd * xd + yd * yd + zd * zd;
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  // bool clipX(const Vec3& b, float xt, Vec3& result) const
  clipX(b: Vec3, xt: number): [boolean, Vec3] {
    const xd = b.x - this.x, yd = b.y - this.y, zd = b.z - this.z;
    if (xd * xd < 0.0000001) return [false, new Vec3()];
    const d = (xt - this.x) / xd;
    if (d < 0 || d > 1) return [false, new Vec3()];
    return [true, new Vec3(this.x + xd * d, this.y + yd * d, this.z + zd * d)];
  }

  clipY(b: Vec3, yt: number): [boolean, Vec3] {
    const xd = b.x - this.x, yd = b.y - this.y, zd = b.z - this.z;
    if (yd * yd < 0.0000001) return [false, new Vec3()];
    const d = (yt - this.y) / yd;
    if (d < 0 || d > 1) return [false, new Vec3()];
    return [true, new Vec3(this.x + xd * d, this.y + yd * d, this.z + zd * d)];
  }

  clipZ(b: Vec3, zt: number): [boolean, Vec3] {
    const xd = b.x - this.x, yd = b.y - this.y, zd = b.z - this.z;
    if (zd * zd < 0.0000001) return [false, new Vec3()];
    const d = (zt - this.z) / zd;
    if (d < 0 || d > 1) return [false, new Vec3()];
    return [true, new Vec3(this.x + xd * d, this.y + yd * d, this.z + zd * d)];
  }

  lerp(v: Vec3, a: number): Vec3 {
    return new Vec3(
      this.x + (v.x - this.x) * a,
      this.y + (v.y - this.y) * a,
      this.z + (v.z - this.z) * a,
    );
  }

  xRot(degs: number): void {
    const cosv = Math.cos(degs), sinv = Math.sin(degs);
    const xx = this.x;
    const yy = this.y * cosv + this.z * sinv;
    const zz = this.z * cosv - this.y * sinv;
    this.x = xx; this.y = yy; this.z = zz;
  }

  yRot(degs: number): void {
    const cosv = Math.cos(degs), sinv = Math.sin(degs);
    const xx = this.x * cosv + this.z * sinv;
    const yy = this.y;
    const zz = this.z * cosv - this.x * sinv;
    this.x = xx; this.y = yy; this.z = zz;
  }

  zRot(degs: number): void {
    const cosv = Math.cos(degs), sinv = Math.sin(degs);
    const xx = this.x * cosv + this.y * sinv;
    const yy = this.y * cosv - this.x * sinv;
    const zz = this.z;
    this.x = xx; this.y = yy; this.z = zz;
  }

  static fromPolarXY(angle: number, radius: number): Vec3 {
    return new Vec3(radius * Math.cos(angle), radius * Math.sin(angle), 0);
  }
}
