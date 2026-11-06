/**
 * Translation of: util/Mth.h
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/util/Mth.h
 *
 * The C++ Mth namespace provides float-precision math helpers used everywhere
 * in the engine. Some are simple wrappers (sqrt, sin, cos), others add
 * missing helpers (floor for negative numbers, clamp, lerp, absMax).
 */

export const Mth = {
  PI: Math.PI,
  TWO_PI: 2 * Math.PI,
  RADDEG: 180 / Math.PI,
  DEGRAD: Math.PI / 180,

  // Mth.cpp uses table-lookup sin/cos for performance; in TS we use Math directly.
  // Same value range as Mth::sin / Mth::cos (degrees in 0..360 mapped via internal table).
  // The Mth version takes radians and returns sin/cos. We follow that.
  sin(x: number): number { return Math.sin(x); },
  cos(x: number): number { return Math.cos(x); },
  sqrt(x: number): number { return Math.sqrt(x); },
  invSqrt(x: number): number { return 1 / Math.sqrt(x); },

  // Mth::floor — int floor(float). Math.floor returns number; we cast via |0.
  floor(x: number): number { return Math.floor(x) | 0; },

  atan(x: number): number { return Math.atan(x); },
  atan2(dy: number, dx: number): number { return Math.atan2(dy, dx); },

  random(): number { return Math.random(); },
  randomN(n: number): number { return Math.floor(Math.random() * n) | 0; },

  abs(a: number): number { return Math.abs(a); },
  Min(a: number, b: number): number { return Math.min(a, b); },
  Max(a: number, b: number): number { return Math.max(a, b); },

  // overload int versions
  absI(a: number): number { return Math.abs(a) | 0; },
  MinI(a: number, b: number): number { return Math.min(a, b) | 0; },
  MaxI(a: number, b: number): number { return Math.max(a, b) | 0; },

  clamp(v: number, low: number, high: number): number {
    if (v < low) return low;
    if (v > high) return high;
    return v;
  },

  lerp(src: number, dst: number, alpha: number): number {
    return src + (dst - src) * alpha;
  },

  // float absDecrease(float value, float with, float min)
  absDecrease(value: number, with_: number, min: number): number {
    // From Mth.cpp: decrease magnitude of value by `with`, but never below `min`.
    if (value < 0) {
      const out = value + with_;
      return out < min ? min : out; // less negative
    } else {
      const out = value - with_;
      return out > -min ? -min : out; // can't be more negative than -min when positive side
    }
  },

  absMax(a: number, b: number): number {
    // The C++ Mth::absMax returns the larger of |a| and |b| but preserves sign.
    // Reading Mth.cpp:
    //   float absMax(float a, float b) {
    //     if (a < 0) a = -a;
    //     if (b < 0) b = -b;
    //     return a < b ? b : a;
    //   }
    const aa = Math.abs(a), bb = Math.abs(b);
    return aa < bb ? bb : aa;
  },

  absMaxSigned(a: number, b: number): number {
    // Returns whichever has the larger magnitude, with original sign.
    if (Math.abs(a) > Math.abs(b)) return a;
    return b;
  },

  intFloorDiv(a: number, b: number): number {
    // C++ integer division truncates toward zero. JS Math.floor rounds down.
    // For positive a, b: a / b === Math.floor(a/b). For mixed signs we need
    // truncation: intFloorDiv(-7, 2) = -3 (not -4).
    return Math.trunc(a / b) | 0;
  },
};
