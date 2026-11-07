/**
 * Translation of: client/player/input/ITurnInput.h
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/client/player/input/ITurnInput.h
 */

export class TurnDelta {
  constructor(public x: number, public y: number) {}
}

export abstract class ITurnInput {
  private _lastTime = -1.0;

  abstract getTurnDelta(): TurnDelta;
  onConfigChanged(_c: unknown): void {}

  protected getDeltaTime(): number {
    if (this._lastTime === -1.0) this._lastTime = performance.now() / 1000;
    const now = performance.now() / 1000;
    const dt = now - this._lastTime;
    this._lastTime = now;
    return dt;
  }

  protected static linearTransform(value: number, deadZone: number, scale = 1.0, limit1 = false): number {
    const deadSigned = value >= 0 ? deadZone : -deadZone;
    if (Math.abs(deadSigned) >= Math.abs(value)) return 0;
    let ret = (value - deadSigned) * scale;
    if (limit1 && Math.abs(ret) > 1) ret /= Math.abs(ret);
    return ret;
  }
}
