/**
 * Translation of: util/Random.h
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/util/Random.h
 *
 * Mersenne-Twister MT19937. Faithful port — the genrand_int32 algorithm
 * is the same; the constructor / setSeed / nextBoolean / nextFloat / nextInt
 * interfaces match the C++ class exactly so anything that calls Random
 * works identically in TS.
 */

const N = 624;
const M = 397;
const MATRIX_A = 0x9908b0df >>> 0;
const UPPER_MASK = 0x80000000 >>> 0;
const LOWER_MASK = 0x7fffffff >>> 0;

export class Random {
  private _seed = 0;
  private _mt: Uint32Array = new Uint32Array(N);
  private _mti = N + 1;
  private haveNextNextGaussian = false;
  private nextNextGaussian = 0;

  constructor(seed?: number) {
    if (seed === undefined) seed = Date.now();
    this.setSeed(seed);
  }

  setSeed(seed: number): void {
    this._seed = seed | 0;
    this._mti = N + 1;
    this.haveNextNextGaussian = false;
    this.nextNextGaussian = 0;
    this.init_genrand(seed | 0);
  }
  getSeed(): number { return this._seed; }

  nextBoolean(): boolean {
    return (this.genrand_int32() & 0x08000000) > 0;
  }
  nextFloat(): number { return this.genrand_real2(); }
  nextDouble(): number { return this.genrand_real2(); }
  nextInt(): number { return (this.genrand_int32() >> 1) | 0; }
  nextIntN(n: number): number { return (this.genrand_int32() % n) | 0; }
  nextLong(): number { return (this.genrand_int32() >> 1) | 0; }
  nextLongN(n: number): number { return (this.genrand_int32() % n) | 0; }

  nextGaussian(): number {
    if (this.haveNextNextGaussian) {
      this.haveNextNextGaussian = false;
      return this.nextNextGaussian;
    }
    let v1 = 0, v2 = 0, s = 0;
    do {
      v1 = 2 * this.nextFloat() - 1;
      v2 = 2 * this.nextFloat() - 1;
      s = v1 * v1 + v2 * v2;
    } while (s >= 1 || s === 0);
    const multiplier = Math.sqrt(-2 * Math.log(s) / s);
    this.nextNextGaussian = v2 * multiplier;
    this.haveNextNextGaussian = true;
    return v1 * multiplier;
  }

  // === Mersenne-Twister core (faithful port from C++) ===
  private init_genrand(s: number): void {
    this._mt[0] = s >>> 0;
    for (this._mti = 1; this._mti < N; this._mti++) {
      // 1812433253 * (mt[i-1] ^ (mt[i-1] >> 30)) + i, all 32-bit
      const prev = this._mt[this._mti - 1];
      const v = (Math.imul(1812433253, (prev ^ (prev >>> 30)) >>> 0) + this._mti) >>> 0;
      this._mt[this._mti] = v;
    }
  }

  private genrand_int32(): number {
    let y = 0;
    const mag01 = [0, MATRIX_A] as const;
    if (this._mti >= N) {
      let kk = 0;
      if (this._mti === N + 1) this.init_genrand(5489);
      for (kk = 0; kk < N - M; kk++) {
        y = ((this._mt[kk] & UPPER_MASK) | (this._mt[kk + 1] & LOWER_MASK)) >>> 0;
        this._mt[kk] = (this._mt[kk + M] ^ (y >>> 1) ^ mag01[y & 1]) >>> 0;
      }
      for (; kk < N - 1; kk++) {
        y = ((this._mt[kk] & UPPER_MASK) | (this._mt[kk + 1] & LOWER_MASK)) >>> 0;
        this._mt[kk] = (this._mt[kk + (M - N)] ^ (y >>> 1) ^ mag01[y & 1]) >>> 0;
      }
      y = ((this._mt[N - 1] & UPPER_MASK) | (this._mt[0] & LOWER_MASK)) >>> 0;
      this._mt[N - 1] = (this._mt[M - 1] ^ (y >>> 1) ^ mag01[y & 1]) >>> 0;
      this._mti = 0;
    }
    y = this._mt[this._mti++];
    y = (y ^ (y >>> 11)) >>> 0;
    y = (y ^ ((y << 7) & 0x9d2c5680)) >>> 0;
    y = (y ^ ((y << 15) & 0xefc60000)) >>> 0;
    y = (y ^ (y >>> 18)) >>> 0;
    return y >>> 0;
  }

  private genrand_real2(): number {
    return this.genrand_int32() * (1.0 / 4294967296.0);
  }

  // rrDiff helpers from Random.h
  rrDiff1(): number {
    const u = this.genrand_int32();
    const xx0 = (u & 0xffff) / 65536.0;
    const xx1 = ((u >> 16) & 0xffff) / 65536.0;
    return xx0 - xx1;
  }
  rrDiff2(): [number, number] {
    const u = this.genrand_int32();
    const xx0 = (u & 0xff) / 256.0;
    const xx1 = ((u >> 8) & 0xff) / 256.0;
    const yy0 = ((u >> 16) & 0xff) / 256.0;
    const yy1 = ((u >> 24) & 0xff) / 256.0;
    return [xx0 - xx1, yy0 - yy1];
  }
  rrDiff3(): [number, number, number] {
    const u = this.genrand_int32();
    const xx0 = (u & 0x1f) / 32.0;
    const xx1 = ((u >> 5) & 0x1f) / 32.0;
    const yy0 = ((u >> 10) & 0x1f) / 32.0;
    const yy1 = ((u >> 15) & 0x1f) / 32.0;
    const zz0 = ((u >> 20) & 0x1f) / 32.0;
    const zz1 = ((u >> 25) & 0x1f) / 32.0;
    return [xx0 - xx1, yy0 - yy1, zz0 - zz1];
  }
}
