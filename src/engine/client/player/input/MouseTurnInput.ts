/**
 * Translation of: client/player/input/MouseTurnInput.h
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/client/player/input/MouseTurnInput.h
 *
 * Two modes (matches the C++ class): MODE_DELTA uses raw mouse dx/dy (pointer lock),
 * MODE_OFFSET uses the offset of cursor from screen center.
 *
 * We only use MODE_DELTA in the browser because pointer-lock gives us raw deltas.
 */

import { ITurnInput, TurnDelta } from './ITurnInput';

export class MouseTurnInput extends ITurnInput {
  static readonly MODE_OFFSET = 1;
  static readonly MODE_DELTA = 2;

  mode: number;
  private _centerX = 0;
  private _centerY = 0;
  private _mouseDX = 0;
  private _mouseDY = 0;

  constructor(mode: number, centerX: number, centerY: number) {
    super();
    this.mode = mode;
    this._centerX = centerX;
    this._centerY = centerY;
  }

  // Called from MouseHandler.poll() with the accumulated movementX/Y.
  feedDelta(dx: number, dy: number): void {
    this._mouseDX = dx;
    this._mouseDY = dy;
  }

  onConfigChanged(config: { width: number; height: number }): void {
    this._centerX = config.width * 0.5;
    this._centerY = config.height * 0.5;
  }

  getTurnDelta(): TurnDelta {
    let dx = 0, dy = 0;
    if (this.mode === MouseTurnInput.MODE_DELTA) {
      dx = this._mouseDX;
      dy = this._mouseDY;
      // Consume — one shot per frame.
      this._mouseDX = 0;
      this._mouseDY = 0;
    } else if (this.mode === MouseTurnInput.MODE_OFFSET) {
      const dt = this.getDeltaTime();
      // The C++ uses Mouse::getX() - centerX; we don't track absolute mouse
      // in TS — defer OFFSET mode.
      void dt;
    }
    return new TurnDelta(dx, dy);
  }
}
