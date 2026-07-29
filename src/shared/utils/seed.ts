/**
 * Seeded pseudo-random number generator (xoshiro128** variant).
 * Ensures deterministic randomness for procedural generation.
 * No Math.random() calls — all randomness flows from a single seed.
 */

export class SeededRandom {
  private state: Uint32Array;

  constructor(seed: number) {
    // SplitMix32 to initialize 128-bit state from a single seed
    this.state = new Uint32Array(4);
    let s = seed | 0;
    for (let i = 0; i < 4; i++) {
      s = (s + 0x9e3779b9) | 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
      z = (z ^ (z >>> 16)) >>> 0;
      this.state[i] = z;
    }
  }

  /** Returns a float in [0, 1) */
  next(): number {
    const result = this.rotl(this.state[1] * 5, 7) * 9;
    const t = this.state[1] << 9;

    this.state[2] ^= this.state[0];
    this.state[3] ^= this.state[1];
    this.state[1] ^= this.state[2];
    this.state[0] ^= this.state[3];
    this.state[2] ^= t;
    this.state[3] = this.rotl(this.state[3], 11);

    return ((result >>> 0) % 0x100000000) / 0x100000000;
  }

  /** Returns a float in [min, max) */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Returns an integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  private rotl(x: number, k: number): number {
    return ((x << k) | (x >>> (32 - k))) >>> 0;
  }
}
