/**
 * Translation of: world/entity/ai/control/MoveControl.{h,cpp} — verbatim
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/entity/ai/control/MoveControl.{h,cpp}
 *
 * MoveControl drives a Mob toward a target position, turning + jumping
 * when it needs to step up.
 *
 * Constants from MoveControl.cpp:
 *   MAX_TURN = 30 (degrees per tick)
 *   MIN_SPEED = 0.0005
 *   MIN_SPEED_SQR = 0.0005^2
 */

import { Mth } from '../../../../util/Mth';
import type { Mob } from '../../Mob';

export class MoveControl {
  static readonly MAX_TURN = 30;
  static readonly MIN_SPEED = 0.0005;
  static readonly MIN_SPEED_SQR = MoveControl.MIN_SPEED * MoveControl.MIN_SPEED;

  private mob: Mob;
  private wantedX: number;
  private wantedY: number;
  private wantedZ: number;
  private speed = 0;
  private _hasWanted = false;

  constructor(mob: Mob) {
    this.mob = mob;
    this.wantedX = mob.x;
    this.wantedY = mob.y;
    this.wantedZ = mob.z;
  }

  hasWanted(): boolean { return this._hasWanted; }
  getSpeed(): number { return this.speed; }

  setWantedPosition(x: number, y: number, z: number, speed: number): void {
    this.wantedX = x;
    this.wantedY = y;
    this.wantedZ = z;
    this.speed = speed;
    this._hasWanted = true;
  }

  // MoveControl.cpp:46 — tick — verbatim
  tick(): void {
    this.mob.setYya(0);
    if (!this._hasWanted) return;
    this._hasWanted = false;

    const yFloor = Mth.floor(this.mob.bb.y0 + 0.5);
    const xd = this.wantedX - this.mob.x;
    const zd = this.wantedZ - this.mob.z;
    const yd = this.wantedY - yFloor;
    const dd = xd * xd + yd * yd + zd * zd;
    if (dd < MoveControl.MIN_SPEED_SQR) return;

    const yRotD = Math.atan2(zd, xd) * 180 / Math.PI - 90;
    this.mob.yRot = this.rotlerp(this.mob.yRot, yRotD, MoveControl.MAX_TURN);
    this.mob.setSpeed(this.speed);

    if (yd > 0 && xd * xd + zd * zd < 1) {
      this.mob.setJumping(true);
    }
  }

  // MoveControl.cpp:67 — rotlerp — verbatim
  private rotlerp(a: number, b: number, max: number): number {
    let diff = b - a;
    while (diff < -180) diff += 360;
    while (diff >= 180) diff -= 360;
    if (diff > max) diff = max;
    if (diff < -max) diff = -max;
    return a + diff;
  }
}

/**
 * Translation of: world/entity/ai/control/JumpControl.h — verbatim (header-only)
 */
export class JumpControl {
  private mob: Mob;
  private _jump = false;

  constructor(mob: Mob) { this.mob = mob; }

  jump(): void { this._jump = true; }

  // JumpControl.h tick — verbatim
  tick(): void {
    this.mob.setJumping(this._jump);
    this._jump = false;
  }
}

/**
 * Translation of: world/entity/ai/sensing/Sensing.h — verbatim (header-only)
 *
 * Sensing caches which entities a Mob can/can't see during a tick cycle.
 */
import type { Entity } from '../../Entity';

export class Sensing {
  private mob: Mob;
  private seen: Set<Entity> = new Set();
  private unseen: Set<Entity> = new Set();

  constructor(mob: Mob) { this.mob = mob; }

  // Sensing.h tick — verbatim
  tick(): void {
    this.seen.clear();
    this.unseen.clear();
  }

  // Sensing.h canSee — verbatim
  canSee(target: Entity): boolean {
    if (this.seen.has(target)) return true;
    if (this.unseen.has(target)) return false;
    const canSee = this.mob.canSee(target);
    if (canSee) this.seen.add(target);
    else this.unseen.add(target);
    return canSee;
  }
}
