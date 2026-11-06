/**
 * Translation of: client/player/input/MouseBuildInput.h
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/client/player/input/MouseBuildInput.h
 *
 * Left button held → BAI_REMOVE | BAI_ATTACK (continuous).
 * Right button held → BAI_BUILD | BAI_INTERACT on the first tick only,
 * with a 10-tick build-delay anti-repeat window (buildDelayTicks).
 */

import { IBuildInput, BuildActionIntention } from './IBuildInput';
import type { Player } from '../../../world/entity/player/Player';

export interface MouseButtonState {
  ACTION_LEFT: number;
  ACTION_RIGHT: number;
}

export class MouseBuildInput extends IBuildInput {
  private buildDelayTicks = 10;
  private buildHoldTicks = 0;
  private leftButton = false;
  private rightButton = false;

  setButtonStates(left: boolean, right: boolean): void {
    this.leftButton = left;
    this.rightButton = right;
  }

  // MouseBuildInput.cpp tickBuild — verbatim
  tickBuild(_p: Player | null, bai: BuildActionIntention): boolean {
    if (this.leftButton) {
      bai.action = BuildActionIntention.BAI_REMOVE | BuildActionIntention.BAI_ATTACK;
      return true;
    }
    if (this.rightButton) {
      if (this.buildHoldTicks >= this.buildDelayTicks) this.buildHoldTicks = 0;
      if (++this.buildHoldTicks === 1) {
        bai.action = BuildActionIntention.BAI_BUILD | BuildActionIntention.BAI_INTERACT;
        return true;
      }
    } else {
      this.buildHoldTicks = 0;
    }
    return false;
  }
}
