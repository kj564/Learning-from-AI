/**
 * Translation of: client/player/input/IBuildInput.h
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/client/player/input/IBuildInput.h
 */

import type { Player } from '../../../world/entity/player/Player';

export class BuildActionIntention {
  static readonly BAI_BUILD = 1;
  static readonly BAI_REMOVE = 2;
  static readonly BAI_FIRSTREMOVE = 4;
  static readonly BAI_ATTACK = 8;
  static readonly BAI_INTERACT = 16;

  constructor(public action = 0) {}

  isFirstRemove(): boolean { return (this.action & BuildActionIntention.BAI_FIRSTREMOVE) !== 0; }
  isRemoveContinue(): boolean { return (this.action & BuildActionIntention.BAI_REMOVE) !== 0; }
  isBuild(): boolean { return (this.action & BuildActionIntention.BAI_BUILD) !== 0; }
  isRemove(): boolean { return this.isFirstRemove() || this.isRemoveContinue(); }
  isAttack(): boolean { return (this.action & BuildActionIntention.BAI_ATTACK) !== 0; }
  isInteract(): boolean { return (this.action & BuildActionIntention.BAI_INTERACT) !== 0; }
}

export abstract class IBuildInput {
  onConfigChanged(_c: unknown): void {}
  tickBuild(_p: Player | null, _bai: BuildActionIntention): boolean { return false; }
}
