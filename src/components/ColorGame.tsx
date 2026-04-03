"use client";

import type { HSB } from "@/lib/colorScience";
import { formatHsb, hsbToCss, scoreRound } from "@/lib/colorScience";
import { generateRoomId } from "@/lib/ids";
import {
  createSeededRandom,
  dailySeedString,
  hashString,
  randomHsb,
} from "@/lib/seedRandom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ColorPicker } from "./ColorPicker";

type Mode = "solo" | "multi" | "daily";
type Difficulty = "easy" | "hard";
type Phase =
  | "home"
  | "name"
  | "room"
  | "memorize"
  | "recall"
  | "results";

const MEMORIZE_SECONDS = { easy: 300, hard: 120 };
const DISPLAY_SWATCH_MS = { easy: 3500, hard: 1800 };

function generateColors(seedStr: string): HSB[] {
  const rng = createSeededRandom(hashString(seedStr));
  return Array.from({ length: 5 }, () => randomHsb(rng));
}

function playBeep(on: boolean, freq: number) {
  if (!on || typeof window === "undefined") return;
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = freq;
    g.gain.value = 0.08;
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, 120);
  } catch {
    /* ignore */
  }
}

export function ColorGame() {
  const router = useRouter();
  const search = useSearchParams();
  const roomFromUrl = search.get("room") ?? "";

  const [phase, setPhase] = useState<Phase>(() =>
    roomFromUrl ? "name" : "home"
  );
  const [mode, setMode] = useState<Mode>(() => (roomFromUrl ? "multi" : "solo"));
  const [difficulty, setDifficulty] = useState<Difficulty>("hard");
  const [playerName, setPlayerName] = useState("");
  const [roomId, setRoomId] = useState(() => roomFromUrl);
  const [colors, setColors] = useState<HSB[]>([]);
  const [memorizeLeft, setMemorizeLeft] = useState(0);
  const [roundIndex, setRoundIndex] = useState(0);
  const [guess, setGuess] = useState<HSB>({ h: 180, s: 50, b: 50 });
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soloSeedRef = useRef("");

  const startSolo = () => {
    soloSeedRef.current = `solo-${Date.now()}-${Math.random()}`;
    setMode("solo");
    setPhase("name");
  };

  const startDaily = () => {
    setMode("daily");
    setPhase("name");
  };

  const startMulti = () => {
    setMode("multi");
    setPhase("room");
  };

  const confirmName = () => {
    if (!playerName.trim()) return;
    if (mode === "daily") {
      const cols = generateColors(`daily-${dailySeedString()}`);
      setColors(cols);
      beginMemorize(cols);
      return;
    }
    if (mode === "solo") {
      const cols = generateColors(soloSeedRef.current);
      setColors(cols);
      beginMemorize(cols);
      return;
    }
    if (mode === "multi" && roomId.trim()) {
      const cols = generateColors(`room-${roomId.trim()}`);
      setColors(cols);
      beginMemorize(cols);
    }
  };

  const createRoom = () => {
    const id = generateRoomId();
    setRoomId(id);
    const cols = generateColors(`room-${id}`);
    beginMemorize(cols);
  };

  const joinRoom = () => {
    const id = roomFromUrl || roomId.trim();
    if (!id) return;
    setRoomId(id);
    setPhase("name");
  };

  const beginMemorize = (cols: HSB[]) => {
    setColors(cols);
    setPhase("memorize");
    resetMemorizeTimer();
  };

  const resetMemorizeTimer = () => {
    setMemorizeLeft(MEMORIZE_SECONDS[difficulty]);
    setRoundIndex(0);
    setRoundScores([]);
    setGuess({ h: 180, s: 50, b: 50 });
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setMemorizeLeft((s) => {
        if (s <= 1) {
          if (tickRef.current) clearInterval(tickRef.current);
          setPhase("recall");
          setRoundIndex(0);
          playBeep(soundOn, 440);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const submitRound = useCallback(() => {
    if (!colors[roundIndex]) return;
    const { score } = scoreRound(colors[roundIndex], guess);
    playBeep(soundOn, 600 + score * 40);
    setRoundScores((prev) => [...prev, score]);

    if (roundIndex >= 4) {
      setPhase("results");
      return;
    }
    setRoundIndex((i) => i + 1);
    setGuess({ h: 180, s: 50, b: 50 });
  }, [colors, roundIndex, guess, soundOn]);

  const totalScore = roundScores.reduce((a, b) => a + b, 0);

  const resetHome = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    setPhase("home");
    setColors([]);
    setRoundScores([]);
    setRoundIndex(0);
    setRoomId("");
    router.replace("/");
  };

  const shareUrl =
    typeof window !== "undefined" && roomId
      ? `${window.location.origin}/?room=${roomId}`
      : "";

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-6 px-6 py-6 md:px-10 lg:px-14">
        <button
          type="button"
          onClick={resetHome}
          className="font-display text-xl font-bold tracking-tight text-[var(--foreground)] transition-colors duration-[350ms] hover:text-[var(--accent)] md:text-2xl"
        >
          DIALED
        </button>
        <nav className="hidden items-center gap-8 text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--muted)] md:flex">
          <a href="#jeu" className="transition-colors duration-[350ms] hover:text-[var(--foreground)]">
            Jeu
          </a>
          <a href="#modes" className="transition-colors duration-[350ms] hover:text-[var(--foreground)]">
            Modes
          </a>
          <Link
            href="/scoring"
            className="transition-colors duration-[350ms] hover:text-[var(--foreground)]"
          >
            Score
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSoundOn((s) => !s)}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--muted)] transition-[background-color,border-color,color] duration-[350ms] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
          >
            Son {soundOn ? "on" : "off"}
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col px-6 pb-16 pt-4 md:px-10 lg:flex-row lg:items-start lg:gap-16 lg:px-14">
        <section className="mb-12 max-w-xl flex-1 lg:mb-0 lg:pt-8" id="jeu">
          {phase === "home" && (
            <HomePanel
              onSolo={startSolo}
              onMulti={startMulti}
              onDaily={startDaily}
              difficulty={difficulty}
              onDifficulty={setDifficulty}
            />
          )}

          {phase === "name" && (
            <NamePanel
              mode={mode}
              playerName={playerName}
              onName={setPlayerName}
              onBack={() => setPhase("home")}
              onContinue={confirmName}
              roomId={roomId}
            />
          )}

          {phase === "room" && (
            <RoomPanel
              roomId={roomId}
              onRoomId={setRoomId}
              onCreate={createRoom}
              onJoin={joinRoom}
              shareUrl={shareUrl}
              onBack={() => setPhase("home")}
            />
          )}

          {phase === "memorize" && (
            <MemorizePanel
              colors={colors}
              secondsLeft={memorizeLeft}
              difficulty={difficulty}
              onSkip={() => {
                if (tickRef.current) clearInterval(tickRef.current);
                setPhase("recall");
                setRoundIndex(0);
              }}
            />
          )}

          {phase === "recall" && colors[roundIndex] && (
            <RecallPanel
              key={roundIndex}
              roundIndex={roundIndex}
              target={colors[roundIndex]}
              guess={guess}
              onGuess={setGuess}
              difficulty={difficulty}
              onSubmit={submitRound}
            />
          )}

          {phase === "results" && (
            <ResultsPanel
              total={totalScore}
              roundScores={roundScores}
              playerName={playerName}
              mode={mode}
              roomId={roomId}
              onHome={resetHome}
            />
          )}
        </section>

        <aside
          className="w-full max-w-md shrink-0 lg:sticky lg:top-24 lg:max-w-sm"
          id="modes"
        >
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/80 p-8 backdrop-blur-md transition-[background-color,border-color] duration-[350ms]">
            <p className="font-display text-4xl font-bold leading-none tracking-tight text-[var(--foreground)]">
              {phase === "recall" ? roundIndex + 1 : "—"}
              <span className="text-[var(--muted)]">/5</span>
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Manche · mémoire des teintes
            </p>
            <div className="mt-8 space-y-4 border-t border-[var(--border)] pt-8">
              <Stat label="Mode" value={modeLabel(mode)} />
              <Stat label="Difficulté" value={difficulty === "easy" ? "Facile" : "Difficile"} />
              <Stat
                label="Score live"
                value={
                  roundScores.length
                    ? roundScores.map((s) => s.toFixed(1)).join(" · ")
                    : "—"
                }
              />
            </div>
          </div>
        </aside>
      </main>

      <footer className="mt-auto border-t border-[var(--border)] px-6 py-8 text-center text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] transition-[border-color] duration-[350ms] md:px-10">
        <p>
          Inspiré du principe de{" "}
          <a
            href="https://dialed.gg"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--foreground)] underline-offset-4 transition-colors duration-[350ms] hover:text-[var(--accent)] hover:underline"
          >
            dialed.gg
          </a>
          · Score perceptuel CIELAB · Projet démo
        </p>
      </footer>
    </div>
  );
}

function modeLabel(m: Mode) {
  if (m === "solo") return "Solo";
  if (m === "multi") return "Multijoueur";
  return "Daily";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="max-w-[60%] text-right font-medium text-[var(--foreground)]">
        {value}
      </span>
    </div>
  );
}

function HomePanel({
  onSolo,
  onMulti,
  onDaily,
  difficulty,
  onDifficulty,
}: {
  onSolo: () => void;
  onMulti: () => void;
  onDaily: () => void;
  difficulty: Difficulty;
  onDifficulty: (d: Difficulty) => void;
}) {
  return (
    <div className="opacity-100 transition-opacity duration-[400ms]">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.35em] text-[var(--accent)]">
        Mémoire des couleurs
      </p>
      <h1 className="font-display text-5xl font-bold leading-[0.95] tracking-tight text-[var(--foreground)] md:text-6xl lg:text-7xl">
        À quel point
        <br />
        tes souvenirs
        <br />
        sont justes ?
      </h1>
      <p className="mt-8 max-w-lg text-lg leading-relaxed text-[var(--muted)] transition-colors duration-[350ms]">
        Cinq couleurs affichées, puis tu les reconstitues en HSB. Le score suit
        la perception humaine — pas seulement les chiffres des curseurs.
      </p>

      <div className="mt-10 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onDifficulty("easy")}
          className={`rounded-full px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] transition-[background-color,color,transform] duration-[350ms] ${
            difficulty === "easy"
              ? "bg-[var(--foreground)] text-[var(--background)]"
              : "border border-[var(--border)] bg-transparent text-[var(--muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          Facile
        </button>
        <button
          type="button"
          onClick={() => onDifficulty("hard")}
          className={`rounded-full px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] transition-[background-color,color,transform] duration-[350ms] ${
            difficulty === "hard"
              ? "bg-[var(--foreground)] text-[var(--background)]"
              : "border border-[var(--border)] bg-transparent text-[var(--muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          Difficile
        </button>
      </div>

      <div className="mt-14 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={onSolo}
          className="group flex items-center justify-center gap-3 rounded-full bg-[var(--foreground)] px-10 py-4 text-sm font-semibold uppercase tracking-[0.15em] text-[var(--background)] transition-[transform,box-shadow] duration-[350ms] hover:scale-[1.02] hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.35)] dark:hover:shadow-[0_20px_40px_-12px_rgba(255,85,0,0.25)]"
        >
          Jouer solo
          <span aria-hidden className="transition-transform duration-[350ms] group-hover:translate-x-1">
            →
          </span>
        </button>
        <button
          type="button"
          onClick={onDaily}
          className="rounded-full border border-[var(--border)] px-10 py-4 text-sm font-semibold uppercase tracking-[0.15em] text-[var(--foreground)] transition-[background-color,border-color,transform] duration-[350ms] hover:border-[var(--accent)] hover:bg-[var(--surface-elevated)]"
        >
          Daily
        </button>
        <button
          type="button"
          onClick={onMulti}
          className="rounded-full border border-[var(--border)] px-10 py-4 text-sm font-semibold uppercase tracking-[0.15em] text-[var(--foreground)] transition-[background-color,border-color,transform] duration-[350ms] hover:border-[var(--accent)] hover:bg-[var(--surface-elevated)]"
        >
          Multijoueur
        </button>
      </div>
    </div>
  );
}

function NamePanel({
  mode,
  playerName,
  onName,
  onContinue,
  onBack,
  roomId,
}: {
  mode: Mode;
  playerName: string;
  onName: (s: string) => void;
  onContinue: () => void;
  onBack: () => void;
  roomId: string;
}) {
  return (
    <div className="opacity-100 transition-opacity duration-[400ms]">
      <button
        type="button"
        onClick={onBack}
        className="mb-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)] transition-colors duration-[350ms] hover:text-[var(--accent)]"
      >
        ← Retour
      </button>
      <h2 className="font-display text-4xl font-bold text-[var(--foreground)] md:text-5xl">
        {mode === "multi" ? "Rejoindre la partie" : "Ton pseudo"}
      </h2>
      {mode === "multi" && roomId && (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Salle <span className="font-mono text-[var(--foreground)]">{roomId}</span>
        </p>
      )}
      <input
        type="text"
        value={playerName}
        onChange={(e) => onName(e.target.value)}
        placeholder="Entre ton nom"
        className="mt-10 w-full max-w-md border-b-2 border-[var(--border)] bg-transparent py-3 text-xl text-[var(--foreground)] outline-none transition-[border-color] duration-[350ms] placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
        maxLength={24}
      />
      <button
        type="button"
        onClick={onContinue}
        disabled={!playerName.trim()}
        className="mt-10 rounded-full bg-[var(--foreground)] px-10 py-4 text-sm font-semibold uppercase tracking-[0.15em] text-[var(--background)] transition-[opacity,transform] duration-[350ms] enabled:hover:scale-[1.02] disabled:opacity-40"
      >
        Continuer
      </button>
    </div>
  );
}

function RoomPanel({
  roomId,
  onRoomId,
  onCreate,
  onJoin,
  shareUrl,
  onBack,
}: {
  roomId: string;
  onRoomId: (s: string) => void;
  onCreate: () => void;
  onJoin: () => void;
  shareUrl: string;
  onBack: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!shareUrl) return;
    void navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="opacity-100 transition-opacity duration-[400ms]">
      <button
        type="button"
        onClick={onBack}
        className="mb-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)] hover:text-[var(--accent)]"
      >
        ← Retour
      </button>
      <h2 className="font-display text-4xl font-bold text-[var(--foreground)] md:text-5xl">
        Multijoueur
      </h2>
      <p className="mt-6 max-w-lg text-[var(--muted)]">
        La même graine pour tous : partage le lien, chacun joue les mêmes cinq
        couleurs et compare les scores.
      </p>
      <div className="mt-10 flex flex-col gap-4 sm:flex-row">
        <button
          type="button"
          onClick={onCreate}
          className="rounded-full bg-[var(--foreground)] px-8 py-4 text-sm font-semibold uppercase tracking-[0.15em] text-[var(--background)] transition-transform duration-[350ms] hover:scale-[1.02]"
        >
          Créer une salle
        </button>
      </div>
      {roomId && (
        <div className="mt-10 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 transition-[border-color,background-color] duration-[350ms]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Lien à partager
          </p>
          <p className="mt-2 break-all font-mono text-sm text-[var(--foreground)]">
            {shareUrl}
          </p>
          <button
            type="button"
            onClick={copy}
            className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]"
          >
            {copied ? "Copié" : "Copier"}
          </button>
        </div>
      )}
      <div className="mt-12 border-t border-[var(--border)] pt-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Rejoindre une salle
        </p>
        <input
          type="text"
          value={roomId}
          onChange={(e) => onRoomId(e.target.value)}
          placeholder="ID de salle"
          className="mt-4 w-full max-w-md border-b-2 border-[var(--border)] bg-transparent py-3 font-mono text-lg outline-none transition-[border-color] duration-[350ms] focus:border-[var(--accent)]"
        />
        <button
          type="button"
          onClick={onJoin}
          className="mt-6 rounded-full border border-[var(--border)] px-8 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] transition-[border-color,background-color] duration-[350ms] hover:border-[var(--foreground)]"
        >
          Rejoindre
        </button>
      </div>
    </div>
  );
}

function MemorizePanel({
  colors,
  secondsLeft,
  difficulty,
  onSkip,
}: {
  colors: HSB[];
  secondsLeft: number;
  difficulty: Difficulty;
  onSkip: () => void;
}) {
  return (
    <div className="opacity-100 transition-opacity duration-[400ms]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--accent)]">
            Mémorise
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold text-[var(--foreground)] md:text-4xl">
            Les cinq couleurs
          </h2>
        </div>
        <div className="font-mono text-4xl tabular-nums text-[var(--foreground)]">
          {Math.floor(secondsLeft / 60)
            .toString()
            .padStart(2, "0")}
          :
          {(secondsLeft % 60).toString().padStart(2, "0")}
        </div>
      </div>
      <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {colors.map((c, i) => (
          <div
            key={i}
            className="group relative aspect-square overflow-hidden rounded-2xl border border-[var(--border)] shadow-lg transition-[transform] duration-[350ms] hover:scale-[1.02]"
            style={{ backgroundColor: hsbToCss(c) }}
          >
            <span className="absolute bottom-3 left-3 font-mono text-[10px] font-medium text-white/90 mix-blend-difference">
              {i + 1}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-10 max-w-xl text-sm text-[var(--muted)]">
        {difficulty === "easy"
          ? "Tu as jusqu’à cinq minutes pour les imprimer."
          : "Deux minutes — reste concentré."}
      </p>
      <button
        type="button"
        onClick={onSkip}
        className="mt-10 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)] transition-colors duration-[350ms] hover:text-[var(--foreground)]"
      >
        J’ai fini — passer à la reconstitution
      </button>
    </div>
  );
}

function RecallPanel({
  roundIndex,
  target,
  guess,
  onGuess,
  difficulty,
  onSubmit,
}: {
  roundIndex: number;
  target: HSB;
  guess: HSB;
  onGuess: (h: HSB) => void;
  difficulty: Difficulty;
  onSubmit: () => void;
}) {
  const [showSwatch, setShowSwatch] = useState(true);
  useEffect(() => {
    const t = setTimeout(
      () => setShowSwatch(false),
      DISPLAY_SWATCH_MS[difficulty]
    );
    return () => clearTimeout(t);
  }, [difficulty]);

  return (
    <div className="opacity-100 transition-opacity duration-[400ms]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--accent)]">
        Manche {roundIndex + 1} / 5
      </p>
      <h2 className="mt-2 font-display text-3xl font-bold text-[var(--foreground)]">
        Reconstitue la couleur
      </h2>
      <p className="mt-4 text-sm text-[var(--muted)]">
        {showSwatch
          ? difficulty === "easy"
            ? "Rappel — mémorise encore un instant."
            : "Aperçu rapide — puis les curseurs."
          : "Règle teinte, saturation, luminosité."}
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:items-start">
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Cible
          </p>
          <div
            className={`relative aspect-[4/3] w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] transition-opacity duration-[350ms] ${
              showSwatch ? "opacity-100" : "opacity-0"
            }`}
            style={{ backgroundColor: hsbToCss(target) }}
          >
            {showSwatch && (
              <span className="absolute bottom-4 left-4 rounded-full bg-black/40 px-3 py-1 font-mono text-[10px] text-white backdrop-blur-sm">
                {formatHsb(target)}
              </span>
            )}
          </div>
          {!showSwatch && (
            <p className="mt-4 font-mono text-xs text-[var(--muted)]">
              Indices masqués — à toi de jouer.
            </p>
          )}
        </div>
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Ta sélection
          </p>
          <ColorPicker value={guess} onChange={onGuess} />
        </div>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={showSwatch}
        className="mt-12 rounded-full bg-[var(--foreground)] px-12 py-4 text-sm font-semibold uppercase tracking-[0.15em] text-[var(--background)] transition-[opacity,transform] duration-[350ms] enabled:hover:scale-[1.02] disabled:opacity-40"
      >
        Valider la manche
      </button>
    </div>
  );
}

function ResultsPanel({
  total,
  roundScores,
  playerName,
  mode,
  roomId,
  onHome,
}: {
  total: number;
  roundScores: number[];
  playerName: string;
  mode: Mode;
  roomId: string;
  onHome: () => void;
}) {
  return (
    <div className="opacity-100 transition-opacity duration-[400ms]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--accent)]">
        Résultats
      </p>
      <h2 className="mt-2 font-display text-5xl font-bold text-[var(--foreground)]">
        {total.toFixed(2)}
        <span className="text-2xl text-[var(--muted)]">/50</span>
      </h2>
      <p className="mt-4 text-[var(--muted)]">
        {playerName && (
          <>
            Bien joué, <span className="text-[var(--foreground)]">{playerName}</span>
            .
          </>
        )}
      </p>
      <ul className="mt-10 space-y-2 font-mono text-sm">
        {roundScores.map((s, i) => (
          <li key={i} className="flex justify-between border-b border-[var(--border)] py-2">
            <span className="text-[var(--muted)]">Manche {i + 1}</span>
            <span>{s.toFixed(2)}</span>
          </li>
        ))}
      </ul>
      {mode === "multi" && roomId && (
        <p className="mt-8 text-sm text-[var(--muted)]">
          Compare avec tes amis sur la salle{" "}
          <span className="font-mono text-[var(--foreground)]">{roomId}</span> — même
          couleurs, meilleur score gagne.
        </p>
      )}
      <button
        type="button"
        onClick={onHome}
        className="mt-12 rounded-full border border-[var(--border)] px-10 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] transition-[background-color,border-color] duration-[350ms] hover:bg-[var(--surface-elevated)]"
      >
        Accueil
      </button>
    </div>
  );
}
