/**
 * In-repo seeded pseudo-random number generator (Mulberry32).
 *
 * Provides deterministic, reproducible random generation for invariant testing
 * with zero external dependencies.
 */

export function createPrng(seed: number): () => number {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(prng: () => number, min: number, max: number): number {
  return Math.floor(prng() * (max - min + 1)) + min;
}

export function randomChoice<T>(prng: () => number, items: readonly T[]): T {
  const index = Math.floor(prng() * items.length);
  const choice = items[index];
  if (choice === undefined) {
    throw new Error("Cannot choose from empty array");
  }
  return choice;
}

export function randomSample<T>(prng: () => number, items: readonly T[], count: number): T[] {
  const pool = [...items];
  const result: T[] = [];
  const n = Math.min(count, pool.length);

  for (let i = 0; i < n; i++) {
    const idx = Math.floor(prng() * pool.length);
    const item = pool.splice(idx, 1)[0];
    if (item !== undefined) {
      result.push(item);
    }
  }

  return result;
}
