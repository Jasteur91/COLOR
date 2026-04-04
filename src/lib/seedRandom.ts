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

function wrapHue360(h: number): number {
  let x = h % 360;
  if (x < 0) x += 360;
  return x;
}

type ColorPalette = {
  pickHue: (r: () => number) => number;
  sMin: number;
  sMax: number;
  bMin: number;
  bMax: number;
};

function band(
  hueStart: number,
  hueWidth: number,
  sMin: number,
  sMax: number,
  bMin: number,
  bMax: number
): ColorPalette {
  return {
    pickHue: (r) => wrapHue360(hueStart + r() * hueWidth),
    sMin,
    sMax,
    bMin,
    bMax,
  };
}

/**
 * Banque de teintes : nombreux secteurs sur le cercle + styles (S/B) différents.
 * Chaque entrée cible une zone de hue — pour une partie, on en pioche une par manche
 * sans remise (voir randomHsbGameSequence) afin d’écarter les manches trop proches en teinte.
 */
const COLOR_PALETTES: ColorPalette[] = (() => {
  const out: ColorPalette[] = [];

  // 30 secteurs ~12° + léger chevauchement → couvre tout le spectre avec des teintes nettement différentes
  for (let h = 0; h < 360; h += 12) {
    const k = (h / 12) | 0;
    const vivid = k % 3 === 0;
    const pastel = k % 3 === 1;
    const deep = k % 3 === 2;
    if (vivid) {
      out.push(band(h, 18, 52, 100, 28, 92));
    } else if (pastel) {
      out.push(band(h, 18, 18, 48, 72, 97));
    } else {
      out.push(band(h, 18, 62, 100, 14, 48));
    }
  }

  // Complémentaires / sauts de teinte (deux lobes opposés sur le cercle)
  out.push({
    pickHue: (r) => (r() < 0.5 ? r() * 28 : 178 + r() * 28),
    sMin: 48,
    sMax: 100,
    bMin: 30,
    bMax: 88,
  });
  out.push({
    pickHue: (r) => (r() < 0.5 ? 88 + r() * 32 : 268 + r() * 32),
    sMin: 40,
    sMax: 98,
    bMin: 26,
    bMax: 86,
  });
  out.push({
    pickHue: (r) => (r() < 0.5 ? 42 + r() * 36 : 222 + r() * 36),
    sMin: 45,
    sMax: 100,
    bMin: 22,
    bMax: 82,
  });

  // Triades approximatives (3 familles espacées ~120°)
  out.push({
    pickHue: (r) => {
      const z = Math.floor(r() * 3);
      const base = z === 0 ? 0 : z === 1 ? 122 : 242;
      return base + r() * 38;
    },
    sMin: 50,
    sMax: 100,
    bMin: 32,
    bMax: 90,
  });

  // Spectre libre (entraînement « toute teinte »)
  out.push({
    pickHue: (r) => r() * 360,
    sMin: 25,
    sMax: 100,
    bMin: 18,
    bMax: 95,
  });
  out.push({
    pickHue: (r) => r() * 360,
    sMin: 8,
    sMax: 38,
    bMin: 35,
    bMax: 88,
  });

  return out;
})();

function shuffleIndices(rng: () => number, len: number): number[] {
  const a = Array.from({ length: len }, (_, i) => i);
  for (let i = len - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

function sampleFromPalette(p: ColorPalette, rng: () => number) {
  const h = wrapHue360(p.pickHue(rng));
  const s = p.sMin + rng() * (p.sMax - p.sMin);
  const b = p.bMin + rng() * (p.bMax - p.bMin);
  return { h, s, b };
}

/**
 * Une couleur par manche : mélange la banque (ordre mélangé déterministe) pour éviter
 * deux manches consécutives sur la même famille de teinte quand c’est possible.
 */
export function randomHsbGameSequence(
  rng: () => number,
  roundCount: number
): { h: number; s: number; b: number }[] {
  const order = shuffleIndices(rng, COLOR_PALETTES.length);
  return Array.from({ length: roundCount }, (_, round) => {
    const paletteIndex = order[round % order.length]!;
    const p = COLOR_PALETTES[paletteIndex]!;
    return sampleFromPalette(p, rng);
  });
}

/**
 * Tirage HSB avec une palette prise au hasard (aperçus, tests).
 */
export function randomHsbFromPalettes(rng: () => number): {
  h: number;
  s: number;
  b: number;
} {
  const p = COLOR_PALETTES[Math.floor(rng() * COLOR_PALETTES.length)]!;
  return sampleFromPalette(p, rng);
}

/** @deprecated Préférer randomHsbFromPalettes pour le jeu. */
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

/** Tirage uniforme en échelle log — plus de densité perceptuelle sur toute la plage Hz. */
export function randomFreqHzLog(rng: () => number, fMin: number, fMax: number): number {
  const lo = Math.max(20, fMin);
  const hi = Math.max(lo * 1.001, fMax);
  const t = rng();
  return lo * Math.pow(hi / lo, t);
}
