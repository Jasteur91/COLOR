export type GameMode = "solo" | "multi" | "daily";
export type GameDifficulty = "easy" | "hard";
export type GameVariant = "color" | "sound";

export type GameHistoryEntry = {
  id: string;
  at: number;
  total: number;
  roundScores: number[];
  mode: GameMode;
  difficulty: GameDifficulty;
  playerName: string;
  /** défaut color pour entrées anciennes */
  variant?: GameVariant;
};

const STORAGE_KEY = "dialed-color-game-history";
const MAX_ENTRIES = 40;

function parseStored(raw: string | null): GameHistoryEntry[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(
      (e): e is GameHistoryEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as GameHistoryEntry).id === "string" &&
        typeof (e as GameHistoryEntry).at === "number" &&
        typeof (e as GameHistoryEntry).total === "number"
    );
  } catch {
    return [];
  }
}

export function loadGameHistory(): GameHistoryEntry[] {
  if (typeof window === "undefined") return [];
  return parseStored(localStorage.getItem(STORAGE_KEY));
}

export function saveGameHistory(entries: GameHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

export function appendGameHistory(entry: Omit<GameHistoryEntry, "id" | "at">): void {
  const prev = loadGameHistory();
  const next: GameHistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    at: Date.now(),
  };
  saveGameHistory([next, ...prev]);
}

export function clearGameHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export type GameHistoryStats = {
  gamesPlayed: number;
  bestTotal: number | null;
  /** Plafond du score pour la meilleure partie (10 × nombre de manches). */
  bestMaxPossible: number | null;
  averageTotal: number | null;
  lastEntries: GameHistoryEntry[];
};

export function computeHistoryStats(entries: GameHistoryEntry[]): GameHistoryStats {
  const gamesPlayed = entries.length;
  if (gamesPlayed === 0) {
    return {
      gamesPlayed: 0,
      bestTotal: null,
      bestMaxPossible: null,
      averageTotal: null,
      lastEntries: [],
    };
  }
  const totals = entries.map((e) => e.total);
  const bestTotal = Math.max(...totals);
  const bestEntry = entries.reduce((a, b) => (a.total >= b.total ? a : b));
  const bestMaxPossible = bestEntry.roundScores.length * 10;
  const averageTotal = totals.reduce((a, b) => a + b, 0) / totals.length;
  return {
    gamesPlayed,
    bestTotal,
    bestMaxPossible,
    averageTotal,
    lastEntries: entries.slice(0, 12),
  };
}
