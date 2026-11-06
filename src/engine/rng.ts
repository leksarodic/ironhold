/** Deterministic xorshift32 RNG so loot rolls replay identically on every peer. */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // Guard against a zero state, which would lock the generator.
    this.state = (seed | 0) || 0x9e3779b9;
  }

  next(): number {
    let x = this.state;
    x ^= x << 13;
    x |= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x |= 0;
    this.state = x;
    return (x >>> 0) / 0x100000000;
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick called with empty list');
    return items[Math.floor(this.next() * items.length)] as T;
  }
}

/** Cheap string hash used to derive seeds from room codes / names. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
