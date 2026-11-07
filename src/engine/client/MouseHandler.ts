/**
 * Translation of: client/MouseHandler.{h,cpp}
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/client/MouseHandler.{h,cpp}
 *
 * MouseHandler bridges raw mouse state to the GameRenderer's turn-input. The
 * C++ class keeps a toSkip counter for the first few mouse events (so the
 * initial jump from center-of-screen doesn't snap the camera). In TS we don't
 * have that artifact because we only feed deltas from pointer-lock mousemove
 * events, which start at zero.
 */

import { ITurnInput } from './player/input/ITurnInput';

export class MouseHandler {
  xd = 0;
  yd = 0;
  private toSkip = 0;
  private _turnInput: ITurnInput | null = null;

  constructor(turnInput?: ITurnInput) {
    if (turnInput) this._turnInput = turnInput;
  }

  setTurnInput(turnInput: ITurnInput): void { this._turnInput = turnInput; }

  grab(): void { this.toSkip = 0; }
  release(): void { this.toSkip = 100; }

  // Called by the engine with raw movementX / movementY from the mousemove event.
  feed(dx: number, dy: number): void {
    if (this.toSkip > 0) { this.toSkip--; return; }
    this.xd = dx;
    this.yd = dy;
    if (this._turnInput && 'feedDelta' in this._turnInput) {
      (this._turnInput as unknown as { feedDelta: (dx: number, dy: number) => void }).feedDelta(dx, dy);
    }
  }

  poll(): void {
    // C++ MouseHandler::poll calls _turnInput->getTurnDelta() and stores to xd/yd.
    // For our purposes the GameRenderer reads xd/yd directly via this handler.
  }
}
