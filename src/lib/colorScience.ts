/** HSB in game units: H 0–360, S 0–100, B 0–100 */

export type HSB = { h: number; s: number; b: number };

export type Lab = { L: number; a: number; b: number };

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function hsbToRgb(h: number, s: number, br: number): [number, number, number] {
  const H = ((h % 360) + 360) % 360;
  const S = clamp(s, 0, 100) / 100;
  const B = clamp(br, 0, 100) / 100;
  const c = B * S;
  const x = c * (1 - Math.abs(((H / 60) % 2) - 1));
  const m = B - c;
  let rp = 0,
    gp = 0,
    bp = 0;
  if (H < 60) [rp, gp, bp] = [c, x, 0];
  else if (H < 120) [rp, gp, bp] = [x, c, 0];
  else if (H < 180) [rp, gp, bp] = [0, c, x];
  else if (H < 240) [rp, gp, bp] = [0, x, c];
  else if (H < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return [
    Math.round((rp + m) * 255),
    Math.round((gp + m) * 255),
    Math.round((bp + m) * 255),
  ];
}

function linearize(v: number): number {
  v /= 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function rgbToLab(r: number, g: number, b: number): Lab {
  const R = linearize(r);
  const G = linearize(g);
  const B = linearize(b);

  let X = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
  let Y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  let Z = R * 0.0193339 + G * 0.119192 + B * 0.9503041;

  X /= 0.95047;
  Y /= 1.0;
  Z /= 1.08883;

  const f = (t: number) =>
    t > 0.008856 ? Math.pow(t, 1 / 3) : 7.787 * t + 16 / 116;

  const fx = f(X);
  const fy = f(Y);
  const fz = f(Z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function hsbToLab(hsb: HSB): Lab {
  const [r, g, b] = hsbToRgb(hsb.h, hsb.s, hsb.b);
  return rgbToLab(r, g, b);
}

export function deltaE76(l1: Lab, l2: Lab): number {
  return Math.sqrt(
    (l1.L - l2.L) ** 2 + (l1.a - l2.a) ** 2 + (l1.b - l2.b) ** 2
  );
}

export function hueDifferenceDeg(h1: number, h2: number): number {
  let d = Math.abs(h1 - h2) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

/** Per dialed.gg scoring pipeline (CIE76 + S-curve + hue recovery/penalty) */
export function scoreRound(target: HSB, guess: HSB): {
  score: number;
  deltaE: number;
  recovery: number;
  penalty: number;
  base: number;
} {
  const labT = hsbToLab(target);
  const labG = hsbToLab(guess);
  const dE = deltaE76(labT, labG);

  const base = 10 / (1 + Math.pow(dE / 38, 1.6));

  const hd = hueDifferenceDeg(target.h, guess.h);
  const avgSat = (target.s + guess.s) / 2;

  const hueAccuracy = Math.max(0, 1 - Math.pow(hd / 25, 1.5));
  const satWeight = Math.min(1, avgSat / 30);
  const recovery = (10 - base) * hueAccuracy * satWeight * 0.5;

  const huePenFactor = Math.max(0, (hd - 30) / 150);
  const satWeight2 = Math.min(1, avgSat / 40);
  const penalty = base * huePenFactor * satWeight2 * 0.4;

  const score = clamp(base + recovery - penalty, 0, 10);

  return {
    score,
    deltaE: dE,
    recovery,
    penalty,
    base,
  };
}

export function hsbToCss(hsb: HSB): string {
  const [r, g, b] = hsbToRgb(hsb.h, hsb.s, hsb.b);
  return `rgb(${r}, ${g}, ${b})`;
}

export function formatHsb(hsb: HSB): string {
  return `H${Math.round(hsb.h)} S${Math.round(hsb.s)} B${Math.round(hsb.b)}`;
}
