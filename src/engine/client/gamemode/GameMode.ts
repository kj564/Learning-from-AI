/**
 * Translation of: client/gamemode/GameMode.{h,cpp}
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/client/gamemode/GameMode.{h,cpp}
 *
 * GameMode dispatches block-interaction events to survival/creative logic.
 */

import { Vec3 } from '../../world/phys/Vec3';
import type { Level } from '../../world/level/Level';
import type { Player, Abilities } from '../../world/entity/player/Player';
import type { Entity } from '../../world/entity/Entity';
import type { Minecraft } from '../Minecraft';

export abstract class GameMode {
  protected minecraft: Minecraft;
  oDestroyProgress = 0;
  destroyProgress = 0;
  protected destroyTicks = 0;
  protected destroyDelay = 0;

  constructor(minecraft: Minecraft) { this.minecraft = minecraft; }

  initLevel(_level: Level): void {}

  // GameMode.cpp startDestroyBlock — verbatim (modulo bow check that needs Item::bow)
  startDestroyBlock(x: number, y: number, z: number, face: number): void {
    // C++: if(player->getCarriedItem() && player->getCarriedItem()->id == Item::bow->id) return;
    // Item::bow deferred — skip the bow check until Item port.
    this.destroyBlock(x, y, z, face);
  }

  abstract destroyBlock(x: number, y: number, z: number, face: number): boolean;
  abstract continueDestroyBlock(x: number, y: number, z: number, face: number): void;
  stopDestroyBlock(): void {}

  // GameMode.cpp tick — verbatim
  tick(): void { this.oDestroyProgress = this.destroyProgress; }
  render(_a: number): void {}
  getPickRange(): number { return 5.0; }

  // GameMode.cpp useItemOn — verbatim (modulo Item::useOn + UseItemPacket)
  useItemOn(player: Player, level: Level, item: unknown, x: number, y: number, z: number, face: number, hit: Vec3): boolean {
    const clickX = hit.x - x;
    const clickY = hit.y - y;
    const clickZ = hit.z - z;
    void clickX; void clickY; void clickZ; void player; void face;
    const t = level.getTile(x, y, z);
    if (t === 95 /* Tile::invisible_bedrock->id */) return false;
    if (t > 0) {
      // Tile::tiles[t]->use(level, x, y, z, player) — deferred until we wire Tile.use.
      // For MVP, no tile-specific interaction.
    }
    if (item === null || item === undefined) return false;
    return false;
  }

  useItem(_player: Player, _level: Level, _item: unknown): boolean { return false; }

  createPlayer(_level: Level): Player | null { return null; }
  initPlayer(_player: Player): void {}
  adjustPlayer(_player: Player): void {}
  canHurtPlayer(): boolean { return false; }

  interact(_player: Player, _entity: Entity): void {}
  attack(_player: Player, _entity: Entity): void {}

  handleInventoryMouseClick(_containerId: number, _slotNum: number, _buttonNum: number, _player: Player): unknown { return null; }
  handleCloseInventory(_containerId: number, _player: Player): void {}

  isCreativeType(): boolean { return false; }
  isSurvivalType(): boolean { return false; }

  initAbilities(_abilities: Abilities): void {}

  releaseUsingItem(_player: Player): void {}
}
