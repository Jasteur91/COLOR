"use client";

import {
  clearGameHistory,
  computeHistoryStats,
  loadGameHistory,
  type GameHistoryEntry,
} from "@/lib/gameHistory";
import { useMemo, useState } from "react";

function formatMode(m: GameHistoryEntry["mode"]): string {
  if (m === "solo") return "Solo";
  if (m === "multi") return "Multijoueur";
  return "Daily";
}

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

type Props = {
  /** Incrémenter après une partie enregistrée pour recharger le stockage */
  refreshKey?: number;
  className?: string;
};

export function ScoreHistorySection({ refreshKey = 0, className = "" }: Props) {
  const [clearBust, setClearBust] = useState(0);
  const cacheKey = `${refreshKey}-${clearBust}`;

  const entries = useMemo(() => {
    void cacheKey;
    return loadGameHistory();
  }, [cacheKey]);

  const stats = computeHistoryStats(entries);

  const onClear = () => {
    if (typeof window === "undefined") return;
    if (!window.confirm("Effacer tout l’historique des parties sur cet appareil ?")) {
      return;
    }
    clearGameHistory();
    setClearBust((b) => b + 1);
  };

  return (
    <section
      id="score-historique"
      className={`scroll-mt-28 border-t border-[var(--border)] pt-16 transition-[border-color] duration-[350ms] ${className}`}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--accent)]">
            Performance
          </p>
          <h2 className="font-display mt-2 text-3xl font-bold tracking-tight text-[var(--foreground)] md:text-4xl">
            Score & historique
          </h2>
          <p className="mt-2 max-w-md text-sm text-[var(--muted)]">
            Parties enregistrées localement sur ce navigateur — rien n’est envoyé sur un
            serveur.
          </p>
        </div>
        {stats.gamesPlayed > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--muted)] transition-[border-color,color,background-color] duration-[350ms] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
          >
            Effacer l’historique
          </button>
        )}
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-6 backdrop-blur-sm transition-[border-color,background-color] duration-[350ms]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Meilleur total
          </p>
          <p className="font-display mt-2 text-4xl font-bold tabular-nums text-[var(--foreground)]">
            {stats.bestTotal !== null ? stats.bestTotal.toFixed(2) : "—"}
            {stats.bestMaxPossible !== null && (
              <span className="text-lg text-[var(--muted)]">/{stats.bestMaxPossible}</span>
            )}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-6 backdrop-blur-sm transition-[border-color,background-color] duration-[350ms]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Moyenne
          </p>
          <p className="font-display mt-2 text-4xl font-bold tabular-nums text-[var(--foreground)]">
            {stats.averageTotal !== null ? stats.averageTotal.toFixed(2) : "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-6 backdrop-blur-sm transition-[border-color,background-color] duration-[350ms]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Parties jouées
          </p>
          <p className="font-display mt-2 text-4xl font-bold tabular-nums text-[var(--foreground)]">
            {stats.gamesPlayed}
          </p>
        </div>
      </div>

      <div className="mt-10">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Dernières parties
        </h3>
        {stats.lastEntries.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-[var(--border)] px-6 py-10 text-center text-sm text-[var(--muted)]">
            Aucune partie enregistrée pour l’instant. Termine une partie pour voir ton
            score ici.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {stats.lastEntries.map((e) => (
              <li
                key={e.id}
                className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/60 px-4 py-3 backdrop-blur-sm transition-[border-color] duration-[350ms] sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-display text-xl font-bold tabular-nums text-[var(--foreground)]">
                    {e.total.toFixed(2)}
                    <span className="text-sm font-normal text-[var(--muted)]">
                      /{e.roundScores.length * 10}
                    </span>
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.15em] text-[var(--muted)]">
                    {formatMode(e.mode)} · {e.difficulty === "easy" ? "Facile" : "Difficile"} ·{" "}
                    {e.variant === "sound" ? "Son" : "Couleur"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                  <span className="font-mono text-[11px] text-[var(--muted)]">
                    {e.roundScores.map((s) => s.toFixed(1)).join(" · ")}
                  </span>
                  <span className="text-[11px] text-[var(--muted)]">
                    {e.playerName ? (
                      <span className="text-[var(--foreground)]">{e.playerName}</span>
                    ) : (
                      "—"
                    )}{" "}
                    · {formatDate(e.at)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
