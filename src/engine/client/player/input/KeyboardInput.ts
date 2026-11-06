/**
 * Translation of: client/player/input/KeyboardInput.h + KeyboardInput.cpp
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/client/player/input/KeyboardInput.{h,cpp}
 *
 * 7 keys: UP/DOWN/LEFT/RIGHT/JUMP/SNEAK/CRAFT. Mapped from Options.keyUp etc.
 *
 * tick() body is faithful from KeyboardInput.cpp: xa/ya computed from key flags,
 * sneaking scales by 0.3f. CRAFT triggers startCrafting (deferred until Inventory).
 */

import { IMoveInput } from './IMoveInput';
import type { Player } from '../../../world/entity/player/Player';

export interface OptionsKeyMap {
  keyUp: number;
  keyDown: number;
  keyLeft: number;
  keyRight: number;
  keyJump: number;
  keySneak: number;
  keyCraft: number;
}

export class KeyboardInput extends IMoveInput {
  static readonly NumKeys = 10;
  static readonly KEY_UP = 0;
  static readonly KEY_DOWN = 1;
  static readonly KEY_LEFT = 2;
  static readonly KEY_RIGHT = 3;
  static readonly KEY_JUMP = 4;
  static readonly KEY_SNEAK = 5;
  static readonly KEY_CRAFT = 6;

  protected keys: boolean[] = new Array(KeyboardInput.NumKeys).fill(false);
  protected options: OptionsKeyMap;

  constructor(options: OptionsKeyMap) {
    super();
    this.options = options;
  }

  // KeyboardInput.cpp setKey
  setKey(key: number, state: boolean): void {
    let id = -1;
    if (key === this.options.keyUp) id = KeyboardInput.KEY_UP;
    if (key === this.options.keyDown) id = KeyboardInput.KEY_DOWN;
    if (key === this.options.keyLeft) id = KeyboardInput.KEY_LEFT;
    if (key === this.options.keyRight) id = KeyboardInput.KEY_RIGHT;
    if (key === this.options.keyJump) id = KeyboardInput.KEY_JUMP;
    if (key === this.options.keySneak) id = KeyboardInput.KEY_SNEAK;
    if (key === this.options.keyCraft) id = KeyboardInput.KEY_CRAFT;
    if (id >= 0) this.keys[id] = state;
  }

  releaseAllKeys(): void {
    this.xa = 0;
    this.ya = 0;
    for (let i = 0; i < KeyboardInput.NumKeys; i++) this.keys[i] = false;
    this.wantUp = this.wantDown = false;
  }

  // KeyboardInput.cpp tick — verbatim
  tick(player: Player | null): void {
    this.xa = 0;
    this.ya = 0;
    if (this.keys[KeyboardInput.KEY_UP]) this.ya++;
    if (this.keys[KeyboardInput.KEY_DOWN]) this.ya--;
    if (this.keys[KeyboardInput.KEY_LEFT]) this.xa++;
    if (this.keys[KeyboardInput.KEY_RIGHT]) this.xa--;
    this.jumping = this.keys[KeyboardInput.KEY_JUMP];
    this.sneaking = this.keys[KeyboardInput.KEY_SNEAK];
    if (this.sneaking) {
      this.xa *= 0.3;
      this.ya *= 0.3;
    }
    // RPI build would set wantUp/wantDown from jumping/sneaking — we skip that
    // (handled by LocalPlayer fly-toggle logic instead).
    if (this.keys[KeyboardInput.KEY_CRAFT] && player) {
      player.startCrafting(player.x | 0, player.y | 0, player.z | 0, 2 /* Recipe::SIZE_2X2 */);
    }
  }
}
