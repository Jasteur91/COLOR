/** Nombre de manches par partie (couleur ou son). */
export const ROUNDS_PER_GAME = 10;

/** Score max = 10 pts × manches. */
export const MAX_GAME_SCORE = ROUNDS_PER_GAME * 10;

/** Temps de mémorisation par manche — mode couleur. */
export const MEMORIZE_COLOR_ROUND_SECONDS = { easy: 5, hard: 3 } as const;
