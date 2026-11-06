/**
 * Translation of: world/entity/Entity.h + Entity.cpp
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/entity/Entity.{h,cpp}
 *
 * This is the base Entity class — every mob, item, projectile, painting,
 * player inherits from it. The class is ~1000 lines combined; the methods
 * here are translated body-for-body. The hot ones — move(), baseTick(),
 * setPos() — are especially faithful because they're called every tick by
 * every entity.
 *
 * Notable dependencies that aren't translated yet:
 *   - Level: only the small interface we need (getCubes, getTile, etc.) is
 *     declared here. Level.cpp is 66 KB — separate file.
 *   - Tile: already translated (Tile.ts in world/level/tile).
 *   - CompoundTag (NBT save/load): deferred until NBT port.
 *   - ItemEntity: deferred until item port. spawnAtLocation stubs.
 *   - SoundEngine (level->playSound): stubbed.
 */

import { AABB } from '../phys/AABB';
import { Vec3 } from '../phys/Vec3';
import { Mth } from '../../util/Mth';
import { Random } from '../../util/Random';
import { EntityRendererId as ER } from './EntityRendererId';
import { TicksPerSecond } from '../../shared/SharedConstants';
import { LEVEL_WIDTH, LEVEL_DEPTH } from '../level/LevelConstants';
import { Tiles } from '../level/tile/Tiles';
import { tiles as Tile_tiles } from '../level/tile/Tile';

// Minimal Level interface we depend on. The full Level.cpp will fill this in
// when we translate it.
export interface EntityLevel {
  isClientSide: boolean;
  getCubes(e: Entity | null, aabb: AABB): AABB[];
  containsAnyLiquid(aabb: AABB): boolean;
  containsMaterial(aabb: AABB, material: unknown): boolean;
  checkAndHandleWater(aabb: AABB, material: unknown, e: Entity): boolean;
  isSolidBlockingTile(x: number, y: number, z: number): boolean;
  getTile(x: number, y: number, z: number): number;
  getData(x: number, y: number, z: number): number;
  getMaterial(x: number, y: number, z: number): unknown;
  hasChunksAt(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): boolean;
  getBrightness(x: number, y: number, z: number): number;
  containsFireTile(aabb: AABB): boolean;
  playSound(e: Entity | null, name: string, volume: number, pitch: number): void;
  addParticle(type: string, x: number, y: number, z: number, xd: number, yd: number, zd: number): void;
}

export abstract class Entity {
  static entityCounter = 0;
  static readonly TOTAL_AIR_SUPPLY = 15 * TicksPerSecond;

  // === Public fields (Entity.h:38-72) ===
  x = 0; y = 0; z = 0;
  xChunk = 0; yChunk = 0; zChunk = 0;
  entityId = 0;
  viewScale = 1.0;
  level: EntityLevel | null;
  xo = 0; yo = 0; zo = 0;
  xd = 0; yd = 0; zd = 0;
  yRot = 0; xRot = 0;
  yRotO = 0; xRotO = 0;
  bb: AABB = new AABB(0, 0, 0, 0, 0, 0);
  heightOffset = 0;
  bbWidth = 0.6;
  bbHeight = 1.8;
  walkDistO = 0;
  walkDist = 0;
  xOld = 0; yOld = 0; zOld = 0;
  ySlideOffset = 0;
  footSize = 0;
  pushthrough = 0;
  tickCount = 0;
  invulnerableTime = 0;
  airSupply = Entity.TOTAL_AIR_SUPPLY;
  onFire = 0;
  flameTime = 1;
  entityRendererId = ER.ER_DEFAULT_RENDERER;
  fallDistance = 0;
  blocksBuilding = false;
  inChunk = false;
  onGround = false;
  horizontalCollision = false;
  verticalCollision = false;
  collision = false;
  hurtMarked = false;
  slide = true;
  removed = false;
  noPhysics = false;
  canRemove = true;
  invisible = false;
  reallyRemoveIfPlayer = false;

  // === Protected fields ===
  protected static sharedRandom: Random = new Random(0);
  protected airCapacity = Entity.TOTAL_AIR_SUPPLY;
  protected makeStepSound = true;
  protected wasInWater = false;
  protected fireImmune = false;
  protected firstTick = true;
  protected nextStep = 1;
  protected isStuckInWeb = false;
  protected static readonly DATA_AIR_SUPPLY_ID = 1;

  constructor(level: EntityLevel | null) {
    this.level = level;
    this._init();
    this.entityId = ++Entity.entityCounter;
    this.setPos(0, 0, 0);
  }

  _init(): void {
    this.xo = this.xOld = this.x;
    this.yo = this.yOld = this.y;
    this.zo = this.zOld = this.z;
    this.xRotO = this.xRot;
    this.yRotO = this.yRot;
    this.onFire = 0;
    this.removed = false;
    this.fallDistance = 0;
  }

  reset(): void { this._init(); }

  hashCode(): number { return this.entityId; }
  equals(rhs: Entity): boolean { return this.entityId === rhs.entityId; }

  setLevel(level: EntityLevel): void { this.level = level; }

  remove(): void { this.removed = true; }

  setPos(x: number, y: number, z: number): void {
    this.x = x; this.y = y; this.z = z;
    const w = this.bbWidth / 2;
    const h = this.bbHeight;
    // From Entity.cpp setPos: bb.set(x-w, y-heightOffset+ySlideOffset, z-w, x+w, y-heightOffset+ySlideOffset+h, z+w)
    this.bb.set(
      x - w, y - this.heightOffset + this.ySlideOffset, z - w,
      x + w, y - this.heightOffset + this.ySlideOffset + h, z + w,
    );
  }

  // === move(xa, ya, za) — verbatim from Entity.cpp::move ===
  move(xa: number, ya: number, za: number): void {
    if (this.noPhysics) {
      this.bb.move(xa, ya, za);
      this.x = (this.bb.x0 + this.bb.x1) / 2.0;
      this.y = this.bb.y0 + this.heightOffset - this.ySlideOffset;
      this.z = (this.bb.z0 + this.bb.z1) / 2.0;
      return;
    }

    const xo = this.x;
    const zo = this.z;

    if (this.isStuckInWeb) {
      this.isStuckInWeb = false;
      xa *= 0.25;
      ya *= 0.05;
      za *= 0.25;
      this.xd = 0;
      this.yd = 0;
      this.zd = 0;
    }

    let xaOrg = xa;
    let yaOrg = ya;
    let zaOrg = za;
    const bbOrg = this.bb.copy();
    const sneaking = this.onGround && this.isSneaking();

    if (sneaking) {
      const d = 0.05;
      while (xa !== 0 && this.level!.getCubes(this, this.bb.cloneMove(xa, -1.0, 0)).length === 0) {
        if (xa < d && xa >= -d) xa = 0;
        else if (xa > 0) xa -= d;
        else xa += d;
        xaOrg = xa;
      }
      while (za !== 0 && this.level!.getCubes(this, this.bb.cloneMove(0, -1.0, za)).length === 0) {
        if (za < d && za >= -d) za = 0;
        else if (za > 0) za -= d;
        else za += d;
        zaOrg = za;
      }
      while (xa !== 0 && za !== 0 && this.level!.getCubes(this, this.bb.cloneMove(xa, -1.0, za)).length === 0) {
        if (xa < d && xa >= -d) xa = 0;
        else if (xa > 0) xa -= d;
        else xa += d;
        if (za < d && za >= -d) za = 0;
        else if (za > 0) za -= d;
        else za += d;
        xaOrg = xa;
        zaOrg = za;
      }
    }

    let aABBs = this.level!.getCubes(this, this.bb.expand(xa, ya, za));

    // LAND FIRST, then x and z
    for (let i = 0; i < aABBs.length; i++) ya = aABBs[i].clipYCollide(this.bb, ya);
    this.bb.move(0, ya, 0);
    if (!this.slide && yaOrg !== ya) { xa = ya = za = 0; }

    const og = this.onGround || (yaOrg !== ya && yaOrg < 0);

    for (let i = 0; i < aABBs.length; i++) xa = aABBs[i].clipXCollide(this.bb, xa);
    this.bb.move(xa, 0, 0);
    if (!this.slide && xaOrg !== xa) { xa = ya = za = 0; }

    for (let i = 0; i < aABBs.length; i++) za = aABBs[i].clipZCollide(this.bb, za);
    this.bb.move(0, 0, za);
    if (!this.slide && zaOrg !== za) { xa = ya = za = 0; }

    if (this.footSize > 0 && og && this.ySlideOffset < 0.05 && (xaOrg !== xa || zaOrg !== za)) {
      const xaN = xa, yaN = ya, zaN = za;
      xa = xaOrg; ya = this.footSize; za = zaOrg;
      const normal = this.bb.copy();
      this.bb.set(bbOrg);
      aABBs = this.level!.getCubes(this, this.bb.expand(xa, ya, za));

      for (let i = 0; i < aABBs.length; i++) ya = aABBs[i].clipYCollide(this.bb, ya);
      this.bb.move(0, ya, 0);
      if (!this.slide && yaOrg !== ya) { xa = ya = za = 0; }
      for (let i = 0; i < aABBs.length; i++) xa = aABBs[i].clipXCollide(this.bb, xa);
      this.bb.move(xa, 0, 0);
      if (!this.slide && xaOrg !== xa) { xa = ya = za = 0; }
      for (let i = 0; i < aABBs.length; i++) za = aABBs[i].clipZCollide(this.bb, za);
      this.bb.move(0, 0, za);
      if (!this.slide && zaOrg !== za) { xa = ya = za = 0; }

      if (xaN * xaN + zaN * zaN >= xa * xa + za * za) {
        xa = xaN; ya = yaN; za = zaN;
        this.bb.set(normal);
      } else {
        this.ySlideOffset += 0.5;
      }
    }

    this.x = (this.bb.x0 + this.bb.x1) / 2.0;
    this.y = this.bb.y0 + this.heightOffset - this.ySlideOffset;
    this.z = (this.bb.z0 + this.bb.z1) / 2.0;

    this.horizontalCollision = (xaOrg !== xa) || (zaOrg !== za);
    this.verticalCollision = (yaOrg !== ya);
    this.onGround = yaOrg !== ya && yaOrg < 0;
    this.collision = this.horizontalCollision || this.verticalCollision;
    this.checkFallDamage(ya, this.onGround);

    if (xaOrg !== xa) this.xd = 0;
    if (yaOrg !== ya) this.yd = 0;
    if (zaOrg !== za) this.zd = 0;

    const xm = this.x - xo;
    const zm = this.z - zo;
    if (this.makeStepSound && !sneaking) {
      this.walkDist += Math.sqrt(xm * xm + zm * zm) * 0.6;
      const xt = Mth.floor(this.x);
      const yt = Mth.floor(this.y - 0.2 - this.heightOffset);
      const zt = Mth.floor(this.z);
      let t = this.level!.getTile(xt, yt, zt);
      if (t === 0) {
        const under = this.level!.getTile(xt, yt - 1, zt);
        if (Tiles.fence && under === Tiles.fence.id || Tiles.fenceGate && under === Tiles.fenceGate.id) {
          t = under;
        }
      }
      if (this.walkDist > this.nextStep && t > 0) {
        this.nextStep = (this.walkDist | 0) + 1;
        this.playStepSound(xt, yt, zt, t);
      }
    }

    const x0 = Mth.floor(this.bb.x0);
    const y0 = Mth.floor(this.bb.y0);
    const z0 = Mth.floor(this.bb.z0);
    const x1 = Mth.floor(this.bb.x1);
    const y1 = Mth.floor(this.bb.y1);
    const z1 = Mth.floor(this.bb.z1);
    if (this.level!.hasChunksAt(x0, y0, z0, x1, y1, z1)) {
      for (let x = x0; x <= x1; x++)
        for (let y = y0; y <= y1; y++)
          for (let z = z0; z <= z1; z++) {
            const t = this.level!.getTile(x, y, z);
            if (t > 0) {
              const tile = Tile_tiles[t];
              tile?.entityInside(this.level as never, x, y, z, this);
            }
          }
    }

    this.ySlideOffset *= 0.4;

    const water = this.isInWater();
    if (this.level!.containsFireTile(this.bb)) {
      this.burn(1);
      if (!water) {
        this.onFire++;
        if (this.onFire === 0) this.onFire = 20 * 15;
      }
    } else {
      if (this.onFire <= 0) this.onFire = -this.flameTime;
    }

    if (water && this.onFire > 0) {
      this.onFire = -this.flameTime;
    }
  }

  moveTo(x: number, y: number, z: number, yRot: number, xRot: number): void {
    this.xOld = this.xo = this.x = x;
    this.yOld = this.yo = this.y = y + this.heightOffset;
    this.zOld = this.zo = this.z = z;
    this.yRot = this.yRotO = yRot;
    this.xRot = this.xRotO = xRot;
    this.setPos(this.x, this.y, this.z);
  }

  moveRelative(xa: number, za: number, speed: number): void {
    let dist = Math.sqrt(xa * xa + za * za);
    if (dist < 0.01) return;
    if (dist < 1) dist = 1;
    dist = speed / dist;
    xa *= dist;
    za *= dist;
    const sin_ = Math.sin(this.yRot * Mth.PI / 180);
    const cos_ = Math.cos(this.yRot * Mth.PI / 180);
    this.xd += xa * cos_ - za * sin_;
    this.zd += za * cos_ + xa * sin_;
  }

  lerpTo(x: number, y: number, z: number, yRot: number, xRot: number, _steps: number): void {
    this.setPos(x, y, z);
    this.setRot(yRot, xRot);
  }

  lerpMotion(xd: number, yd: number, zd: number): void {
    this.xd = xd; this.yd = yd; this.zd = zd;
  }

  turn(xo: number, yo: number): void {
    const xRotOld = this.xRot;
    const yRotOld = this.yRot;
    this.yRot += xo * 0.15;
    this.xRot -= yo * 0.15;
    if (this.xRot < -90) this.xRot = -90;
    if (this.xRot > 90) this.xRot = 90;
    this.xRotO += this.xRot - xRotOld;
    this.yRotO += this.yRot - yRotOld;
  }

  interpolateTurn(xo: number, yo: number): void {
    this.yRot += xo * 0.15;
    this.xRot -= yo * 0.15;
    if (this.xRot < -90) this.xRot = -90;
    if (this.xRot > 90) this.xRot = 90;
  }

  tick(): void { this.baseTick(); }

  baseTick(): void {
    this.tickCount++;
    this.walkDistO = this.walkDist;
    this.xo = this.x;
    this.yo = this.y;
    this.zo = this.z;
    this.xRotO = this.xRot;
    this.yRotO = this.yRot;

    if (this.isInWater()) {
      if (!this.wasInWater && !this.firstTick) {
        const speed = Math.sqrt(this.xd * this.xd * 0.2 + this.yd * this.yd + this.zd * this.zd * 0.2) * 0.2;
        const speedClamped = speed > 1 ? 1 : speed;
        this.level!.playSound(this, 'random.splash', speedClamped, 1 + (Entity.sharedRandom.nextFloat() - Entity.sharedRandom.nextFloat()) * 0.4);
        const yt = Math.floor(this.bb.y0);
        for (let i = 0; i < 1 + this.bbWidth * 20; i++) {
          const xo = (Entity.sharedRandom.nextFloat() * 2 - 1) * this.bbWidth;
          const zo = (Entity.sharedRandom.nextFloat() * 2 - 1) * this.bbWidth;
          this.level!.addParticle('bubble', this.x + xo, yt + 1, this.z + zo, this.xd, this.yd - Entity.sharedRandom.nextFloat() * 0.2, this.zd);
        }
      }
      this.fallDistance = 0;
      this.wasInWater = true;
      this.onFire = 0;
    } else {
      this.wasInWater = false;
    }

    if (this.level!.isClientSide) {
      this.onFire = 0;
    } else {
      if (this.onFire > 0) {
        if (this.fireImmune) {
          this.onFire -= 4;
          if (this.onFire < 0) this.onFire = 0;
        } else {
          if (this.onFire % 20 === 0) this.hurt(null, 1);
          this.onFire--;
        }
      }
    }

    if (this.isInLava()) this.lavaHurt();
    if (this.y < -64) this.outOfWorld();

    this.firstTick = false;
  }

  outOfWorld(): void { this.remove(); }

  checkFallDamage(ya: number, onGround: boolean): void {
    if (onGround) {
      if (this.fallDistance > 0) {
        if (this.isMob()) {
          const xt = Mth.floor(this.x);
          const yt = Mth.floor(this.y - 0.2 - this.heightOffset);
          const zt = Mth.floor(this.z);
          let t = this.level!.getTile(xt, yt, zt);
          if (t === 0 && Tiles.fence && this.level!.getTile(xt, yt - 1, zt) === Tiles.fence.id) {
            t = this.level!.getTile(xt, yt - 1, zt);
          }
          if (t > 0) {
            const tile = Tile_tiles[t];
            tile?.fallOn?.(this.level as never, xt, yt, zt, this, this.fallDistance);
          }
        }
        this.causeFallDamage(this.fallDistance);
        this.fallDistance = 0;
      }
    } else {
      if (ya < 0) this.fallDistance -= ya;
    }
  }

  causeFallDamage(_fallDamage2: number): void {}

  getHeadHeight(): number { return 0; }
  getShadowHeightOffs(): number { return this.bbHeight / 2; }

  getBrightness(a: number): number {
    void a;
    const xTile = Mth.floor(this.x);
    const hh = (this.bb.y1 - this.bb.y0) * 0.66;
    const yTile = Mth.floor(this.y - this.heightOffset + hh);
    const zTile = Mth.floor(this.z);
    if (this.level!.hasChunksAt(
      Mth.floor(this.bb.x0), Mth.floor(this.bb.y0), Mth.floor(this.bb.z0),
      Mth.floor(this.bb.x1), Mth.floor(this.bb.y1), Mth.floor(this.bb.z1),
    )) {
      return this.level!.getBrightness(xTile, yTile, zTile);
    }
    return 0;
  }

  distanceTo(e: Entity): number {
    const xd = this.x - e.x;
    const yd = this.y - e.y;
    const zd = this.z - e.z;
    return Math.sqrt(xd * xd + yd * yd + zd * zd);
  }
  distanceTo3(x2: number, y2: number, z2: number): number {
    const xd = this.x - x2, yd = this.y - y2, zd = this.z - z2;
    return Math.sqrt(xd * xd + yd * yd + zd * zd);
  }
  distanceToSqr3(x2: number, y2: number, z2: number): number {
    const xd = this.x - x2, yd = this.y - y2, zd = this.z - z2;
    return xd * xd + yd * yd + zd * zd;
  }
  distanceToSqr(e: Entity): number {
    const xd = this.x - e.x, yd = this.y - e.y, zd = this.z - e.z;
    return xd * xd + yd * yd + zd * zd;
  }

  playerTouch(_player: Entity): void {}

  push(e: Entity): void {
    let xa = e.x - this.x;
    let za = e.z - this.z;
    const dd = Mth.absMax(xa, za);
    if (dd >= 0.01) {
      xa /= dd;
      za /= dd;
      let pow = 1 / dd;
      if (pow > 1) pow = 1;
      xa *= pow; za *= pow;
      xa *= 0.05; za *= 0.05;
      xa *= 1 - this.pushthrough;
      za *= 1 - this.pushthrough;
      this.push3(-xa, 0, -za);
      e.push3(xa, 0, za);
    }
  }

  push3(xa: number, ya: number, za: number): void {
    this.xd += xa; this.yd += ya; this.zd += za;
  }

  markHurt(): void { this.hurtMarked = true; }

  hurt(_source: Entity | null, _damage: number): boolean {
    this.markHurt();
    return false;
  }

  interactPreventDefault(): boolean { return false; }
  interact(_player: Entity): boolean { return false; }

  isPickable(): boolean { return false; }
  isPushable(): boolean { return false; }
  isShootable(): boolean { return false; }

  isSneaking(): boolean { return false; }
  isAlive(): boolean { return !this.removed; }
  isOnFire(): boolean { return this.onFire > 0; }
  isPlayer(): boolean { return false; }
  isCreativeModeAllowed(): boolean { return false; }
  isMob(): boolean { return false; }
  isItemEntity(): boolean { return false; }
  isHangingEntity(): boolean { return false; }
  getAuxData(): number { return 0; }

  shouldRender(c: Vec3): boolean {
    if (this.invisible) return false;
    const xd = this.x - c.x;
    const yd = this.y - c.y;
    const zd = this.z - c.z;
    const distance = xd * xd + yd * yd + zd * zd;
    return this.shouldRenderAtSqrDistance(distance);
  }
  shouldRenderAtSqrDistance(distance: number): boolean {
    let size = this.bb.getSize();
    size *= 64.0 * this.viewScale;
    return distance < size * size;
  }

  animateHurt(): void {}
  setEquippedSlot(_slot: number, _item: number, _auxValue: number): void {}
  getPickRadius(): number { return 0.1; }
  awardKillScore(_victim: Entity, _score: number): void {}

  isInWall(): boolean {
    const xt = Mth.floor(this.x);
    const yt = Mth.floor(this.y + this.getHeadHeight());
    const zt = Mth.floor(this.z);
    return this.level!.isSolidBlockingTile(xt, yt, zt);
  }
  isInWater(): boolean {
    return this.level!.checkAndHandleWater(this.bb.grow(0, -0.4, 0), 'water', this);
  }
  isInLava(): boolean {
    return this.level!.containsMaterial(this.bb.grow(-0.1, -0.4, -0.1), 'lava');
  }
  isUnderLiquid(material: unknown): boolean {
    const yp = this.y + this.getHeadHeight();
    const xt = Mth.floor(this.x);
    const yt = Mth.floor(yp);
    const zt = Mth.floor(this.z);
    const t = this.level!.getTile(xt, yt, zt);
    if (t !== 0 && Tile_tiles[t]?.material === material) {
      // LiquidTile::getHeight — deferred until LiquidTile port is complete.
      // Approximation: full-block height.
      const hh = 1.0 - 1 / 9.0;
      const h = yt + 1 - hh;
      return yp < h;
    }
    return false;
  }

  makeStuckInWeb(): void {
    this.isStuckInWeb = true;
    this.fallDistance = 0;
  }

  intersects(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): boolean {
    return this.bb.intersects6(x0, y0, z0, x1, y1, z1);
  }

  isFree(xa: number, ya: number, za: number, grow: number): boolean {
    const box = this.bb.grow(grow, grow, grow).cloneMove(xa, ya, za);
    if (this.level!.getCubes(this, box).length > 0) return false;
    if (this.level!.containsAnyLiquid(box)) return false;
    return true;
  }
  isFree3(xa: number, ya: number, za: number): boolean {
    const box = this.bb.cloneMove(xa, ya, za);
    if (this.level!.getCubes(this, box).length > 0) return false;
    if (this.level!.containsAnyLiquid(box)) return false;
    return true;
  }

  resetPos(_clearMore: boolean): void {
    if (this.level == null) return;
    while (this.y > 0) {
      this.setPos(this.x, this.y, this.z);
      if (this.level.getCubes(this, this.bb).length === 0) break;
      this.y += 1;
    }
    this.xd = this.yd = this.zd = 0;
    this.xRot = 0;
  }

  protected setRot(yRot: number, xRot: number): void {
    this.yRot = this.yRotO = yRot;
    this.xRot = this.xRotO = xRot;
  }
  protected setSize(w: number, h: number): void {
    this.bbWidth = w; this.bbHeight = h;
  }
  protected setPosFrom(p: EntityPosLike): void {
    if (p.move) this.setPos(p.x, p.y, p.z);
    else this.setPos(this.x, this.y, this.z);
    if (p.rot) this.setRot(p.yRot, p.xRot);
    else this.setRot(this.yRot, this.xRot);
  }

  protected burn(dmg: number): void {
    if (!this.fireImmune) this.hurt(null, dmg);
  }
  protected lavaHurt(): void {
    if (!this.fireImmune) {
      this.hurt(null, 4);
      this.onFire = 30 * TicksPerSecond;
    }
  }

  playStepSound(xt: number, yt: number, zt: number, t: number): void {
    const tile = Tile_tiles[t];
    if (!tile) return;
    const soundType = tile.soundType;
    if (Tiles.topSnow && this.level!.getTile(xt, yt + 1, zt) === Tiles.topSnow.id) {
      const topSnowSound = Tiles.topSnow.soundType;
      this.level!.playSound(this, topSnowSound.getStepSound(), topSnowSound.getVolume() * 0.25, topSnowSound.getPitch());
    } else if (!tile.material.isLiquid()) {
      this.level!.playSound(this, soundType.getStepSound(), soundType.getVolume() * 0.25, soundType.getPitch());
    }
  }

  // NBT save/load stubs — defer until CompoundTag port
  save(_tag: unknown): boolean { return false; }
  saveWithoutId(_tag: unknown): void {}
  load(_tag: unknown): boolean { return false; }
  protected abstract readAdditionalSaveData(_tag: unknown): void;
  protected abstract addAdditonalSaveData(_tag: unknown): void;

  getEntityData(): unknown { return null; }
  isEntityType(type: number): boolean { return this.getEntityTypeId() === type; }
  abstract getEntityTypeId(): number;
  getCreatureBaseType(): number { return 0; }
  queryEntityRenderer(): number { return ER.ER_DEFAULT_RENDERER; }

  // spawnAtLocation stubs — ItemEntity port deferred.
  spawnAtLocation(_resource: number, _count: number): unknown { return null; }
  spawnAtLocationY(_resource: number, _count: number, _yOffs: number): unknown { return null; }
  spawnAtLocationItem(_itemInstance: unknown, _yOffs: number): unknown { return null; }
}

interface EntityPosLike {
  x: number; y: number; z: number;
  yRot: number; xRot: number;
  rot: boolean; move: boolean;
}
