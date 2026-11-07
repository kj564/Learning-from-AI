/**
 * Translation of: client/player/LocalPlayer.h + LocalPlayer.cpp
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/client/player/LocalPlayer.{h,cpp}
 *
 * Faithful translation of:
 *   - aiStep() — input.tick, sneak ySlideOffset clamp 0.2, fly toggle (double-jump within 7t),
 *                fly up/down = ±0.15, usingItem slows input by 0.35×,
 *                then BOTH Mob::aiStep (travel/input decay/push) AND Player::aiStep (regen/bob/touch).
 *                This is the famous "aiStep calls super::aiStep twice" trap from mcpe-0.6.1-web
 *                CLAUDE.md — input feeds into Mob, then Player runs the player-specific bookkeeping.
 *   - tick()   — useItem countdown + eat particles, online send MovePlayerPacket, armor hash.
 *                We stub the network bits (single-player).
 *   - move()   — autoJump (when crossing tile boundary + solid block ahead).
 *   - actuallyHurt() — closes screen if player gets hurt.
 *   - swing() — set swinging=true (player's animation flag).
 *
 * Constants:
 *   - sneak ySlideOffset clamp = 0.2f
 *   - jumpTriggerTime init = 7 (double-jump fly toggle window)
 *   - fly up/down per tick = ±0.15f
 *   - usingItem slowdown factor = 0.35f
 *
 * Deferred:
 *   - calculateFlight (smooth fly) — uses SmoothFloat, not gameplay-critical for MVP
 *   - inventory / sentInventoryItemId / PlayerEquipmentPacket — needs ItemInstance port
 *   - armorTypeHash — needs ArmorItem port
 *   - Minecraft* ref — passed in, kept here for screen/isOnline access
 */

import { Player, type Abilities } from '../../world/entity/player/Player';
import type { EntityLevel } from '../../world/entity/Entity';
import { Mth } from '../../util/Mth';
import type { IMoveInput } from './input/IMoveInput';

export interface MinecraftLikeForLocalPlayer {
  screen: unknown | null;
  options: { isFlying: boolean };
  isOnline(): boolean;
}

export class LocalPlayer extends Player {
  input: IMoveInput | null = null;
  autoJumpEnabled = false;

  protected jumpTriggerTime = 0;
  protected ascendTriggerTime = 0;
  protected descendTriggerTime = 0;
  protected ascending = false;
  protected descending = false;
  protected minecraft: MinecraftLikeForLocalPlayer | null;

  private autoJumpTime = 0;
  private sentInventoryItemId = 0;
  private sentInventoryItemData = 0;
  private armorTypeHash = 0;

  constructor(minecraft: MinecraftLikeForLocalPlayer | null, level: EntityLevel | null, isCreative: boolean) {
    super(level, isCreative);
    this.minecraft = minecraft;
    this._init();
  }

  _init(): void {
    super._init();
    this.jumpTriggerTime = 0;
  }

  reset(): void { super.reset(); this._init(); }

  setKey(eventKey: number, eventKeyState: boolean): void {
    this.input?.setKey(eventKey, eventKeyState);
  }
  releaseAllKeys(): void { this.input?.releaseAllKeys(); }

  // === LocalPlayer::aiStep — verbatim ===
  aiStep(): void {
    this.jumpTriggerTime--;
    this.ascendTriggerTime--;
    this.descendTriggerTime--;

    const wasJumping = this.input?.wasJumping ?? false;
    const screenCovering = this.minecraft?.screen && !(this.minecraft.screen as { passEvents: boolean }).passEvents;
    if (!screenCovering) {
      this.input?.tick(this);
    }
    if (this.input && this.input.sneaking) {
      if (this.ySlideOffset < 0.2) this.ySlideOffset = 0.2;
    }

    if (this.abilities.mayfly) {
      // Double-jump fly toggle
      if (!wasJumping && this.input?.jumping) {
        if (this.jumpTriggerTime <= 0) this.jumpTriggerTime = 7;
        else {
          this.abilities.flying = !this.abilities.flying;
          this.jumpTriggerTime = 0;
        }
      }
      if (this.abilities.flying) {
        if (this.input?.wantUp) this.yd += 0.15;
        if (this.input?.wantDown) this.yd -= 0.15;
      }
    }

    if (this.isUsingItem() && this.input) {
      const k = 0.35;
      this.input.xa *= k;
      this.input.ya *= k;
    }

    // First Mob::aiStep (travel/input decay/push), then Player::aiStep (regen/bob/touch).
    // (Our Mob class is the base of Player; we need to call both layers.)
    // Player.aiStep already calls super (Mob) internally if it didn't override... actually
    // Player::aiStep in the source does NOT call Mob::aiStep — it's a different aiStep that
    // only does the peaceful-regen + bob/tilt + entity-touch. So we MUST call Mob::aiStep
    // first, then super (Player).
    this.mobAiStep();
    super.aiStep();

    if (this.interpolateOnly()) this.updateAi();
  }

  // LocalPlayer.cpp aiStep calls Mob::aiStep then Player::aiStep (super::aiStep).
  // In TS, Player.aiStep overrides Mob.aiStep — so we need to call BOTH.
  // We do this by calling the parent (Player) which has the player-specific logic,
  // and manually invoking the Mob portion via direct method reference.
  // The C++ source does: Mob::aiStep(); super::aiStep(); — we mirror that
  // by extracting the Mob::aiStep body into a separate callable.
  private mobAiStep(): void {
    // Get the Mob prototype's aiStep and call it with `this` as context
    const MobProto = Object.getPrototypeOf(Object.getPrototypeOf(Object.getPrototypeOf(this)));
    if (MobProto && typeof MobProto.aiStep === 'function') {
      MobProto.aiStep.call(this);
    }
  }

  // === LocalPlayer::tick — partial (network + inventory bits stubbed) ===
  tick(): void {
    super.tick();
    // useItem countdown + eat particles — deferred until ItemInstance port.
    // Online MovePlayerPacket broadcast — deferred until RakNet port.
    this.updateArmorTypeHash();
  }

  // === LocalPlayer::move — autoJump body ===
  move(xa: number, ya: number, za: number): void {
    // The C++ also has the "isFlying + noPhysics" branch using calculateFlight;
    // we delegate that to Player.abilities.flying inside Mob::travel (which checks
    // abilities.flying for the special yd *= 0.6 path).
    if (this.autoJumpTime > 0) {
      this.autoJumpTime--;
      if (this.input) this.input.jumping = true;
    }
    const prevX = this.x, prevZ = this.z;
    super.move(xa, ya, za);
    const newX = this.x, newZ = this.z;
    if (this.autoJumpTime <= 0 && this.autoJumpEnabled) {
      let jump = false;
      if (Mth.floor(prevX * 2.0) !== Mth.floor(newX * 2.0) || Mth.floor(prevZ * 2.0) !== Mth.floor(newZ * 2.0)) {
        const dist = Mth.sqrt(xa * xa + za * za);
        if (dist > 0) {
          const xx = Mth.floor(this.x + xa / dist);
          const zz = Mth.floor(this.z + za / dist);
          const yBelow = (this.y - 1) | 0;
          const tileId = this.level!.getTile(xx, yBelow, zz);
          jump = (
            this.isSolidTile(xx, yBelow, zz)
            && !this.isSolidTile(xx, this.y | 0, zz)
            && !this.isSolidTile(xx, (this.y | 0) + 1, zz)
          );
          void tileId;
        }
      }
      if (jump) this.autoJumpTime = 1;
    }
  }

  private isSolidTile(x: number, y: number, z: number): boolean {
    const t = this.level!.getTile(x, y, z);
    if (t === 0) return false;
    // isSolidTile reads Tile::solid array (populated in Tile::init()).
    // We import lazily to avoid circular deps.
    return this.level!.isSolidBlockingTile(x, y, z);
  }

  // === LocalPlayer::actuallyHurt ===
  actuallyHurt(dmg: number): void {
    if (this.minecraft?.screen && (this.minecraft.screen as { closeOnPlayerHurt?: () => boolean }).closeOnPlayerHurt?.()) {
      this.closeContainer();
    }
    super.actuallyHurt(dmg);
  }

  protected closeContainer(): void {}
  protected updateAi(): void {
    // LocalPlayer::updateAi — copies input values to Mob's movement fields.
    // This is what makes the player actually move when you press WASD:
    //   Mob::aiStep calls this.updateAi() (since !interpolateOnly && !useNewAi)
    //   → xxa/yya get set from input.xa/ya
    //   → Mob::aiStep then calls travel(xxa, yya) which applies gravity/friction + move
    super.updateAi();
    if (this.input) {
      this.xxa = this.input.xa;
      this.yya = this.input.ya;
      this.jumping = this.input.jumping || this.autoJumpTime > 0;
    }
  }
  private updateArmorTypeHash(): void {}

  // === LocalPlayer::swing ===
  swing(): void { this.swinging = true; }

  isSneaking(): boolean { return this.input?.sneaking ?? false; }

  // Stubs for LocalPlayer-only overrides
  drop(_item: unknown, _randomly?: boolean): void {}
  take(_e: unknown, _orgCount: number): void {}
  startCrafting(_x: number, _y: number, _z: number, _tableSize: number): void {}
  startStonecutting(_x: number, _y: number, _z: number): void {}
  openContainer(_container: unknown): void {}
  openFurnace(_e: unknown): void {}
  openTextEdit(_tileEntity: unknown): void {}
  causeFallDamage(_distance: number): void { super.causeFallDamage(_distance); }
  die(source: unknown): void { super.die(source as never); }
  respawn(): void { super.respawn(); }
  displayClientMessage(_messageId: string): void {}
  getFieldOfViewModifier(): number { return 1.0; }
  startSleepInBed(x: number, y: number, z: number): number { return super.startSleepInBed(x, y, z); }
  stopSleepInBed(f: boolean, u: boolean, s: boolean): void { super.stopSleepInBed(f, u, s); }

  protected readAdditionalSaveData(_tag: unknown): void {}
  protected addAdditonalSaveData(_tag: unknown): void {}
}

void (null as unknown as Abilities); // keep Abilities import used
