"use client";

import {
  hzFromLogPosition,
  hzToLogPosition,
  scoreSoundRound,
  SOUND_RANGE_HZ,
  type SoundDifficulty,
} from "@/lib/soundScoring";
import { useCallback, useEffect, useRef, useState } from "react";

const SLIDER_STEPS = 2000;

type PreviewNodes = {
  ctx: AudioContext;
  osc: OscillatorNode;
  gain: GainNode;
};

function clampFreq(hz: number, min: number, max: number) {
  return Math.max(min, Math.min(max, hz));
}

type Props = {
  valueHz: number;
  onChangeHz: (hz: number) => void;
  difficulty: SoundDifficulty;
  soundOn: boolean;
  /** Pour score temps réel (comme la démo sound-scoring) — la cible n’est pas affichée */
  targetHz?: number;
  disabled?: boolean;
};

export function FrequencyPicker({
  valueHz,
  onChangeHz,
  difficulty,
  soundOn,
  targetHz,
  disabled,
}: Props) {
  const { min, max } = SOUND_RANGE_HZ[difficulty];
  const previewRef = useRef<PreviewNodes | null>(null);
  const draggingRef = useRef(false);
  const continuousRef = useRef(false);
  const [continuousListen, setContinuousListen] = useState(false);
  useEffect(() => {
    continuousRef.current = continuousListen;
  }, [continuousListen]);

  const stopPreview = useCallback(() => {
    const p = previewRef.current;
    if (!p) return;
    previewRef.current = null;
    try {
      const t = p.ctx.currentTime;
      p.gain.gain.cancelScheduledValues(t);
      p.gain.gain.setValueAtTime(p.gain.gain.value, t);
      p.gain.gain.linearRampToValueAtTime(0.0001, t + 0.05);
      setTimeout(() => {
        try {
          p.osc.stop();
          void p.ctx.close();
        } catch {
          /* ignore */
        }
      }, 80);
    } catch {
      void p.ctx.close();
    }
  }, []);

  const ensurePreview = useCallback(() => {
    if (!soundOn || typeof window === "undefined") return null;
    if (previewRef.current) return previewRef.current;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = clampFreq(valueHz, min, max);
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      const t0 = ctx.currentTime;
      gain.gain.linearRampToValueAtTime(0.1, t0 + 0.05);
      const nodes = { ctx, osc, gain };
      previewRef.current = nodes;
      return nodes;
    } catch {
      return null;
    }
  }, [soundOn, valueHz, min, max]);

  const setOscFreq = useCallback(
    (hz: number) => {
      const p = previewRef.current;
      if (!p) return;
      const f = clampFreq(hz, min, max);
      const t = p.ctx.currentTime;
      p.osc.frequency.cancelScheduledValues(t);
      p.osc.frequency.setValueAtTime(p.osc.frequency.value, t);
      p.osc.frequency.linearRampToValueAtTime(f, t + 0.04);
    },
    [min, max]
  );

  const startPreviewAt = useCallback(
    (hz: number) => {
      if (!soundOn) return;
      const p = ensurePreview();
      if (!p) return;
      setOscFreq(hz);
      const t = p.ctx.currentTime;
      p.gain.gain.cancelScheduledValues(t);
      p.gain.gain.linearRampToValueAtTime(0.1, t + 0.04);
    },
    [soundOn, ensurePreview, setOscFreq]
  );

  useEffect(() => {
    return () => stopPreview();
  }, [stopPreview]);

  useEffect(() => {
    if (!continuousListen || !soundOn) {
      if (!draggingRef.current) stopPreview();
      return;
    }
    startPreviewAt(valueHz);
  }, [continuousListen, soundOn, valueHz, startPreviewAt, stopPreview]);

  const pos = hzToLogPosition(valueHz, min, max) * SLIDER_STEPS;

  const applyPosition = (raw: number) => {
    const t = Math.max(0, Math.min(SLIDER_STEPS, raw)) / SLIDER_STEPS;
    const hz = hzFromLogPosition(t, min, max);
    onChangeHz(hz);
    if (draggingRef.current || continuousListen) {
      setOscFreq(hz);
    }
  };

  const onPointerDownSlider = (e: React.PointerEvent) => {
    if (disabled || !soundOn) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    draggingRef.current = true;
    startPreviewAt(valueHz);
  };

  const onPointerUpSlider = () => {
    draggingRef.current = false;
    if (!continuousListen) stopPreview();
  };

  useEffect(() => {
    const up = () => {
      draggingRef.current = false;
      if (!continuousListen) stopPreview();
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [continuousListen, stopPreview]);

  const liveScore =
    targetHz !== undefined
      ? scoreSoundRound(targetHz, valueHz, difficulty)
      : null;

  return (
    <div className="flex flex-col gap-8">
      {liveScore !== null && (
        <div className="sound-live-score flex items-baseline justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/80 px-5 py-4 backdrop-blur-sm">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Score en direct (ERB)
          </span>
          <span className="font-display text-3xl tabular-nums text-[var(--foreground)]">
            {liveScore.toFixed(2)}
            <span className="text-lg text-[var(--muted)]">/10</span>
          </span>
        </div>
      )}

      <div
        className="sound-spectrum relative h-28 w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]"
        aria-hidden
      >
        <div className="sound-spectrum-bars absolute inset-x-0 bottom-0 flex h-full items-end justify-center gap-[2px] px-2 pb-2 pt-4">
          {Array.from({ length: 56 }, (_, i) => {
            const t = i / 55;
            const f = hzFromLogPosition(t, min, max);
            const h = 12 + hzToLogPosition(f, min, max) * 72;
            const guessT = hzToLogPosition(valueHz, min, max);
            const dist = Math.abs(t - guessT);
            const hot = dist < 0.06;
            return (
              <div
                key={i}
                className={`sound-bar min-w-0 flex-1 rounded-t-[2px] transition-[background-color,opacity,transform] duration-150 ${
                  hot
                    ? "bg-[var(--accent)] opacity-100 [animation:sound-bar-pulse_1.2s_ease-in-out_infinite]"
                    : "bg-[var(--border)] opacity-50"
                }`}
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center font-mono text-[10px] text-[var(--muted)]">
          Glisse — échelle logarithmique (pitch)
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Fréquence
          </span>
          <span className="font-mono text-2xl tabular-nums tracking-tight text-[var(--foreground)]">
            {valueHz.toFixed(2)}
            <span className="ml-1 text-sm font-normal text-[var(--muted)]">Hz</span>
          </span>
        </div>
        <div
          className="relative h-12 w-full max-w-md touch-none"
          onPointerDown={onPointerDownSlider}
          onPointerUp={onPointerUpSlider}
          onPointerLeave={onPointerUpSlider}
        >
          <input
            type="range"
            min={0}
            max={SLIDER_STEPS}
            step={1}
            value={pos}
            disabled={disabled}
            onChange={(e) => applyPosition(Number(e.target.value))}
            onInput={(e) => applyPosition(Number((e.target as HTMLInputElement).value))}
            className="absolute inset-0 z-10 h-full w-full cursor-grab opacity-0 active:cursor-grabbing disabled:cursor-not-allowed"
          />
          <div className="pointer-events-none absolute inset-0 flex items-center px-1">
            <div className="relative h-2 w-full rounded-full bg-[var(--border)]/80">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[var(--muted)]/40 via-[var(--accent)] to-[var(--accent)] transition-[width] duration-75 ease-out"
                style={{ width: `${(pos / SLIDER_STEPS) * 100}%` }}
              />
              <div
                className="sound-thumb absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--background)] bg-[var(--foreground)] shadow-lg transition-[transform,box-shadow] duration-200 hover:scale-105 hover:shadow-[0_0_20px_var(--accent-glow)]"
                style={{ left: `${(pos / SLIDER_STEPS) * 100}%` }}
              />
            </div>
          </div>
        </div>
        <p className="mt-3 font-mono text-[10px] leading-relaxed text-[var(--muted)]">
          Plage {difficulty === "easy" ? "facile" : "difficile"} : {min} – {max} Hz · maintiens
          et glisse pour entendre en continu (comme sur{" "}
          <span className="text-[var(--foreground)]">dialed.gg</span>).
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={disabled || !soundOn}
          onClick={() => {
            setContinuousListen((c) => !c);
            if (continuousListen) stopPreview();
          }}
          className={`rounded-full px-6 py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] transition-[background-color,border-color,color] duration-[350ms] disabled:opacity-40 ${
            continuousListen
              ? "bg-[var(--accent)] text-[var(--background)]"
              : "border border-[var(--border)] text-[var(--muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          {continuousListen ? "Écoute continue · on" : "Écoute continue"}
        </button>
        <button
          type="button"
          disabled={disabled || !soundOn || continuousListen}
          onClick={() => {
            if (continuousRef.current) return;
            stopPreview();
            const p = ensurePreview();
            if (p) {
              setOscFreq(valueHz);
              const t = p.ctx.currentTime;
              p.gain.gain.linearRampToValueAtTime(0.1, t + 0.04);
              setTimeout(() => {
                if (!continuousRef.current && !draggingRef.current) stopPreview();
              }, 450);
            }
          }}
          className="rounded-full border border-[var(--border)] px-6 py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)] transition-[border-color,color] duration-[350ms] hover:border-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40"
        >
          Pulse à cette fréquence
        </button>
      </div>
    </div>
  );
}
