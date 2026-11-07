/**
 * Translation of: client/player/input/IInputHolder.h
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/client/player/input/IInputHolder.h
 *
 * Three input channels per IInputHolder.h comment:
 *   getMoveInput()  — d-pad / WASD          (consumed in player.tick)
 *   getTurnInput()  — mouse drag            (consumed in GameRenderer::render)
 *   getBuildInput() — tap to place/dig      (consumed in Minecraft::handleBuildAction)
 *
 * This is the seam where one-input-changes-everything breaks: a bug in one
 * leaves the other two working. We preserve the separation here.
 */

import { IMoveInput } from './IMoveInput';
import { ITurnInput } from './ITurnInput';
import { IBuildInput } from './IBuildInput';

export abstract class IInputHolder {
  mousex = 0;
  mousey = 0;
  alpha = 0;

  abstract getMoveInput(): IMoveInput;
  abstract getTurnInput(): ITurnInput;
  abstract getBuildInput(): IBuildInput;

  onConfigChanged(c: unknown): void {
    this.getMoveInput().onConfigChanged(c);
    this.getTurnInput().onConfigChanged(c);
    this.getBuildInput().onConfigChanged(c);
  }
}

export class CustomInputHolder extends IInputHolder {
  private _move: IMoveInput;
  private _turn: ITurnInput;
  private _build: IBuildInput;

  constructor(move: IMoveInput, turn: ITurnInput, build: IBuildInput) {
    super();
    this._move = move;
    this._turn = turn;
    this._build = build;
  }
  getMoveInput(): IMoveInput { return this._move; }
  getTurnInput(): ITurnInput { return this._turn; }
  getBuildInput(): IBuildInput { return this._build; }
}
