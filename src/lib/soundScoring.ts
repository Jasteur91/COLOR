/**
 * Scoring Sound (réf. dialed.gg/sound-scoring, avr. 2026) — ERB-rate + double gaussienne.
 */

export type SoundDifficulty = "easy" | "hard";

export const SOUND_RANGE_HZ = {
  easy: { min: 80, max: 1200 },
  hard: { min: 60, max: 1400 },
} as const;

/** ERB-rate(f) = 21.4 * log10(1 + 0.00437 * f) */
export function erbRate(f: number): number {
  return 21.4 * Math.log10(1 + 0.00437 * f);
}

export function scoreSoundRound(
  targetHz: number,
  guessHz: number,
  difficulty: SoundDifficulty
): number {
  const { min: fMin, max: fMax } = SOUND_RANGE_HZ[difficulty];
  const erbT = erbRate(targetHz);
  const erbG = erbRate(guessHz);
  const denom = erbRate(fMax) - erbRate(fMin);
  if (denom <= 0) return 0;
  const dist = Math.abs(erbT - erbG) / denom;
  const sharp = 10 * Math.exp(-dist * dist * 3250);
  const gentle = 3 * Math.exp(-dist * dist * 130);
  return Math.min(10, Math.max(0, Math.max(sharp, gentle)));
}
