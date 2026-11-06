/**
 * Translation of: world/entity/Mob.h + Mob.cpp (key methods)
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/entity/Mob.{h,cpp}
 *
 * This file translates the class skeleton + the hot gameplay methods:
 *   - travel(xa, ya)  — gravity, friction, water/lava/land swim/step. Verbatim.
 *   - aiStep()        — input decay, jump trigger, push entities.
 *   - baseTick()      — ambient sound, drowning, hurt ticks, death anim.
 *   - tick()          — lerp (networked motion), then aiStep, then walk anim.
 *   - jumpFromGround() — yd = 0.42
 *   - heal/hurt/actuallyHurt/getArmorValue stubs (full bodies in Mob.cpp later)
 *
 * Not translated here yet (deferred):
 *   - newServerAiStep / updateAi — the AI behavior tree (PathfinderMob extends it)
 *   - MoveControl / JumpControl / PathNavigation / GoalSelector — AI helpers
 *   - Sensing — vision system
 *   - SynchedEntityData — full networked state sync
 *
 * Constants verified line-by-line:
 *   - jump = 0.42f        (Mob::jumpFromGround)
 *   - gravity = 0.08f    (Mob::travel: yd -= 0.08f)
 *   - air drag = 0.98f    (Mob::travel: yd *= 0.98f)
 *   - water drag = 0.80f  (Mob::travel water branch)
 *   - lava drag = 0.50f   (Mob::travel lava branch)
 *   - swim kick = 0.04f   (Mob::aiStep water/lava jump)
 *   - swim-up = 0.3f      (Mob::travel water: yd = 0.3f)
 *   - friction base = 0.91f, ground = 0.6f * 0.91f
 *   - ladder descend = -0.15f, climb = 0.2f
 */

import { Entity, type EntityLevel } from './Entity';
import { Mth } from '../../util/Mth';
import { Random } from '../../util/Random';
import { Vec3 } from '../phys/Vec3';
import { TicksPerSecond } from '../../shared/SharedConstants';
import { tiles as Tile_tiles } from '../level/tile/Tile';

export class Mob extends Entity {
  static readonly ATTACK_DURATION = 5;
  static readonly SWING_DURATION = 8;

  // === Public fields from Mob.h ===
  invulnerableDuration = 0;
  timeOffs = 0;
  rotA = 0;
  yBodyRot = 0;
  yBodyRotO = 0;
  oAttackAnim = 0;
  attackAnim = 0;
  health = 10;
  lastHealth = 10;
  hurtTime = 0;
  hurtDuration = 0;
  hurtDir = 0;
  deathTime = 0;
  attackTime = 0;
  oTilt = 0;
  tilt = 0;
  lookTime = 0;
  fallTime = 0;
  walkAnimSpeedO = 0;
  walkAnimSpeed = 0;
  walkAnimPos = 0;
  aimDirection: Vec3 = new Vec3(0, 0, 0);
  arrowCount = 0;
  removeArrowTime = 0;
  random: Random;
  bypassArmor = false;

  // === Protected fields ===
  protected entityData: unknown = null;
  protected swinging = false;
  protected swingTime = 0;
  protected noActionTime = 0;
  protected xxa = 0;
  protected yya = 0;
  protected yRotA = 0;
  protected defaultLookAngle = 0;
  protected runSpeed = 0;
  protected walkingSpeed = 0.1;
  protected flyingSpeed = 0.02;
  protected textureName = '';
  protected modelName = '';
  protected deathScore = 0;
  protected oRun = 0;
  protected run = 0;
  protected animStep = 0;
  protected animStepO = 0;
  protected rotOffs = 0;
  protected bobStrength = 1;
  protected renderOffset = 0;
  protected lSteps = 0;
  protected lx = 0; protected ly = 0; protected lz = 0; protected lyr = 0; protected lxr = 0;
  protected lastHurt = 0;
  protected dmgSpill = 0;
  protected sentX = 0; protected sentY = 0; protected sentZ = 0;
  protected sentRotX = 0; protected sentRotY = 0;
  protected sentXd = 0; protected sentYd = 0; protected sentZd = 0;
  protected allowAlpha = false;
  protected jumping = false;
  protected autoSendPosRot = false;

  // === Private fields ===
  private lookingAtId = -1;
  private ambientSoundTime = 0;
  private speed = 0;

  constructor(level: EntityLevel | null) {
    super(level);
    this.random = new Random();
    this._init();
  }

  _init(): void {
    // From Mob.cpp _init() — initializes health + speeds.
    // (We keep walkingSpeed/flyingSpeed defaults from Mob.h field inits.)
    this.health = 10;
    this.lastHealth = 10;
  }

  reset(): void { super.reset(); this._init(); }

  // === Mob::travel(xa, ya) — verbatim from Mob.cpp:558 ===
  travel(xa: number, ya: number): void {
    if (this.isInWater()) {
      const yo = this.y;
      this.moveRelative(xa, ya, 0.02);
      this.move(this.xd, this.yd, this.zd);
      this.xd *= 0.80; this.yd *= 0.80; this.zd *= 0.80;
      this.yd -= 0.02;
      if (this.horizontalCollision && this.isFree3(this.xd, this.yd + 0.6 - this.y + yo, this.zd)) {
        this.yd = 0.3;
      }
    } else if (this.isInLava()) {
      const yo = this.y;
      this.moveRelative(xa, ya, 0.02);
      this.move(this.xd, this.yd, this.zd);
      this.xd *= 0.50; this.yd *= 0.50; this.zd *= 0.50;
      this.yd -= 0.02;
      if (this.horizontalCollision && this.isFree3(this.xd, this.yd + 0.6 - this.y + yo, this.zd)) {
        this.yd = 0.3;
      }
    } else {
      let friction = 0.91;
      if (this.onGround) {
        friction = 0.6 * 0.91;
        const t = this.level!.getTile(Mth.floor(this.x), Mth.floor(this.bb.y0 - 0.5), Mth.floor(this.z));
        if (t > 0) {
          const tile = Tile_tiles[t];
          if (tile) friction = tile.friction * 0.91;
        }
      }
      const friction2 = (0.6 * 0.6 * 0.91 * 0.91 * 0.6 * 0.91) / (friction * friction * friction);
      this.moveRelative(xa, ya, this.onGround ? this.walkingSpeed * friction2 : this.flyingSpeed);

      // Recompute friction (the C++ does this twice — same code path)
      friction = 0.91;
      if (this.onGround) {
        friction = 0.6 * 0.91;
        const t = this.level!.getTile(Mth.floor(this.x), Mth.floor(this.bb.y0 - 0.5), Mth.floor(this.z));
        if (t > 0) {
          const tile = Tile_tiles[t];
          if (tile) friction = tile.friction * 0.91;
        }
      }
      if (this.onLadder()) {
        this.fallDistance = 0;
        if (this.yd < -0.15) this.yd = -0.15;
        if (this.isSneaking() && this.yd < 0) this.yd = 0;
      }
      this.move(this.xd, this.yd, this.zd);
      if (this.horizontalCollision && this.onLadder()) this.yd = 0.2;
      this.yd -= 0.08;
      this.yd *= 0.98;
      this.xd *= friction;
      this.zd *= friction;
    }
  }

  // === Mob::aiStep() — verbatim from Mob.cpp ===
  aiStep(): void {
    if (this.isImmobile()) {
      this.jumping = false;
      this.xxa = 0;
      this.yya = 0;
      this.yRotA = 0;
    } else {
      if (!this.interpolateOnly()) {
        if (this.useNewAi()) {
          this.newServerAiStep();
        } else {
          this.updateAi();
        }
      }
    }

    const inWater = this.isInWater();
    const inLava = this.isInLava();
    if (this.jumping) {
      if (inWater) this.yd += 0.04;
      else if (inLava) this.yd += 0.04;
      else if (this.onGround) this.jumpFromGround();
    }

    this.xxa *= 0.98;
    this.yya *= 0.98;
    this.yRotA *= 0.9;

    const normalSpeed = this.walkingSpeed;
    const normalAirControlSpeed = this.flyingSpeed;
    this.walkingSpeed *= this.getWalkingSpeedModifier();
    this.flyingSpeed *= this.getWalkingSpeedModifier();
    this.travel(this.xxa, this.yya);
    this.walkingSpeed = normalSpeed;
    this.flyingSpeed = normalAirControlSpeed;

    // Push nearby entities
    if (!this.isPlayer() || (this as unknown as { isSleeping(): boolean }).isSleeping?.() === false) {
      const growBox = this.bb.grow(0.2, 0, 0.2);
      const entities = (this.level as unknown as {
        getEntities(self: Mob, box: typeof growBox): Entity[];
      })?.getEntities?.(this, growBox) ?? [];
      for (const e of entities) {
        // skip sleeping players
        if (e.isPlayer()) {
          const p = e as unknown as { isSleeping(): boolean };
          if (p.isSleeping?.()) continue;
        }
        if (e.isPushable()) e.push(this);
      }
    }
  }

  // === Mob::baseTick() — verbatim from Mob.cpp ===
  baseTick(): void {
    this.oAttackAnim = this.attackAnim;
    super.baseTick();

    if (((++this.ambientSoundTime & 15) === 0) && this.random.nextInt(2000) < this.ambientSoundTime) {
      this.ambientSoundTime = -this.getAmbientSoundInterval();
      this.playAmbientSound();
    }

    if (this.isAlive() && this.isInWall()) {
      this.hurt(null, 1);
    }

    if (this.isAlive() && this.isUnderLiquid('water') && !this.isWaterMob()) {
      this.airSupply--;
      if (this.airSupply === -20) {
        this.airSupply = 0;
        for (let i = 0; i < 8; i++) {
          const xo = this.random.nextFloat() - this.random.nextFloat();
          const yo = this.random.nextFloat() - this.random.nextFloat();
          const zo = this.random.nextFloat() - this.random.nextFloat();
          this.level!.addParticle('bubble', this.x + xo, this.y + yo, this.z + zo, this.xd, this.yd, this.zd);
        }
        this.hurt(null, 2);
      }
    } else {
      this.airSupply = this.airCapacity;
    }

    this.oTilt = this.tilt;
    if (this.attackTime > 0) this.attackTime--;
    if (this.hurtTime > 0) this.hurtTime--;
    if (this.invulnerableTime > 0) this.invulnerableTime--;

    if (this.health <= 0) {
      this.deathTime++;
      if (this.deathTime > TicksPerSecond) {
        this.beforeRemove();
        this.remove();
        for (let i = 0; i < 20; i++) {
          const xa = (2 * this.random.nextFloat() - 1) * (2 * this.random.nextFloat() - 1) * 0.02;
          const ya = (2 * this.random.nextFloat() - 1) * (2 * this.random.nextFloat() - 1) * 0.02;
          const za = (2 * this.random.nextFloat() - 1) * (2 * this.random.nextFloat() - 1) * 0.02;
          this.level!.addParticle(
            'explode',
            this.x + this.random.nextFloat() * this.bbWidth * 2 - this.bbWidth,
            this.y + this.random.nextFloat() * this.bbHeight,
            this.z + this.random.nextFloat() * this.bbWidth * 2 - this.bbWidth,
            xa, ya, za,
          );
        }
      }
    }
  }

  // === Mob::tick() — verbatim ===
  tick(): void {
    super.tick();

    if (this.arrowCount > 0) {
      if (this.removeArrowTime <= 0) this.removeArrowTime = 20 * 3;
      this.removeArrowTime--;
      if (this.removeArrowTime <= 0) this.arrowCount--;
    }

    if (this.lSteps > 0) {
      const xt = this.x + (this.lx - this.x) / this.lSteps;
      const yt = this.y + (this.ly - this.y) / this.lSteps;
      const zt = this.z + (this.lz - this.z) / this.lSteps;
      let yrd = this.lyr - this.yRot;
      while (yrd < -180) yrd += 360;
      while (yrd >= 180) yrd -= 360;
      this.yRot += yrd / this.lSteps;
      this.xRot += (this.lxr - this.xRot) / this.lSteps;
      this.lSteps--;
      this.setPos(xt, yt, zt);
      this.setRot(this.yRot, this.xRot);
    }

    this.aiStep();
    this.updateWalkAnim();
  }

  // === Mob::jumpFromGround() ===
  jumpFromGround(): void {
    this.yd = 0.42;
  }

  // === Stubs / minimal overrides (deferred bodies) ===
  knockback(_source: Entity | null, _dmg: number, _xd: number, _zd: number): void {}
  die(_source: Entity | null): void { this.remove(); }
  canSee(_target: Entity): boolean { return true; }
  onLadder(): boolean { return false; }
  spawnAnim(): void {}
  getTexture(): string { return this.textureName; }
  isAlive(): boolean { return !this.removed; }
  isPickable(): boolean { return true; }
  isPushable(): boolean { return true; }
  isShootable(): boolean { return true; }
  isSleeping(): boolean { return false; }
  isWaterMob(): boolean { return false; }
  setSneaking(_value: boolean): void {}
  getHeadHeight(): number { return 1.62; }
  getVoicePitch(): number { return 1; }
  playAmbientSound(): void {}
  getAmbientSoundInterval(): number { return 100; }
  lerpTo(x: number, y: number, z: number, yRot: number, xRot: number, steps: number): void {
    if (steps === 0) {
      this.setPos(x, y, z);
      this.setRot(yRot, xRot);
      this.lSteps = 0;
      return;
    }
    this.lx = x; this.ly = y; this.lz = z; this.lyr = yRot; this.lxr = xRot;
    this.lSteps = steps;
  }
  setYya(yya: number): void { this.yya = yya; }
  getSpeed(): number { return this.speed; }
  setSpeed(speed: number): void { this.speed = speed; }
  setJumping(jump: boolean): void { this.jumping = jump; }

  heal(heal: number): void {
    this.health = Math.min(this.health + heal, this.getMaxHealth());
  }
  getMaxHealth(): number { return 10; }
  hurt(source: Entity | null, dmg: number): boolean {
    if (this.invulnerableTime > 0 || this.health <= 0) return false;
    this.markHurt();
    this.lastHurt = this.tickCount;
    this.actuallyHurt(dmg);
    return true;
  }
  actuallyHurt(dmg: number): void {
    this.health -= dmg;
    this.hurtTime = 10;
    this.hurtDuration = 10;
    if (this.health <= 0) this.die(null);
  }
  animateHurt(): void {
    this.hurtTime = 10;
    this.hurtDuration = 10;
  }
  getArmorValue(): number { return 0; }

  getAttackAnim(a: number): number { return this.oAttackAnim + (this.attackAnim - this.oAttackAnim) * a; }
  getPos(a: number): Vec3 { return new Vec3(this.xo + (this.x - this.xo) * a, this.yo + (this.y - this.yo) * a, this.zo + (this.z - this.zo) * a); }
  getLookAngle(): Vec3 { return new Vec3(0, 0, 0); }
  getViewVector(_a: number): Vec3 { return new Vec3(0, 0, 0); }
  getMaxSpawnClusterSize(): number { return 3; }
  isMob(): boolean { return true; }
  isBaby(): boolean { return false; }
  handleEntityEvent(_id: number): void {}
  swing(): void { this.swinging = true; }

  protected causeFallDamage(distance: number): void {
    if (this.bypassArmor) {
      this.actuallyHurt(Math.ceil(distance - 3));
    } else {
      // bypassArmor false → armor reduces damage. We don't have armor port yet.
      this.actuallyHurt(Math.ceil(distance - 3));
    }
  }
  protected outOfWorld(): void { this.die(null); }
  protected removeWhenFarAway(): boolean { return false; }
  protected getDeathLoot(): number { return 0; }
  protected dropDeathLoot(): void {}
  protected isImmobile(): boolean { return this.health <= 0; }
  protected updateAi(): void {}
  protected newServerAiStep(): void {}
  protected setSize(w: number, h: number): void { super.setSize(w, h); }
  protected getMaxHeadXRot(): number { return 40; }
  protected getSoundVolume(): number { return 1; }
  protected getAmbientSound(): string | null { return null; }
  protected getHurtSound(): string | null { return null; }
  protected getDeathSound(): string | null { return null; }
  protected getWalkingSpeedModifier(): number { return 1; }

  protected getDamageAfterArmorAbsorb(damage: number): number { return damage; }
  protected hurtArmor(_damage: number): void {}
  protected beforeRemove(): void {}
  canSpawn(): boolean { return true; }

  interpolateOnly(): boolean { return false; }
  useNewAi(): boolean { return false; }
  getSharedFlag(_flag: number): boolean { return false; }
  setSharedFlag(_flag: number, _value: boolean): void {}
  checkDespawn(_nearestBlocking?: Mob): void {}
  updateAttackAnim(): void {}
  updateWalkAnim(): void {}
  lookAt(_e: Entity, _yMax: number, _xMax: number): void {}
  isLookingAtAnEntity(): boolean { return false; }

  // abstract Entity methods
  getEntityTypeId(): number { return 0; }
  protected readAdditionalSaveData(_tag: unknown): void {}
  protected addAdditonalSaveData(_tag: unknown): void {}
}
