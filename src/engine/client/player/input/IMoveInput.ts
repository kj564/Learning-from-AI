/**
 * Translation of: client/player/input/IMoveInput.h
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/client/player/input/IMoveInput.h
 */

import type { Player } from '../../../world/entity/player/Player';

export abstract class IMoveInput {
  xa = 0;
  ya = 0;
  wasJumping = false;
  jumping = false;
  sneaking = false;
  wantUp = false;
  wantDown = false;
  isChangingFlightHeight = false;

  tick(_player: Player | null): void {}
  render(_a: number): void {}
  setKey(_eventKey: number, _eventKeyState: boolean): void {}
  releaseAllKeys(): void {}
  onConfigChanged(_c: unknown): void {}
}
