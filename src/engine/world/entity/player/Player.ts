/**
 * Translation of: world/entity/player/Player.h + Player.cpp (key methods)
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/entity/player/Player.{h,cpp}
 *
 * Constants verified:
 *   - MAX_HEALTH = 20 (Player.h)
 *   - SLEEP_DURATION = 100, WAKE_UP_DURATION = 10
 *   - PEACEFUL regen = heal(1) every 12*20 = 240 ticks (Player.cpp aiStep)
 *   - Flying: flyingSpeed temporarily = 0.05, yd *= 0.6 (Player.cpp travel)
 *   - Difficulty damage scaling: PEACEFUL=0, EASY=dmg/3+1, NORMAL=dmg, HARD=dmg*3/2
 *
 * Deferred: Inventory, Abilities (full), SimpleFoodData, ItemInstance, BaseContainerMenu,
 *   bed/sleep system, crafting/stonecutting, container open/close, fishing hook, RakNetGUID.
 */

import { Mob } from '../Mob';
import { Entity, type EntityLevel } from '../Entity';
import { Mth } from '../../../util/Mth';
import { TicksPerSecond } from '../../../shared/SharedConstants';

export class BedSleepingResult {
  static readonly OK = 0;
  static readonly NOT_POSSIBLE_HERE = 1;
  static readonly NOT_POSSIBLE_NOW = 2;
  static readonly TOO_FAR_AWAY = 3;
  static readonly OTHER_PROBLEM = 4;
  static readonly NOT_SAFE = 5;
}

export const Difficulty = {
  PEACEFUL: 0,
  EASY: 1,
  NORMAL: 2,
  HARD: 3,
} as const;

export const MobTypes = {
  BaseEnemy: 1,
};

export interface Abilities {
  flying: boolean;
  instabuild: boolean;
  mayfly: boolean;
  invulnerable: boolean;
  flyingSpeed: number;
  walkingSpeed: number;
}

export function defaultAbilities(isCreative: boolean): Abilities {
  return {
    flying: false,
    instabuild: isCreative,
    mayfly: isCreative,
    invulnerable: isCreative,
    flyingSpeed: 0.05,
    walkingSpeed: 0.1,
  };
}

export class Player extends Mob {
  static readonly MAX_NAME_LENGTH = 16;
  static readonly MAX_HEALTH = 20;
  static readonly DEFAULT_WALK_SPEED = 0.1;
  static readonly DEFAULT_FLY_SPEED = 0.02;
  static readonly SLEEP_DURATION = 100;
  static readonly WAKE_UP_DURATION = 10;

  static readonly DATA_PLAYER_FLAGS_ID = 16;
  static readonly DATA_BED_POSITION_ID = 17;
  static readonly PLAYER_SLEEP_FLAG = 1;

  static readonly NUM_ARMOR = 4;

  userType: number = 0;
  score = 0;
  oBob = 0;
  bob = 0;
  name = '';
  dimension = 0;
  abilities: Abilities;
  hasFakeInventory = false;
  bedPosition = { x: 0, y: 0, z: 0 };
  bedOffsetX = 0;
  bedOffsetY = 0;
  bedOffsetZ = 0;

  protected useItem: unknown = null;
  protected useItemDuration = 0;
  protected sleepCounter = 0;

  private respawnPosition = { x: 0, y: 0, z: 0 };
  private playerHasRespawnPosition = false;
  private playerIsSleeping = false;
  private allPlayersSleeping = false;
  private armor: unknown[] = new Array(Player.NUM_ARMOR).fill(null);

  constructor(level: EntityLevel | null, isCreative: boolean) {
    super(level);
    this.abilities = defaultAbilities(isCreative);
    this.userType = isCreative ? 1 : 0;
    this._init();
  }

  _init(): void {
    this.health = Player.MAX_HEALTH;
    this.lastHealth = Player.MAX_HEALTH;
    this.walkingSpeed = Player.DEFAULT_WALK_SPEED;
    this.flyingSpeed = Player.DEFAULT_FLY_SPEED;
  }

  reset(): void { super.reset(); this._init(); }

  static isPlayer(e: Entity | null): boolean { return e !== null && e instanceof Player; }
  static asPlayer(e: Entity): Player | null { return e instanceof Player ? e : null; }

  tick(): void { super.tick(); }

  // Player::aiStep — verbatim from Player.cpp
  aiStep(): void {
    const difficulty = (this.level as unknown as { difficulty: number })?.difficulty ?? Difficulty.NORMAL;
    if (difficulty === Difficulty.PEACEFUL && this.health < Player.MAX_HEALTH) {
      if (this.tickCount % (12 * TicksPerSecond) === 0) this.heal(1);
    }
    this.oBob = this.bob;

    const tBob = Math.sqrt(this.xd * this.xd + this.zd * this.zd);
    const tTilt = Math.atan(-this.yd * 0.2) * 15;
    const tBobClamped = tBob > 0.1 ? 0.1 : tBob;
    const tBobFinal = (!this.onGround || this.health <= 0) ? 0 : tBobClamped;
    const tTiltFinal = (this.onGround || this.health <= 0) ? 0 : tTilt;
    this.bob += (tBobFinal - this.bob) * 0.4;
    this.tilt += (tTiltFinal - this.tilt) * 0.8;

    if (this.health > 0) {
      const growBox = this.bb.grow(1, 0, 1);
      const entities = (this.level as unknown as {
        getEntities(self: Player, box: typeof growBox): Entity[];
      })?.getEntities?.(this, growBox) ?? [];
      for (const e of entities) {
        if (!e.removed) this.touch(e);
      }
    }
  }

  // Player::travel — verbatim from Player.cpp
  travel(xa: number, ya: number): void {
    if (this.abilities.flying) {
      const ydo = this.yd;
      const ofs = this.flyingSpeed;
      this.flyingSpeed = 0.05;
      super.travel(xa, ya);
      this.yd = ydo * 0.6;
      this.flyingSpeed = ofs;
    } else {
      super.travel(xa, ya);
    }
  }

  getWalkingSpeedModifier(): number { return 1; }

  // Player::hurt — verbatim
  hurt(source: Entity | null, dmg: number): boolean {
    if (this.abilities.invulnerable) return false;
    this.noActionTime = 0;
    if (this.health <= 0) return false;
    if (this.isSleeping() && !this.level!.isClientSide) {
      this.stopSleepInBed(true, true, false);
    }
    if (source !== null) {
      const baseEnemy = source.getCreatureBaseType() === MobTypes.BaseEnemy;
      const isArrow = source.getEntityTypeId() === 0;
      if (baseEnemy || isArrow) {
        const level = this.level as unknown as { adventureSettings?: { noMvP?: boolean }, difficulty: number };
        if (source.isMob() && level.adventureSettings?.noMvP) return false;
        const d = level.difficulty;
        if (d === Difficulty.PEACEFUL) dmg = 0;
        else if (d === Difficulty.EASY) dmg = Math.floor(dmg / 3) + 1;
        else if (d === Difficulty.HARD) dmg = Math.floor(dmg * 3 / 2);
      }
    }
    if (dmg === 0) return false;
    return super.hurt(source, dmg);
  }

  die(source: Entity | null): void { super.die(source); }
  remove(): void { this.removed = true; }

  respawn(): void {
    this.health = Player.MAX_HEALTH;
    this.removed = false;
    this.reset();
    if (this.playerHasRespawnPosition) {
      this.setPos(this.respawnPosition.x, this.respawnPosition.y, this.respawnPosition.z);
    } else {
      this.setPos(0, 0, 0);
    }
  }

  resetPos(clearMore: boolean): void { super.resetPos(clearMore); }
  getRespawnPosition(): { x: number; y: number; z: number } { return this.respawnPosition; }
  setRespawnPosition(pos: { x: number; y: number; z: number }): void {
    this.respawnPosition = { ...pos };
    this.playerHasRespawnPosition = true;
  }
  hasRespawnPosition(): boolean { return this.playerHasRespawnPosition; }

  isShootable(): boolean { return true; }
  isCreativeModeAllowed(): boolean { return true; }
  isPlayer(): boolean { return true; }

  getMaxHealth(): number { return Player.MAX_HEALTH; }
  isHurt(): boolean { return this.hurtTime > 0 || this.invulnerableTime > 0; }

  hurtArmor(_dmg: number): void {}
  setArmor(_slot: number, _item: unknown): void {}
  getArmor(_slot: number): unknown { return null; }
  getArmorTypeHash(): number { return 0; }

  interact(_entity: Entity): void {}
  attack(_entity: Entity): void {}
  getCarriedItem(): unknown { return null; }
  canUseCarriedItemWhileMoving(): boolean { return this.userType === 1; }

  startCrafting(_x: number, _y: number, _z: number, _tableSize: number): void {}
  startStonecutting(_x: number, _y: number, _z: number): void {}
  openContainer(_container: unknown): void {}
  openFurnace(_e: unknown): void {}
  tileEntityDestroyed(_tileEntityId: number): void {}
  displayClientMessage(_messageId: string): void {}
  animateRespawn(): void {}
  getHeadHeight(): number { return 1.62; }

  getEntityTypeId(): number { return 0; }
  getItemInHandIcon(item: { getIcon(): number } | null, _layer: number): number {
    return item ? item.getIcon() : 0;
  }

  isSleeping(): boolean { return this.playerIsSleeping; }
  startSleepInBed(_x: number, _y: number, _z: number): number {
    this.playerIsSleeping = true;
    return BedSleepingResult.OK;
  }
  stopSleepInBed(_forcefulWakeUp: boolean, _updateLevelList: boolean, _saveRespawnPoint: boolean): void {
    this.playerIsSleeping = false;
  }
  getSleepTimer(): number { return this.sleepCounter; }
  setAllPlayersSleeping(): void { this.allPlayersSleeping = true; }
  getSleepRotation(): number { return 0; }
  isSleepingLongEnough(): boolean { return this.sleepCounter >= Player.SLEEP_DURATION; }
  getSelectedItem(): unknown { return null; }

  openTextEdit(_tileEntity: unknown): void {}
  getArmorValue(): number { return 0; }

  protected isImmobile(): boolean { return false; }
  protected updateAi(): void {}
  protected closeContainer(): void {}
  protected setDefaultHeadHeight(): void {}
  protected readAdditionalSaveData(_tag: unknown): void {}
  protected addAdditonalSaveData(_tag: unknown): void {}
  protected setBedOffset(_bedDirection: number): void {}
  protected checkBed(): boolean { return false; }

  static animateRespawn(_player: Player, _level: unknown): void {}
  protected spawnEatParticles(_useItem: unknown, _count: number): void {}

  private touch(_entity: Entity): void {}
  hasResource(_id: number): boolean { return false; }

  isUsingItem(): boolean { return this.useItem !== null; }
  getUseItem(): unknown { return this.useItem; }
  startUsingItem(instance: unknown, duration: number): void {
    this.useItem = instance;
    this.useItemDuration = duration;
  }
  stopUsingItem(): void {
    this.useItem = null;
    this.useItemDuration = 0;
  }
  releaseUsingItem(): void { this.useItem = null; this.useItemDuration = 0; }
  completeUsingItem(): void {}
  getUseItemDuration(): number { return this.useItemDuration; }
  getTicksUsingItem(): number { return this.useItemDuration; }

  getScore(): number { return this.score; }
  awardKillScore(_victim: Entity, score: number): void { this.score += score; }
  handleEntityEvent(_id: number): void {}

  take(_e: Entity, _orgCount: number): void {}
  drop(_item: unknown, _randomly?: boolean): void {}
  reallyDrop(_thrownItem: unknown): void {}

  canDestroy(tile: { destroySpeed: number }): boolean { return tile.destroySpeed >= 0; }
  getDestroySpeed(_tile: unknown): number { return 1; }
}

void Mth;
