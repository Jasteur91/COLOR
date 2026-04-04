/** Choix du nombre de manches (score max = 10 × manches). */
export const ROUNDS_OPTIONS = [5, 10] as const;
export type RoundsCount = (typeof ROUNDS_OPTIONS)[number];

export const DEFAULT_ROUNDS: RoundsCount = 10;

export function maxScoreForRounds(rounds: number): number {
  return rounds * 10;
}

/** Temps de mémorisation par manche — mode couleur. */
export const MEMORIZE_COLOR_ROUND_SECONDS = { easy: 5, hard: 3 } as const;
