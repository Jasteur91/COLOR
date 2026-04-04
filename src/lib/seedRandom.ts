/** Mulberry32 — deterministic PRNG from 32-bit seed */

export function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h >>> 0) || 1;
}

export function createSeededRandom(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function dailySeedString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function randomHsb(rng: () => number): { h: number; s: number; b: number } {
  return {
    h: rng() * 360,
    s: 15 + rng() * 85,
    b: 15 + rng() * 85,
  };
}

export function randomFreqHz(
  rng: () => number,
  fMin: number,
  fMax: number
): number {
  return fMin + rng() * (fMax - fMin);
}
