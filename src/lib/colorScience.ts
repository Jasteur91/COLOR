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

/**
 * CIEDE2000 (Sharma et al., 2005) — même famille que dialed.gg (avr. 2026).
 * Implémentation alignée sur la référence « The CIEDE2000 Color-Difference Formula ».
 */
export function deltaE2000(labStd: Lab, labSmp: Lab): number {
  const lStd = labStd.L;
  const aStd = labStd.a;
  const bStd = labStd.b;
  const lSmp = labSmp.L;
  const aSmp = labSmp.a;
  const bSmp = labSmp.b;

  const cStd = Math.sqrt(aStd * aStd + bStd * bStd);
  const cSmp = Math.sqrt(aSmp * aSmp + bSmp * bSmp);
  const cAvg = (cStd + cSmp) / 2;

  const G =
    0.5 *
    (1 -
      Math.sqrt(
        Math.pow(cAvg, 7) / (Math.pow(cAvg, 7) + Math.pow(25, 7))
      ));

  const apStd = aStd * (1 + G);
  const apSmp = aSmp * (1 + G);

  const cpStd = Math.sqrt(apStd * apStd + bStd * bStd);
  const cpSmp = Math.sqrt(apSmp * apSmp + bSmp * bSmp);

  let hpStd =
    Math.abs(apStd) + Math.abs(bStd) === 0
      ? 0
      : Math.atan2(bStd, apStd);
  hpStd += (hpStd < 0 ? 1 : 0) * 2 * Math.PI;

  let hpSmp =
    Math.abs(apSmp) + Math.abs(bSmp) === 0
      ? 0
      : Math.atan2(bSmp, apSmp);
  hpSmp += (hpSmp < 0 ? 1 : 0) * 2 * Math.PI;

  const dL = lSmp - lStd;
  const dC = cpSmp - cpStd;

  let dhp = cpStd * cpSmp === 0 ? 0 : hpSmp - hpStd;
  dhp -= (dhp > Math.PI ? 1 : 0) * 2 * Math.PI;
  dhp += (dhp < -Math.PI ? 1 : 0) * 2 * Math.PI;

  const dH = 2 * Math.sqrt(cpStd * cpSmp) * Math.sin(dhp / 2);

  const Lp = (lStd + lSmp) / 2;
  const Cp = (cpStd + cpSmp) / 2;

  let hp: number;
  if (cpStd * cpSmp === 0) {
    hp = hpStd + hpSmp;
  } else {
    hp = (hpStd + hpSmp) / 2;
    hp -= (Math.abs(hpStd - hpSmp) > Math.PI ? 1 : 0) * Math.PI;
    hp += (hp < 0 ? 1 : 0) * 2 * Math.PI;
  }

  const Lpm50 = Math.pow(Lp - 50, 2);
  const T =
    1 -
    0.17 * Math.cos(hp - Math.PI / 6) +
    0.24 * Math.cos(2 * hp) +
    0.32 * Math.cos(3 * hp + Math.PI / 30) -
    0.2 * Math.cos(4 * hp - (63 * Math.PI) / 180);

  const Sl = 1 + (0.015 * Lpm50) / Math.sqrt(20 + Lpm50);
  const Sc = 1 + 0.045 * Cp;
  const Sh = 1 + 0.015 * Cp * T;

  const deltaTheta =
    ((30 * Math.PI) / 180) *
    Math.exp(-Math.pow(((180 / Math.PI) * hp - 275) / 25, 2));
  const Rc =
    2 * Math.sqrt(Math.pow(Cp, 7) / (Math.pow(Cp, 7) + Math.pow(25, 7)));

  const Rt = -Math.sin(2 * deltaTheta) * Rc;

  const Kl = 1;
  const Kc = 1;
  const Kh = 1;

  return Math.sqrt(
    Math.pow(dL / (Kl * Sl), 2) +
      Math.pow(dC / (Kc * Sc), 2) +
      Math.pow(dH / (Kh * Sh), 2) +
      (((Rt * dC) / (Kc * Sc)) * dH) / (Kh * Sh)
  );
}

export function hueDifferenceDeg(h1: number, h2: number): number {
  let d = Math.abs(h1 - h2) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

/**
 * Pipeline dialed.gg (avr. 2026) : CIELAB + CIEDE2000, courbe en S, récupération / pénalité teinte.
 * Plusieurs manches, 0–10 par manche (total max = 10 × nombre de manches).
 */
export function scoreRound(target: HSB, guess: HSB): {
  score: number;
  deltaE: number;
  recovery: number;
  penalty: number;
  base: number;
} {
  const labT = hsbToLab(target);
  const labG = hsbToLab(guess);
  const dE = deltaE2000(labT, labG);

  const base = 10 / (1 + Math.pow(dE / 25.25, 1.55));

  const hd = hueDifferenceDeg(target.h, guess.h);
  const avgSat = (target.s + guess.s) / 2;

  const hueAccuracy = Math.max(0, 1 - Math.pow(hd / 25, 1.5));
  const satWeight = Math.min(1, avgSat / 30);
  const recovery = (10 - base) * hueAccuracy * satWeight * 0.25;

  const huePenFactor = Math.max(0, (hd - 30) / 150);
  const satWeight2 = Math.min(1, avgSat / 40);
  const penalty = base * huePenFactor * satWeight2 * 0.15;

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
