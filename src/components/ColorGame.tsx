"use client";

import type { HSB } from "@/lib/colorScience";
import { formatHsb, hsbToCss, scoreRound } from "@/lib/colorScience";
import { generateRoomId } from "@/lib/ids";
import { appendGameHistory, type GameVariant as HistoryGameVariant } from "@/lib/gameHistory";
import {
  clearRoomSignals,
  isRoomHost,
  readGameStartPayload,
  readLobbyPlayers,
  setRoomHost,
  signalGameStart,
  subscribeLobbyAndGo,
  upsertLobbyPlayer,
  type LobbyPlayer,
} from "@/lib/roomLobby";
import {
  createSeededRandom,
  dailySeedString,
  hashString,
  randomFreqHz,
  randomHsb,
} from "@/lib/seedRandom";
import { SOUND_RANGE_HZ, scoreSoundRound } from "@/lib/soundScoring";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { ColorPicker } from "./ColorPicker";
import { FrequencyPicker } from "./FrequencyPicker";

const ScoreHistorySection = dynamic(
  () =>
    import("./ScoreHistorySection").then((m) => ({ default: m.ScoreHistorySection })),
  { ssr: false, loading: () => null }
);

type Mode = "solo" | "multi" | "daily";
type Difficulty = "easy" | "hard";
type GameVariant = "color" | "sound";
type Phase =
  | "home"
  | "name"
  | "room"
  | "lobby"
  | "memorize"
  | "recall"
  | "results";

/** Temps pour mémoriser chaque couleur (une par une), puis reconstitution. */
const MEMORIZE_ROUND_SECONDS = { easy: 12, hard: 6 };

function generateColors(seedStr: string): HSB[] {
  const rng = createSeededRandom(hashString(seedStr));
  return Array.from({ length: 5 }, () => randomHsb(rng));
}

function generateSoundTargets(seedStr: string, difficulty: Difficulty): number[] {
  const rng = createSeededRandom(hashString(seedStr));
  const { min, max } = SOUND_RANGE_HZ[difficulty];
  return Array.from({ length: 5 }, () => randomFreqHz(rng, min, max));
}

function playTone(
  on: boolean,
  freq: number,
  durationMs = 200,
  gain = 0.1
) {
  if (!on || typeof window === "undefined") return;
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = freq;
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.04);
    g.gain.linearRampToValueAtTime(0.001, t0 + durationMs / 1000);
    o.start(t0);
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, durationMs + 100);
  } catch {
    /* ignore */
  }
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
  const [gameVariant, setGameVariant] = useState<GameVariant>("color");
  const [difficulty, setDifficulty] = useState<Difficulty>("hard");
  const [playerName, setPlayerName] = useState("");
  const [roomId, setRoomId] = useState(() => roomFromUrl);
  const [colors, setColors] = useState<HSB[]>([]);
  const [targetsHz, setTargetsHz] = useState<number[]>([]);
  /** 0–1 progression du temps de mémorisation pour la manche en cours */
  const [memProgress, setMemProgress] = useState(0);
  const [roundIndex, setRoundIndex] = useState(0);
  const [guess, setGuess] = useState<HSB>({ h: 180, s: 50, b: 50 });
  const [guessFreq, setGuessFreq] = useState(440);
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [roundGuessesColor, setRoundGuessesColor] = useState<HSB[]>([]);
  const [roundGuessesFreq, setRoundGuessesFreq] = useState<number[]>([]);
  const [phaseBridge, setPhaseBridge] = useState(false);
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const soloSeedRef = useRef("");
  const beginPlayRef = useRef<(v: GameVariant) => void>(() => {});
  const phaseRef = useRef<Phase>(phase);

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

  const beginPlay = useCallback(
    (v: GameVariant) => {
      setRoundGuessesColor([]);
      setRoundGuessesFreq([]);
      setRoundIndex(0);
      setRoundScores([]);
      setMemProgress(0);
      setPhaseBridge(false);
      if (v === "color") {
        const seed =
          mode === "daily"
            ? `daily-${dailySeedString()}`
            : mode === "multi"
              ? `room-${roomId.trim()}`
              : soloSeedRef.current;
        setColors(generateColors(seed));
        setTargetsHz([]);
        setGuess({ h: 180, s: 50, b: 50 });
      } else {
        const seedBase =
          mode === "daily"
            ? `daily-${dailySeedString()}`
            : mode === "multi"
              ? `room-${roomId.trim()}`
              : soloSeedRef.current;
        setColors([]);
        setTargetsHz(generateSoundTargets(`${seedBase}-sound`, difficulty));
        const { min, max } = SOUND_RANGE_HZ[difficulty];
        setGuessFreq(Math.round((min + max) / 2));
        setGuess({ h: 180, s: 50, b: 50 });
      }
      setPhase("memorize");
    },
    [mode, roomId, difficulty]
  );

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    beginPlayRef.current = beginPlay;
  }, [beginPlay]);

  const confirmName = () => {
    if (!playerName.trim()) return;
    if (mode === "daily") {
      beginPlay(gameVariant);
      return;
    }
    if (mode === "solo") {
      beginPlay(gameVariant);
      return;
    }
    if (mode === "multi" && roomId.trim()) {
      upsertLobbyPlayer(roomId.trim(), playerName.trim());
      setPhase("lobby");
    }
  };

  const createRoom = () => {
    const id = generateRoomId();
    setRoomId(id);
    setRoomHost(id);
    setPhase("name");
  };

  const joinRoom = () => {
    const id = roomFromUrl || roomId.trim();
    if (!id) return;
    setRoomId(id);
    setPhase("name");
  };

  useEffect(() => {
    if (phase !== "lobby" || !roomId.trim()) return;
    const rid = roomId.trim();
    clearRoomSignals(rid);
    const host = isRoomHost(rid);
    const syncList = () =>
      startTransition(() => setLobbyPlayers(readLobbyPlayers(rid)));
    syncList();
    const unsub = subscribeLobbyAndGo(
      rid,
      syncList,
      host
        ? () => {}
        : () => {
            if (phaseRef.current !== "lobby") return;
            const p = readGameStartPayload(rid);
            const v = p?.variant === "sound" ? "sound" : "color";
            setGameVariant(v);
            beginPlayRef.current(v);
          }
    );
    return unsub;
  }, [phase, roomId]);

  useEffect(() => {
    if (phase !== "memorize") return;
    const hasColor = gameVariant === "color" && colors[roundIndex];
    const hasSound = gameVariant === "sound" && targetsHz[roundIndex] !== undefined;
    if (!hasColor && !hasSound) return;
    const duration = MEMORIZE_ROUND_SECONDS[difficulty] * 1000;
    const start = Date.now();
    const tick = setInterval(() => {
      setMemProgress(Math.min(1, (Date.now() - start) / duration));
    }, 50);
    let innerBridge: ReturnType<typeof setTimeout>;
    const done = setTimeout(() => {
      setPhaseBridge(true);
      innerBridge = setTimeout(() => {
        setPhase("recall");
        if (gameVariant === "color") {
          setGuess({ h: 180, s: 50, b: 50 });
        } else {
          const { min, max } = SOUND_RANGE_HZ[difficulty];
          setGuessFreq(Math.round((min + max) / 2));
        }
        playBeep(soundOn, 440);
        setPhaseBridge(false);
      }, 520);
    }, duration);
    return () => {
      clearInterval(tick);
      clearTimeout(done);
      clearTimeout(innerBridge!);
    };
  }, [
    phase,
    roundIndex,
    difficulty,
    colors,
    targetsHz,
    gameVariant,
    soundOn,
  ]);

  useEffect(() => {
    if (phase !== "memorize" || gameVariant !== "sound" || !targetsHz[roundIndex]) {
      return;
    }
    const hz = targetsHz[roundIndex];
    playTone(soundOn, hz, 240, 0.12);
    const id = setInterval(() => playTone(soundOn, hz, 240, 0.12), 2200);
    return () => clearInterval(id);
  }, [phase, roundIndex, gameVariant, targetsHz, soundOn]);

  const submitRound = useCallback(() => {
    let score: number;
    if (gameVariant === "color") {
      if (!colors[roundIndex]) return;
      score = scoreRound(colors[roundIndex], guess).score;
      setRoundGuessesColor((g) => [...g, { ...guess }]);
    } else {
      if (targetsHz[roundIndex] === undefined) return;
      score = scoreSoundRound(targetsHz[roundIndex], guessFreq, difficulty);
      setRoundGuessesFreq((g) => [...g, guessFreq]);
    }
    playBeep(soundOn, 600 + score * 40);
    const nextScores = [...roundScores, score];
    setRoundScores(nextScores);

    if (roundIndex >= 4) {
      setPhase("results");
      appendGameHistory({
        total: nextScores.reduce((a, b) => a + b, 0),
        roundScores: nextScores,
        mode,
        difficulty,
        playerName: playerName.trim() || "Anonyme",
        variant: gameVariant as HistoryGameVariant,
      });
      setHistoryRefreshKey((k) => k + 1);
      return;
    }
    setRoundIndex((i) => i + 1);
    setGuess({ h: 180, s: 50, b: 50 });
    if (gameVariant === "sound") {
      const { min, max } = SOUND_RANGE_HZ[difficulty];
      setGuessFreq(Math.round((min + max) / 2));
    }
    setMemProgress(0);
    setPhase("memorize");
  }, [
    gameVariant,
    colors,
    targetsHz,
    roundIndex,
    guess,
    guessFreq,
    soundOn,
    roundScores,
    mode,
    difficulty,
    playerName,
  ]);

  const totalScore = roundScores.reduce((a, b) => a + b, 0);

  const resetHome = () => {
    setPhase("home");
    setColors([]);
    setTargetsHz([]);
    setRoundScores([]);
    setRoundGuessesColor([]);
    setRoundGuessesFreq([]);
    setRoundIndex(0);
    setRoomId("");
    setLobbyPlayers([]);
    router.replace("/");
  };

  const shareUrl =
    typeof window !== "undefined" && roomId
      ? `${window.location.origin}/?room=${roomId}`
      : "";

  const skipToRecall = useCallback(() => {
    setPhaseBridge(true);
    setPhase("recall");
    if (gameVariant === "color") {
      setGuess({ h: 180, s: 50, b: 50 });
    } else {
      const { min, max } = SOUND_RANGE_HZ[difficulty];
      setGuessFreq(Math.round((min + max) / 2));
    }
    setTimeout(() => {
      playBeep(soundOn, 520);
      setPhaseBridge(false);
    }, 450);
  }, [gameVariant, difficulty, soundOn]);

  const hostStartMulti = useCallback(() => {
    const rid = roomId.trim();
    if (!rid) return;
    signalGameStart(rid, gameVariant);
    beginPlay(gameVariant);
  }, [roomId, gameVariant, beginPlay]);

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
          <a
            href="#score-historique"
            className="transition-colors duration-[350ms] hover:text-[var(--foreground)]"
          >
            Stats
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
          <Link
            href="/sound-scoring"
            className="transition-colors duration-[350ms] hover:text-[var(--foreground)]"
          >
            Son
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
            <>
              <HomePanel
                onSolo={startSolo}
                onMulti={startMulti}
                onDaily={startDaily}
                difficulty={difficulty}
                onDifficulty={setDifficulty}
                gameVariant={gameVariant}
                onGameVariant={setGameVariant}
              />
              <ScoreHistorySection refreshKey={historyRefreshKey} className="mt-20" />
            </>
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

          {phase === "lobby" && roomId.trim() && (
            <LobbyPanel
              roomId={roomId.trim()}
              players={lobbyPlayers}
              playerName={playerName.trim()}
              isHost={isRoomHost(roomId.trim())}
              shareUrl={shareUrl}
              gameVariant={gameVariant}
              onStart={hostStartMulti}
              onBack={() => setPhase("home")}
            />
          )}

          {phase === "memorize" &&
            gameVariant === "color" &&
            colors[roundIndex] && (
              <MemorizeRoundPanel
                key={`mem-${roundIndex}`}
                color={colors[roundIndex]}
                roundIndex={roundIndex}
                memProgress={memProgress}
                difficulty={difficulty}
                onSkip={skipToRecall}
              />
            )}

          {phase === "memorize" &&
            gameVariant === "sound" &&
            targetsHz[roundIndex] !== undefined && (
              <MemorizeSoundPanel
                key={`mem-s-${roundIndex}`}
                hz={targetsHz[roundIndex]}
                roundIndex={roundIndex}
                memProgress={memProgress}
                difficulty={difficulty}
                onSkip={skipToRecall}
              />
            )}

          {phase === "recall" &&
            gameVariant === "color" &&
            colors[roundIndex] && (
              <RecallPanel
                key={`rec-${roundIndex}`}
                roundIndex={roundIndex}
                guess={guess}
                onGuess={setGuess}
                onSubmit={submitRound}
              />
            )}

          {phase === "recall" &&
            gameVariant === "sound" &&
            targetsHz[roundIndex] !== undefined && (
              <RecallSoundPanel
                key={`rec-s-${roundIndex}`}
                roundIndex={roundIndex}
                guessFreq={guessFreq}
                onGuessFreq={setGuessFreq}
                difficulty={difficulty}
                soundOn={soundOn}
                onSubmit={submitRound}
              />
            )}

          {phase === "results" && (
            <ResultsPanel
              gameVariant={gameVariant}
              total={totalScore}
              roundScores={roundScores}
              colorTargets={colors}
              colorGuesses={roundGuessesColor}
              freqTargets={targetsHz}
              freqGuesses={roundGuessesFreq}
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
                ? gameVariant === "sound"
                  ? "Écoute · compte à rebours"
                  : "Mémorise · compte à rebours"
                : phase === "recall"
                  ? gameVariant === "sound"
                    ? "Fréquence · curseur Hz"
                    : "Reconstitue · curseurs"
                  : "Manche à manche"}
            </p>
            <div className="mt-8 space-y-4 border-t border-[var(--border)] pt-8">
              <Stat label="Mode" value={modeLabel(mode)} />
              <Stat
                label="Jeu"
                value={gameVariant === "sound" ? "Fréquence (son)" : "Couleur"}
              />
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

      {phaseBridge && (
        <div
          className="pointer-events-none fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-[var(--background)]/82 backdrop-blur-md"
          aria-live="polite"
        >
          <p className="phase-bridge-title font-display text-4xl font-bold tracking-tight text-[var(--foreground)] md:text-5xl">
            {gameVariant === "sound" ? "Retrouve la fréquence" : "À toi de jouer"}
          </p>
          <p className="text-sm text-[var(--muted)]">
            {gameVariant === "sound"
              ? "Règle le curseur Hz — ta mémoire guide."
              : "Règle les curseurs — ta mémoire guide."}
          </p>
        </div>
      )}

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
          · Couleur (CIEDE2000) · Son (ERB-rate) · Projet démo
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
  gameVariant,
  onGameVariant,
}: {
  onSolo: () => void;
  onMulti: () => void;
  onDaily: () => void;
  difficulty: Difficulty;
  onDifficulty: (d: Difficulty) => void;
  gameVariant: GameVariant;
  onGameVariant: (v: GameVariant) => void;
}) {
  return (
    <div className="opacity-100 transition-opacity duration-[400ms]">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.35em] text-[var(--accent)]">
        Mémoire sensorielle
      </p>
      <h1 className="font-display text-5xl font-bold leading-[0.95] tracking-tight text-[var(--foreground)] md:text-6xl lg:text-7xl">
        À quel point
        <br />
        tes souvenirs
        <br />
        sont justes ?
      </h1>
      <p className="mt-8 max-w-lg text-lg leading-relaxed text-[var(--muted)] transition-colors duration-[350ms]">
        {gameVariant === "color"
          ? "Cinq manches couleur : mémorisation avec compte à rebours, puis reconstitution HSB — score perceptuel CIEDE2000."
          : "Cinq manches son : tu entends une fréquence, puis tu la retrouves avec un curseur Hz — score ERB-rate (comme sur dialed.gg)."}
      </p>

      <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
        Type de jeu
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onGameVariant("color")}
          className={`rounded-full px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] transition-[background-color,color,transform] duration-[350ms] ${
            gameVariant === "color"
              ? "bg-[var(--foreground)] text-[var(--background)]"
              : "border border-[var(--border)] bg-transparent text-[var(--muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          Couleur
        </button>
        <button
          type="button"
          onClick={() => onGameVariant("sound")}
          className={`rounded-full px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] transition-[background-color,color,transform] duration-[350ms] ${
            gameVariant === "sound"
              ? "bg-[var(--foreground)] text-[var(--background)]"
              : "border border-[var(--border)] bg-transparent text-[var(--muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          Son
        </button>
      </div>

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

function LobbyPanel({
  roomId,
  players,
  playerName,
  isHost,
  shareUrl,
  gameVariant,
  onStart,
  onBack,
}: {
  roomId: string;
  players: LobbyPlayer[];
  playerName: string;
  isHost: boolean;
  shareUrl: string;
  gameVariant: GameVariant;
  onStart: () => void;
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
    <div className="game-panel-enter max-w-xl">
      <button
        type="button"
        onClick={onBack}
        className="mb-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)] hover:text-[var(--accent)]"
      >
        ← Retour
      </button>
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--accent)]">
        Salle d’attente
      </p>
      <h2 className="mt-2 font-display text-3xl font-bold text-[var(--foreground)] md:text-4xl">
        Salon · {roomId}
      </h2>
      <p className="mt-4 text-sm text-[var(--muted)]">
        Les joueurs qui rejoignent le lien avec le même ID apparaissent ici (même
        navigateur / onglets — synchronisation locale). Partie :{" "}
        <span className="text-[var(--foreground)]">
          {gameVariant === "sound" ? "Son" : "Couleur"}
        </span>
        .
      </p>
      {shareUrl && (
        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Lien
          </p>
          <p className="mt-1 break-all font-mono text-xs text-[var(--foreground)]">{shareUrl}</p>
          <button
            type="button"
            onClick={copy}
            className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]"
          >
            {copied ? "Copié" : "Copier"}
          </button>
        </div>
      )}
      <div className="mt-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Joueurs ({players.length})
        </p>
        <ul className="mt-4 space-y-2">
          {players.length === 0 ? (
            <li className="text-sm text-[var(--muted)]">En attente…</li>
          ) : (
            players.map((p) => (
              <li
                key={p.clientId}
                className="flex items-center justify-between rounded-xl border border-[var(--border)] px-4 py-3"
              >
                <span className="font-medium text-[var(--foreground)]">{p.name}</span>
                <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--muted)]">
                  {p.name === playerName ? "Toi" : "Prêt"}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
      {isHost ? (
        <button
          type="button"
          onClick={onStart}
          className="mt-10 rounded-full bg-[var(--foreground)] px-10 py-4 text-sm font-semibold uppercase tracking-[0.15em] text-[var(--background)] transition-transform duration-[350ms] hover:scale-[1.02]"
        >
          Lancer la partie
        </button>
      ) : (
        <p className="mt-10 text-sm text-[var(--muted)]">
          En attente que l’hôte lance la partie…
        </p>
      )}
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
        Après avoir choisi ton pseudo, tu arrives au salon : tu vois qui a rejoint.
        L’hôte lance la partie quand tout le monde est prêt — même graine, même
        ordre pour tous.
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

function MemorizeSoundPanel({
  hz: _hz,
  roundIndex,
  memProgress,
  difficulty,
  onSkip,
}: {
  hz: number;
  roundIndex: number;
  memProgress: number;
  difficulty: Difficulty;
  onSkip: () => void;
}) {
  void _hz;
  const totalSec = MEMORIZE_ROUND_SECONDS[difficulty];
  const secondsLeft = Math.max(0, Math.ceil((1 - memProgress) * totalSec));

  return (
    <div className="game-panel-enter max-w-xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--accent)]">
        Écoute
      </p>
      <h2 className="mt-2 font-display text-3xl font-bold text-[var(--foreground)] md:text-4xl">
        Manche {roundIndex + 1} sur 5 · tonalité
      </h2>
      <p className="mt-3 text-sm text-[var(--muted)]">
        Le son se répète pendant le compte à rebours. Mémorise la hauteur — pas les
        chiffres.
      </p>
      <RoundProgressDots roundIndex={roundIndex} />
      <div className="mt-10 flex flex-col items-center gap-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="sound-mem-visual flex aspect-square w-full max-w-[min(100%,280px)] flex-col items-center justify-center rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-inner">
          <span className="font-display text-6xl text-[var(--accent)]">♪</span>
          <span className="mt-6 text-center text-sm text-[var(--muted)]">
            Concentre-toi sur la hauteur — pas de valeur affichée.
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
      <button
        type="button"
        onClick={onSkip}
        className="group mt-10 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)] transition-[color,transform] duration-[350ms] hover:text-[var(--foreground)]"
      >
        <span className="transition-transform duration-[350ms] group-hover:translate-x-0.5">
          J’ai retenu — passer au curseur
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
    <div className="recall-stage-enter game-panel-enter max-w-xl">
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

function RecallSoundPanel({
  roundIndex,
  guessFreq,
  onGuessFreq,
  difficulty,
  soundOn,
  onSubmit,
}: {
  roundIndex: number;
  guessFreq: number;
  onGuessFreq: (hz: number) => void;
  difficulty: Difficulty;
  soundOn: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="recall-stage-enter game-panel-enter max-w-xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--accent)]">
        Reconstitue · manche {roundIndex + 1} / 5
      </p>
      <h2 className="mt-2 font-display text-3xl font-bold text-[var(--foreground)] md:text-4xl">
        Retrouve la fréquence
      </h2>
      <p className="mt-4 max-w-lg text-sm leading-relaxed text-[var(--muted)]">
        Règle le curseur pour retrouver la tonalité entendue. Tu peux préécouter ton
        réglage avant de valider.
      </p>
      <RoundProgressDots roundIndex={roundIndex} />
      <div className="mt-10">
        <FrequencyPicker
          valueHz={guessFreq}
          onChangeHz={onGuessFreq}
          difficulty={difficulty}
          onPreview={() => playTone(soundOn, guessFreq, 280, 0.12)}
        />
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
  gameVariant,
  total,
  roundScores,
  colorTargets,
  colorGuesses,
  freqTargets,
  freqGuesses,
  playerName,
  mode,
  roomId,
  onHome,
}: {
  gameVariant: GameVariant;
  total: number;
  roundScores: number[];
  colorTargets: HSB[];
  colorGuesses: HSB[];
  freqTargets: number[];
  freqGuesses: number[];
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

      <div className="mt-10 space-y-8">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Détail par manche
        </h3>
        {roundScores.map((s, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/60 p-5 backdrop-blur-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
              <span className="text-sm font-medium text-[var(--foreground)]">
                Manche {i + 1}
              </span>
              <span className="font-mono text-sm text-[var(--accent)]">{s.toFixed(2)}/10</span>
            </div>
            {gameVariant === "color" && colorTargets[i] && colorGuesses[i] && (
              <div className="mt-4 flex flex-wrap items-center gap-6">
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Cible
                  </p>
                  <div
                    className="h-16 w-24 rounded-xl border border-[var(--border)] shadow-inner"
                    style={{ backgroundColor: hsbToCss(colorTargets[i]) }}
                  />
                  <p className="mt-2 font-mono text-[10px] text-[var(--muted)]">
                    {formatHsb(colorTargets[i])}
                  </p>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Ta reproduction
                  </p>
                  <div
                    className="h-16 w-24 rounded-xl border border-[var(--border)] shadow-inner"
                    style={{ backgroundColor: hsbToCss(colorGuesses[i]) }}
                  />
                  <p className="mt-2 font-mono text-[10px] text-[var(--muted)]">
                    {formatHsb(colorGuesses[i])}
                  </p>
                </div>
              </div>
            )}
            {gameVariant === "sound" &&
              freqTargets[i] !== undefined &&
              freqGuesses[i] !== undefined && (
                <div className="mt-4 flex flex-wrap gap-8 font-mono text-sm">
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      Cible
                    </p>
                    <p className="text-lg text-[var(--foreground)]">
                      {Math.round(freqTargets[i])} Hz
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      Ton essai
                    </p>
                    <p className="text-lg text-[var(--foreground)]">
                      {Math.round(freqGuesses[i])} Hz
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      Écart
                    </p>
                    <p className="text-lg text-[var(--muted)]">
                      {Math.round(Math.abs(freqTargets[i] - freqGuesses[i]))} Hz
                    </p>
                  </div>
                </div>
              )}
          </div>
        ))}
      </div>

      {mode === "multi" && roomId && (
        <p className="mt-8 text-sm text-[var(--muted)]">
          Compare avec tes amis sur la salle{" "}
          <span className="font-mono text-[var(--foreground)]">{roomId}</span> — même
          séquence, meilleur score gagne.
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
