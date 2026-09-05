/**
 * Deterministic seeded RNG (mulberry32).
 *
 * RULE: any randomness affecting world content must go through this class so
 * the same seed always reproduces the same world. Math.random() is banned
 * from world generation.
 */
export class SeededRng {
  private state: number;

  public constructor(seed: number) {
    // Force a non-zero 32-bit state.
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  /** Next float in [0, 1). */
  public next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Next float in [min, max). */
  public range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Next integer in [min, max] (inclusive). */
  public int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** Pick a random element from a non-empty array. */
  public pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('SeededRng.pick: empty array');
    }
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /** True with probability p (0..1). */
  public chance(p: number): boolean {
    return this.next() < p;
  }

  /** Create an independent child stream derived from this RNG. */
  public fork(salt: number): SeededRng {
    // Mix current state with the salt for an independent deterministic stream.
    const mixed = (Math.imul(this.state ^ salt, 0x85ebca6b) >>> 0) || 0x9e3779b9;
    return new SeededRng(mixed);
  }
}
