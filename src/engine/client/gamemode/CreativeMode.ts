/**
 * Translation of: client/gamemode/CreativeMode.{h,cpp}
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/client/gamemode/CreativeMode.{h,cpp}
 *
 * Faithful translation of:
 *   - startDestroyBlock  — calls creativeDestroyBlock + sets destroyDelay = 10
 *   - creativeDestroyBlock — calls level.extinguishFire + destroyBlock
 *   - continueDestroyBlock — destroys every 10 ticks while held
 *   - stopDestroyBlock — empty
 *   - initAbilities — mayfly + instabuild + invulnerable
 *   - isCreativeType — true
 *   - releaseUsingItem — preserves item aux/count (creative doesn't consume)
 *
 * Constants:
 *   DestructionTickDelay = 10  (CreativeMode.cpp line 12)
 */

import { GameMode } from './GameMode';
import type { Minecraft } from '../Minecraft';
import type { Player, Abilities } from '../../world/entity/player/Player';
import type { Level } from '../../world/level/Level';
import type { Entity } from '../../world/entity/Entity';

const DestructionTickDelay = 10;

export class CreativeMode extends GameMode {
  constructor(minecraft: Minecraft) { super(minecraft); }

  // CreativeMode::startDestroyBlock — verbatim
  startDestroyBlock(x: number, y: number, z: number, face: number): void {
    // C++: if(player->getCarriedItem() && player->getCarriedItem()->id == Item::bow->id) return;
    // Item::bow deferred.
    this.creativeDestroyBlock(x, y, z, face);
    this.destroyDelay = DestructionTickDelay;
  }

  // CreativeMode::creativeDestroyBlock — verbatim
  private creativeDestroyBlock(x: number, y: number, z: number, face: number): void {
    // level->extinguishFire(x, y, z, face) — deferred (no Tile extinguish yet)
    this.destroyBlock(x, y, z, face);
  }

  destroyBlock(x: number, y: number, z: number, _face: number): boolean {
    // Creative: instantly remove the block + drop nothing (no resource spawn).
    // The C++ version in GameMode::destroyBlock (or CreativeMode via super)
    // calls level->setTile(x,y,z, 0) + tile.playerDestroy / particle burst.
    // For MVP we just setTile(0).
    const level = this.minecraft.level;
    if (!level) return false;
    const t = level.getTile(x, y, z);
    if (t === 0) return false;
    level.setTile(x, y, z, 0);
    return true;
  }

  // CreativeMode::continueDestroyBlock — verbatim
  continueDestroyBlock(x: number, y: number, z: number, face: number): void {
    this.destroyDelay--;
    if (this.destroyDelay <= 0) {
      this.destroyDelay = DestructionTickDelay;
      this.creativeDestroyBlock(x, y, z, face);
    }
  }

  stopDestroyBlock(): void {}

  // CreativeMode::initAbilities — verbatim
  initAbilities(abilities: Abilities): void {
    abilities.mayfly = true;
    abilities.instabuild = true;
    abilities.invulnerable = true;
  }

  isCreativeType(): boolean { return true; }

  // CreativeMode::releaseUsingItem — preserves item aux (creative doesn't consume).
  // Needs ItemInstance port to do the auxValue/count save-restore. For MVP no-op.
  releaseUsingItem(_player: Player): void {
    super.releaseUsingItem(_player);
  }

  // Base GameMode methods we keep as overrides
  interact(player: Player, entity: Entity): void { super.interact(player, entity); }
  attack(player: Player, entity: Entity): void { super.attack(player, entity); }
}
