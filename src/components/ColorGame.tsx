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

/** Temps pour mémoriser chaque couleur (une par une), puis reconstitution. */
const MEMORIZE_ROUND_SECONDS = { easy: 12, hard: 6 };

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
  /** 0–1 progression du temps de mémorisation pour la manche en cours */
  const [memProgress, setMemProgress] = useState(0);
  const [roundIndex, setRoundIndex] = useState(0);
  const [guess, setGuess] = useState<HSB>({ h: 180, s: 50, b: 50 });
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [soundOn, setSoundOn] = useState(true);
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
      startGame(cols);
      return;
    }
    if (mode === "solo") {
      const cols = generateColors(soloSeedRef.current);
      startGame(cols);
      return;
    }
    if (mode === "multi" && roomId.trim()) {
      const cols = generateColors(`room-${roomId.trim()}`);
      startGame(cols);
    }
  };

  const createRoom = () => {
    const id = generateRoomId();
    setRoomId(id);
    const cols = generateColors(`room-${id}`);
    startGame(cols);
  };

  const joinRoom = () => {
    const id = roomFromUrl || roomId.trim();
    if (!id) return;
    setRoomId(id);
    setPhase("name");
  };

  const startGame = (cols: HSB[]) => {
    setColors(cols);
    setRoundIndex(0);
    setRoundScores([]);
    setGuess({ h: 180, s: 50, b: 50 });
    setMemProgress(0);
    setPhase("memorize");
  };

  useEffect(() => {
    if (phase !== "memorize" || !colors[roundIndex]) return;
    const duration = MEMORIZE_ROUND_SECONDS[difficulty] * 1000;
    const start = Date.now();
    const tick = setInterval(() => {
      setMemProgress(Math.min(1, (Date.now() - start) / duration));
    }, 50);
    const done = setTimeout(() => {
      setPhase("recall");
      setGuess({ h: 180, s: 50, b: 50 });
      playBeep(soundOn, 440);
    }, duration);
    return () => {
      clearInterval(tick);
      clearTimeout(done);
    };
  }, [phase, roundIndex, difficulty, colors, soundOn]);

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
    setMemProgress(0);
    setPhase("memorize");
  }, [colors, roundIndex, guess, soundOn]);

  const totalScore = roundScores.reduce((a, b) => a + b, 0);

  const resetHome = () => {
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
    <div className="relative z-10 flex min-h-screen flex-col pointer-events-none">
      <header className="pointer-events-auto flex items-center justify-between gap-6 px-6 py-6 md:px-10 lg:px-14">
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
          <Link
            href="/lab"
            className="transition-colors duration-[350ms] hover:text-[var(--foreground)]"
          >
            Lab
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
        <section
          className="pointer-events-none mb-12 max-w-xl flex-1 lg:mb-0 lg:pt-8"
          id="jeu"
        >
          <div className="pointer-events-auto max-w-xl">
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

          {phase === "memorize" && colors[roundIndex] && (
            <MemorizeRoundPanel
              key={`mem-${roundIndex}`}
              color={colors[roundIndex]}
              roundIndex={roundIndex}
              memProgress={memProgress}
              difficulty={difficulty}
              onSkip={() => {
                setPhase("recall");
                setGuess({ h: 180, s: 50, b: 50 });
                playBeep(soundOn, 520);
              }}
            />
          )}

          {phase === "recall" && colors[roundIndex] && (
            <RecallPanel
              key={`rec-${roundIndex}`}
              roundIndex={roundIndex}
              guess={guess}
              onGuess={setGuess}
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
          </div>
        </section>

        <aside
          className="pointer-events-auto w-full max-w-md shrink-0 lg:sticky lg:top-24 lg:max-w-sm"
          id="modes"
        >
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/80 p-8 backdrop-blur-md transition-[background-color,border-color] duration-[350ms]">
            <p className="font-display text-4xl font-bold leading-none tracking-tight text-[var(--foreground)]">
              {phase === "memorize" || phase === "recall" ? roundIndex + 1 : "—"}
              <span className="text-[var(--muted)]">/5</span>
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {phase === "memorize"
                ? "Mémorise · compte à rebours"
                : phase === "recall"
                  ? "Reconstitue · curseurs"
                  : "Manche à manche"}
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

      <footer className="pointer-events-auto mt-auto border-t border-[var(--border)] px-6 py-8 text-center text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] transition-[border-color] duration-[350ms] md:px-10">
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
          · Score CIELAB + CIEDE2000 (règles avr. 2026) · Projet démo
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
        Cinq manches : pour chaque couleur, un temps pour la mémoriser avec le
        compte à rebours, puis tu la reconstitues en HSB — dans l’ordre, une à
        une. Le score suit la perception humaine.
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
        La même graine pour tous : partage le lien, chacun enchaîne les cinq
        couleurs dans le même ordre (mémorisation puis reconstitution) et compare
        les scores.
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

function RoundTimerRing({
  progress,
  size,
}: {
  progress: number;
  size: number;
}) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * progress;
  return (
    <svg
      width={size}
      height={size}
      className="shrink-0 text-[var(--accent)] [animation:timer-ring-pulse_2s_ease-in-out_infinite]"
      style={{ transform: "rotate(-90deg)" }}
      aria-hidden
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.15}
        strokeWidth={stroke}
        className="text-[var(--foreground)]"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        className="transition-[stroke-dashoffset] duration-75 ease-linear"
      />
    </svg>
  );
}

function RoundProgressDots({ roundIndex }: { roundIndex: number }) {
  return (
    <div className="flex justify-center gap-2" role="list" aria-label="Progression des manches">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          role="listitem"
          className={`h-2 rounded-full transition-all duration-500 ease-out ${
            i < roundIndex
              ? "w-8 bg-[var(--accent)]"
              : i === roundIndex
                ? "w-8 bg-[var(--foreground)] shadow-[0_0_12px_var(--accent-glow)]"
                : "w-2 bg-[var(--border)]"
          }`}
        />
      ))}
    </div>
  );
}

function MemorizeRoundPanel({
  color,
  roundIndex,
  memProgress,
  difficulty,
  onSkip,
}: {
  color: HSB;
  roundIndex: number;
  memProgress: number;
  difficulty: Difficulty;
  onSkip: () => void;
}) {
  const totalSec = MEMORIZE_ROUND_SECONDS[difficulty];
  const secondsLeft = Math.max(0, Math.ceil((1 - memProgress) * totalSec));

  return (
    <div className="game-panel-enter max-w-xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--accent)]">
        Mémorise
      </p>
      <h2 className="mt-2 font-display text-3xl font-bold text-[var(--foreground)] md:text-4xl">
        Couleur {roundIndex + 1} sur 5
      </h2>
      <p className="mt-3 text-sm text-[var(--muted)]">
        Imprime-la mentalement — ensuite tu la retrouveras sans l’aperçu.
      </p>

      <RoundProgressDots roundIndex={roundIndex} />

      <div className="mt-10 flex flex-col items-center gap-10 sm:flex-row sm:items-center sm:justify-between sm:gap-12">
        <div
          className="game-swatch-enter relative aspect-square w-full max-w-[min(100%,320px)] overflow-hidden rounded-3xl border border-[var(--border)] shadow-[0_24px_48px_-16px_rgba(0,0,0,0.35)] ring-1 ring-black/5 transition-[transform,box-shadow] duration-500 ease-out hover:scale-[1.01] hover:shadow-[0_28px_56px_-12px_rgba(0,0,0,0.4)] dark:shadow-[0_24px_48px_-16px_rgba(255,85,0,0.12)] dark:ring-white/10"
          style={{ backgroundColor: hsbToCss(color) }}
        >
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.12] to-transparent" />
          <span className="absolute bottom-4 left-4 rounded-full bg-black/35 px-3 py-1 font-mono text-[10px] font-medium text-white backdrop-blur-md">
            {formatHsb(color)}
          </span>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="relative flex items-center justify-center">
            <RoundTimerRing progress={memProgress} size={140} />
            <span className="absolute font-display text-4xl tabular-nums tracking-tight text-[var(--foreground)]">
              {secondsLeft}
              <span className="text-lg text-[var(--muted)]">s</span>
            </span>
          </div>
          <p className="max-w-[12rem] text-center text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
            Temps restant
          </p>
        </div>
      </div>

      <p className="mt-10 text-sm text-[var(--muted)]">
        {difficulty === "easy"
          ? "Plus de temps par couleur — idéal pour s’habituer au rythme."
          : "Rythme serré : comme sur le jeu original, une couleur après l’autre."}
      </p>
      <button
        type="button"
        onClick={onSkip}
        className="group mt-8 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)] transition-[color,transform] duration-[350ms] hover:text-[var(--foreground)]"
      >
        <span className="transition-transform duration-[350ms] group-hover:translate-x-0.5">
          J’ai retenu — passer à la reconstitution
        </span>
        <span aria-hidden>→</span>
      </button>
    </div>
  );
}

function RecallPanel({
  roundIndex,
  guess,
  onGuess,
  onSubmit,
}: {
  roundIndex: number;
  guess: HSB;
  onGuess: (h: HSB) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="game-panel-enter max-w-xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--accent)]">
        Reconstitue · manche {roundIndex + 1} / 5
      </p>
      <h2 className="mt-2 font-display text-3xl font-bold text-[var(--foreground)] md:text-4xl">
        Retrouve la teinte
      </h2>
      <p className="mt-4 max-w-lg text-sm leading-relaxed text-[var(--muted)]">
        Tu as mémorisé la couleur précédente : règle teinte, saturation et
        luminosité. La cible reste masquée — uniquement ton souvenir compte.
      </p>

      <RoundProgressDots roundIndex={roundIndex} />

      <div className="mt-10">
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Ta sélection
        </p>
        <ColorPicker value={guess} onChange={onGuess} />
      </div>

      <button
        type="button"
        onClick={onSubmit}
        className="group mt-12 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--foreground)] px-12 py-4 text-sm font-semibold uppercase tracking-[0.15em] text-[var(--background)] transition-[transform,box-shadow] duration-[350ms] hover:scale-[1.02] hover:shadow-[0_16px_32px_-8px_rgba(0,0,0,0.35)] dark:hover:shadow-[0_16px_32px_-8px_rgba(255,85,0,0.2)]"
      >
        Valider la manche
        <span
          aria-hidden
          className="transition-transform duration-[350ms] group-hover:translate-x-0.5"
        >
          →
        </span>
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
